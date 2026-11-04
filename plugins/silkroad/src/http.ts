/**
 * HTTP surface of SilkRoad.
 *
 * Management API (panel → host) rides DSH's authenticated `/api` channel as
 * exact Fetch routes, so only the owner's own Web/Desktop session reaches it:
 *
 *   GET  /api/silkroad/status
 *   POST /api/silkroad/connectors/login    { id }        → { authorizationUrl?, state }
 *   POST /api/silkroad/connectors/logout   { id }
 *   POST /api/silkroad/vendors/key         { id, value }
 *   POST /api/silkroad/vendors/clear       { id }
 *   POST /api/silkroad/vendors/settings    { id, values }
 *   POST /api/silkroad/shop/settings       { values: { appKey, serviceId, region } }
 *   POST /api/silkroad/shop/secret         { value }
 *   POST /api/silkroad/shop/secret/clear
 *   POST /api/silkroad/shop/authorize                    → { authorizationUrl }
 *   POST /api/silkroad/shop/complete       { pasted }    (redirected address or bare code)
 *   POST /api/silkroad/shop/disconnect
 *   POST /api/silkroad/knowledge/open                    (create if missing, reveal in the file manager)
 *   GET  /api/silkroad/reports                           → { directory, files: ReportFile[] }
 *   POST /api/silkroad/reports/read        { path }      → { path, title, text, truncated, modified }
 *   POST /api/silkroad/reports/open                      (create if missing, reveal in the file manager)
 *
 * The OAuth callback is a top-level navigation from the provider's site in
 * the user's system browser, which carries no DSH cookie, so it is a public
 * route on the web server and is bound to the started login by `state`:
 *
 *   GET  /silkroad/oauth/callback/:id?code&state[&iss|&error]
 *
 * `tiktok-shop` is a valid :id when the user registered this loopback address
 * as their TikTok Shop app's redirect URL.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { UserError, type Hub } from './hub.ts'
import { listReports, readReport } from './reports.ts'

/** Exact Fetch routes are registered with their full `/api/...` path. */
export const API_PREFIX = '/api/silkroad'
export const CALLBACK_PATH = '/silkroad/oauth/callback'
export const SHOP_CALLBACK_ID = 'tiktok-shop'
const MAX_BODY_BYTES = 16 * 1024

/** Loopback redirect URI for one connector; the port is the DSH web server's. */
export function callbackUrl(host: string, port: number, id: string): string {
  const name = host.includes(':') ? `[${host}]` : host
  return `http://${name}:${port}${CALLBACK_PATH}/${encodeURIComponent(id)}`
}

/** Mirrors `ConnectionFetchRoute` from `@deepseek-ai/dsh-client-connection`. */
export interface FetchRoute {
  readonly path: string
  readonly methods: readonly ('GET' | 'HEAD' | 'POST')[]
  readonly requestBody: 'buffered' | 'streaming'
  readonly fetch: (request: Request) => Promise<Response>
}

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

async function bodyOf(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text()
  if (text.length > MAX_BODY_BYTES) throw new UserError(413, 'Request body is too large.')
  if (!text) return {}
  try {
    const value = JSON.parse(text) as unknown
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  } catch { /* fall through */ }
  throw new UserError(400, 'Request body must be a JSON object.')
}

function idOf(body: Record<string, unknown>): string {
  if (typeof body.id !== 'string' || !body.id) throw new UserError(400, 'Missing data source id.')
  return body.id
}

function route(path: string, method: 'GET' | 'POST', run: (body: Record<string, unknown>) => Promise<unknown>): FetchRoute {
  return {
    path: `${API_PREFIX}${path}`, methods: [method], requestBody: 'buffered',
    async fetch(request) {
      try {
        return reply(200, await run(method === 'POST' ? await bodyOf(request) : {}))
      } catch (error) {
        if (error instanceof UserError) return reply(error.status, { error: error.message })
        return reply(500, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  }
}

export function managementRoutes(hub: Hub, reveal: (path: string) => Promise<void> = async () => {}): FetchRoute[] {
  return [
    route('/status', 'GET', () => hub.status()),
    route('/connectors/login', 'POST', body => hub.connector(idOf(body)).beginLogin()),
    route('/connectors/logout', 'POST', async body => { await hub.connector(idOf(body)).logout(); return { ok: true } }),
    route('/vendors/key', 'POST', async body => { await hub.setVendorKey(idOf(body), body.value); return { ok: true } }),
    route('/vendors/clear', 'POST', async body => { await hub.clearVendorKey(idOf(body)); return { ok: true } }),
    route('/vendors/settings', 'POST', async body => { await hub.setVendorSettings(idOf(body), body.values); return { ok: true } }),
    route('/shop/settings', 'POST', async body => { await hub.shop().configure(body.values); return { ok: true } }),
    route('/shop/secret', 'POST', async body => { await hub.shop().setSecret(body.value); return { ok: true } }),
    route('/shop/secret/clear', 'POST', async () => { await hub.shop().clearSecret(); return { ok: true } }),
    route('/shop/authorize', 'POST', () => hub.shop().beginAuthorization()),
    route('/shop/complete', 'POST', body => hub.shop().completeAuthorization({ pasted: body.pasted })),
    route('/knowledge/open', 'POST', async () => { const directory = await hub.prepareKnowledge(); await reveal(directory); return { directory } }),
    route('/reports', 'GET', async () => ({ directory: hub.reportsDirectory, files: await listReports(hub.reportsDirectory) })),
    route('/reports/read', 'POST', body => readReport(hub.reportsDirectory, body.path)),
    route('/reports/open', 'POST', async () => { const directory = await hub.prepareReports(); await reveal(directory); return { directory } }),
    route('/shop/disconnect', 'POST', async () => { await hub.shop().disconnect(); return { ok: true } }),
  ]
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!)
}

function page(res: ServerResponse, status: number, title: string, detail: string): void {
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store',
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'", 'referrer-policy': 'no-referrer',
  })
  res.end(`<!doctype html><meta charset="utf-8"><title>SilkRoad</title>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;line-height:1.6">
<h2>${escapeHtml(title)}</h2><p>${escapeHtml(detail)}</p></body>`)
}

export function createCallbackHandler(hub: Hub) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (req.method !== 'GET' || !url.pathname.startsWith(`${CALLBACK_PATH}/`)) {
      res.writeHead(404); res.end(); return
    }
    const id = decodeURIComponent(url.pathname.slice(CALLBACK_PATH.length + 1))
    const params = Object.fromEntries(['code', 'state', 'iss', 'error'].flatMap(name => {
      const value = url.searchParams.get(name)
      return value === null ? [] : [[name, value]]
    }))
    try {
      if (id === SHOP_CALLBACK_ID) {
        if (params.error) throw new UserError(400, `TikTok Shop 返回了错误：${params.error}。`)
        await hub.shop().completeAuthorization({ code: params.code, state: params.state ?? '' })
        page(res, 200, '店铺授权成功', 'TikTok Shop 店铺已连接。可以关闭这个页面，回到 DeepSeek Harness 继续。')
        return
      }
      await hub.connector(id).completeLogin(params)
      page(res, 200, '登录成功', '数据源已连接。可以关闭这个页面，回到 DeepSeek Harness 继续。')
    } catch (error) {
      page(res, 400, '登录没有完成', `${error instanceof Error ? error.message : String(error)} 请回到 SilkRoad 面板重新登录。`)
    }
  }
}
