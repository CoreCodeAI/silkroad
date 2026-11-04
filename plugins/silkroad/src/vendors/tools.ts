/**
 * Model-facing tools for API-key vendors. Each tool mirrors the vendor's own
 * public API (parameter names included) so the vendor's documentation is the
 * reference for what the model may pass.
 */
import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'
import { credentialRef } from '../keys.ts'
import type { CredentialsLike } from '../credentials.ts'
import { vendorById, type ApiKeyVendorSpec } from './catalog.ts'
import { modelText, requestJson, VendorError } from './http.ts'

export interface VendorToolDeps {
  credentials: CredentialsLike
  fetchFn?: typeof fetch
}

const JSON_OUTPUT = { type: 'json' } as const
const asJson = (value: unknown) => JSON.parse(JSON.stringify(value ?? null)) as never
const text = (value: unknown) => [{ type: 'text' as const, text: modelText(value) }]

async function keyOf(deps: VendorToolDeps, vendor: ApiKeyVendorSpec): Promise<string | undefined> {
  const hit = await deps.credentials.resolve(credentialRef(vendor.credential))
  if (hit?.value) return hit.value
  if (vendor.keyOptional) return undefined
  throw new VendorError('missing-key',
    `${vendor.title} has no API key yet. Ask the user to open the 跨境电商 (SilkRoad) panel in the left sidebar, 数据源 tab, and save their ${vendor.title} key there (get one at ${vendor.signup}). Never ask for the key in chat.`)
}

/** Plain-language failure for the model, with the next step it should suggest. */
function explain(vendor: ApiKeyVendorSpec, error: unknown): never {
  if (error instanceof VendorError && error.kind === 'auth') {
    throw new VendorError('auth', `${error.message}\nThe ${vendor.title} key was rejected. Ask the user to check or replace it in the 跨境电商 (SilkRoad) panel, 数据源 tab.`)
  }
  throw error
}

export const SERPAPI_ENGINES = ['google', 'google_trends', 'google_shopping', 'google_images', 'amazon', 'youtube', 'ebay', 'walmart'] as const

export function serpApiTool(deps: VendorToolDeps): ToolDefinition {
  const vendor = vendorById('serpapi')!
  return defineTool({
    name: 'silkroad_serpapi_search',
    description: 'Search through SerpApi with the user\'s own key. Pick an engine and pass that engine\'s parameters as documented at https://serpapi.com/search-api (for example google_trends takes q, geo, date, data_type; amazon takes k and amazon_domain). Use it for search demand, trend curves, shopping prices and marketplace listings outside TikTok.',
    parameters: {
      engine: { type: 'string', required: true, enum: SERPAPI_ENGINES, description: 'SerpApi engine' },
      q: { type: 'string', description: 'Query text for engines that take q' },
      params: { type: 'object', additionalProperties: true, description: 'Other parameters of the chosen engine, by their SerpApi names (e.g. {"geo":"US","date":"today 12-m"})' },
    },
    output: { schema: JSON_OUTPUT, render: (_args, value) => text(value) },
    async execute(args, exec) {
      const key = await keyOf(deps, vendor)
      const query = new URLSearchParams()
      for (const [name, value] of Object.entries(args.params ?? {})) {
        if (name === 'api_key' || name === 'engine' || value === null || value === undefined) continue
        query.set(name, typeof value === 'object' ? JSON.stringify(value) : String(value))
      }
      query.set('engine', args.engine)
      if (args.q) query.set('q', args.q)
      query.set('output', 'json')
      query.set('api_key', key!)
      try {
        const result = await requestJson({
          label: 'SerpApi', url: `https://serpapi.com/search.json?${query}`, secrets: [key], signal: exec.signal,
          ...deps.fetchFn ? { fetchFn: deps.fetchFn } : {},
        }) as Record<string, unknown>
        // SerpApi echoes request metadata that wastes context; drop it.
        delete result.search_metadata
        delete result.search_parameters
        if (typeof result.error === 'string') throw new VendorError('bad-request', `SerpApi: ${result.error}`)
        return asJson(result)
      } catch (error) { explain(vendor, error) }
    },
  })
}

export function anySearchTool(deps: VendorToolDeps): ToolDefinition {
  const vendor = vendorById('anysearch')!
  return defineTool({
    name: 'silkroad_web_search',
    description: 'General web search through AnySearch (works without a key on a small daily free quota; the user can add a key in the 跨境电商 (SilkRoad) panel, 数据源 tab for more). Use it to find brand sites, news, regulations, supplier pages and anything market data sources do not cover.',
    parameters: {
      query: { type: 'string', required: true, description: 'Search query' },
      max_results: { type: 'integer', description: 'Number of results, 1 to 10 (default 5)' },
    },
    output: { schema: JSON_OUTPUT, render: (_args, value) => text(value) },
    async execute(args, exec) {
      const key = await keyOf(deps, vendor)
      const maxResults = Math.min(Math.max(Math.trunc(args.max_results ?? 5), 1), 10)
      try {
        const result = await requestJson({
          label: 'AnySearch', url: 'https://api.anysearch.com/v1/search', secrets: [key], signal: exec.signal,
          init: {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...key ? { authorization: `Bearer ${key}` } : {} },
            body: JSON.stringify({ query: args.query, max_results: maxResults }),
          },
          ...deps.fetchFn ? { fetchFn: deps.fetchFn } : {},
        }) as { code?: unknown; message?: unknown }
        // AnySearch reports some failures in the body with HTTP 200; success is code 0.
        if (result.code !== undefined && result.code !== 0) {
          const auth = result.code === 401 || result.code === 403
          throw new VendorError(auth ? 'auth' : 'upstream', `AnySearch error ${String(result.code)}: ${String(result.message ?? '')}`)
        }
        return asJson(result)
      } catch (error) { explain(vendor, error) }
    },
  })
}

export function vendorTools(deps: VendorToolDeps): ToolDefinition[] {
  return [serpApiTool(deps), anySearchTool(deps)]
}
