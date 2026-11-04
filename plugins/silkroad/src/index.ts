/**
 * SilkRoad host plugin: registers the data-source hub, its HTTP routes for the
 * sidebar panel, the setup tools and skills, and mounts DSH's MCP client for
 * each OAuth data source the user has logged into.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-skill'
import type {} from '@deepseek-ai/dsh-tools'
import * as mcpClient from '@deepseek-ai/dsh-mcp-client'
import z from '@deepseek-ai/schemastery'
import { OAUTH_CONNECTORS } from './connectors/catalog.ts'
import { OAuthMcpConnector, type McpMount } from './connectors/oauth-connector.ts'
import type { CredentialsLike } from './credentials.ts'
import { CALLBACK_PATH, callbackUrl, createCallbackHandler, managementRoutes, SHOP_CALLBACK_ID } from './http.ts'
import { Hub, type DeclaredPreset } from './hub.ts'
import { openFolder, openInBrowser } from './open-url.ts'
import { rolePresets, type PresetDefinitionLike } from './presets.ts'
import { loadSkills } from './skills.ts'
import { setupTools } from './tools.ts'
import { TikTokShop } from './tiktok-shop/client.ts'
import { tiktokShopTools } from './tiktok-shop/tools.ts'
import { knowledgeTool } from './knowledge.ts'
import { imageTool } from './vendors/image.ts'
import { kalodataTools } from './vendors/kalodata.ts'
import { vendorTools } from './vendors/tools.ts'

import { OWNER } from './keys.ts'

export const name = OWNER
export const inject = ['tools', 'credentials', 'skills', 'webServer', 'connection']

export interface Config {}
export const Config: z<Config> = z.object({})

interface PresetRegistryLike {
  register(definition: PresetDefinitionLike): Promise<() => Promise<void>>
  list(): Promise<readonly DeclaredPreset[]>
}

const LOOPBACK = new Set(['127.0.0.1', '::1', 'localhost'])

export async function apply(ctx: Context): Promise<void> {
  const credentials = ctx.credentials as unknown as CredentialsLike

  const redirectUrl = (id: string) => () => {
    const { port, host } = ctx.webServer
    if (port === undefined) throw new Error('The DeepSeek Harness web server is not listening yet; try again in a moment.')
    // The authorization server redirects the user's own browser, so the callback must be a loopback address.
    return callbackUrl(LOOPBACK.has(host) ? host : '127.0.0.1', port, id)
  }

  const mount: McpMount = async config => {
    const fiber = ctx.plugin(mcpClient, { transport: 'streamable-http', ...config })
    await fiber
    return { dispose: () => fiber.dispose() }
  }

  const connectors = new Map(OAUTH_CONNECTORS.map(spec => [spec.id, new OAuthMcpConnector({
    spec, credentials, owner: name, redirectUrl: redirectUrl(spec.id), mount,
    openBrowser: url => openInBrowser(url).catch(error => {
      // The URL is also returned to the caller, so a failed launch is not fatal.
      ctx.logger.warn('silkroad: could not open the browser: %s', String(error))
    }),
    logger: ctx.logger,
  })]))
  const tiktokShop = new TikTokShop({
    credentials,
    callbackUrl: () => redirectUrl(SHOP_CALLBACK_ID)(),
    openBrowser: url => openInBrowser(url).catch(error => { ctx.logger.warn('silkroad: could not open the browser: %s', String(error)) }),
  })
  const hub = new Hub(credentials, connectors, tiktokShop)

  // Panel API: authenticated by DSH's own connection layer, owner only.
  for (const route of managementRoutes(hub, path => openFolder(path))) {
    ctx.effect(() => ctx.connection.fetch.register(route), `silkroad: route ${route.path}`)
  }
  // OAuth callback: reached from the user's system browser, which has no DSH cookie; bound by `state` instead.
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: CALLBACK_PATH, handler: createCallbackHandler(hub) }), 'silkroad: oauth callback')
  for (const tool of [...setupTools(hub), ...vendorTools({ credentials }), imageTool({ credentials, settings: id => hub.vendorSettings(id) }), ...kalodataTools({ credentials, settings: id => hub.vendorSettings(id) }), ...tiktokShopTools(tiktokShop), knowledgeTool(async () => hub.knowledgeDirectory)]) {
    ctx.effect(() => ctx.tools.register(tool), `silkroad: tool ${tool.name}`)
  }
  for (const skill of await loadSkills()) {
    ctx.effect(() => ctx.skills.register({ ...skill, source: 'runtime', invocation: { modelInvocable: true, userInvocable: true } }), `silkroad: skill ${skill.name}`)
  }
  // Role presets need the preset registry; a child plugin waits for it without blocking the data sources.
  ctx.plugin({
    name: 'dsh-silkroad-presets',
    inject: ['agentPresets'],
    async apply(child: Context) {
      const registry = (child as unknown as { agentPresets: PresetRegistryLike }).agentPresets
      const disposers = await Promise.all(rolePresets().map(definition => registry.register(definition)))
      hub.presetSource = () => registry.list()
      child.effect(() => () => {
        hub.presetSource = undefined
        return Promise.all(disposers.map(dispose => dispose())).then(() => undefined)
      }, 'silkroad: role presets')
    },
  })
  ctx.effect(() => () => Promise.all([...connectors.values()].map(connector => connector.stop())).then(() => undefined), 'silkroad: connectors')

  // Restoring a login may refresh a token over the network; never hold up harness startup for it.
  for (const connector of connectors.values()) {
    connector.start().catch(error => { ctx.logger.warn('silkroad: %s could not restore its login: %s', connector.id, String(error)) })
  }
  ctx.logger.info('SilkRoad ready: open the SilkRoad panel in the sidebar to connect data sources')
}
