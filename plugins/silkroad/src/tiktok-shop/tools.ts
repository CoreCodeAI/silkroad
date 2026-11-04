/**
 * Model-facing tools for the user's own TikTok Shop (Partner API 202309).
 * All tools only read; nothing here changes the shop or messages a buyer.
 * Parameter names follow TikTok Shop's API so its documentation applies.
 */
import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'
import { modelText } from '../vendors/http.ts'
import { forModel, type TikTokShop } from './client.ts'

const JSON_OUTPUT = { type: 'json' } as const
const asJson = (value: unknown) => JSON.parse(JSON.stringify(value ?? null)) as never
const render = (_args: unknown, value: unknown) => [{ type: 'text' as const, text: modelText(value) }]
const SHOP = { type: 'string', description: 'Shop id, code or name; may be omitted when only one shop is authorized' } as const

/** `YYYY-MM-DD` or a Unix timestamp → Unix seconds. */
export function unixSeconds(value: string | number | undefined): number | undefined {
  if (value === undefined || value === '') return undefined
  if (typeof value === 'number' || /^\d+$/.test(value)) {
    const n = Number(value)
    return n > 1e12 ? Math.floor(n / 1000) : n
  }
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) throw new Error(`Not a date: ${value}`)
  return Math.floor(ms / 1000)
}

const clamp = (value: number | undefined, fallback: number, max: number) => Math.min(Math.max(Math.trunc(value ?? fallback), 1), max)

/** Paths the generic read tool may call: versioned Partner API paths only. */
const PATH = /^\/[a-z_]+\/\d{6}\/[A-Za-z0-9_\-/]+$/

export function tiktokShopTools(shop: TikTokShop): ToolDefinition[] {
  return [
    defineTool({
      name: 'silkroad_tts_shops',
      description: 'List the TikTok Shop shops the user authorized in the SilkRoad panel (id, name, region). Call first when the user has several shops.',
      parameters: { refresh: { type: 'boolean', description: 'Re-read the list from TikTok Shop instead of the saved one' } },
      output: { schema: JSON_OUTPUT, render },
      async execute(args) {
        const shops = await shop.shops(args.refresh === true)
        return asJson({ shops: shops.map(({ id, name, region, code }) => ({ id, name, region, code })) })
      },
    }),
    defineTool({
      name: 'silkroad_tts_orders',
      description: 'Read orders of the user\'s TikTok Shop. With ids returns full order details (up to 50); otherwise searches by status and time window, newest first. Times accept YYYY-MM-DD or Unix seconds.',
      parameters: {
        shop: SHOP,
        ids: { type: 'array', items: { type: 'string' }, description: 'Order ids to fetch in detail' },
        order_status: { type: 'string', enum: ['UNPAID', 'ON_HOLD', 'AWAITING_SHIPMENT', 'PARTIALLY_SHIPPING', 'AWAITING_COLLECTION', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'CANCELLED'], description: 'Filter by status' },
        create_time_ge: { type: 'string', description: 'Created at or after' },
        create_time_lt: { type: 'string', description: 'Created before' },
        update_time_ge: { type: 'string', description: 'Updated at or after' },
        page_size: { type: 'integer', description: '1 to 100, default 20' },
        page_token: { type: 'string', description: 'next_page_token from the previous page' },
      },
      output: { schema: JSON_OUTPUT, render },
      async execute(args, exec) {
        const target = await shop.shop(args.shop)
        if (args.ids?.length) {
          return asJson(forModel(await shop.call('GET', '/order/202309/orders', { ids: args.ids.slice(0, 50).join(',') }, undefined, target.cipher, exec.signal)))
        }
        const body = Object.fromEntries(Object.entries({
          order_status: args.order_status,
          create_time_ge: unixSeconds(args.create_time_ge),
          create_time_lt: unixSeconds(args.create_time_lt),
          update_time_ge: unixSeconds(args.update_time_ge),
        }).filter(([, value]) => value !== undefined))
        const query = { page_size: clamp(args.page_size, 20, 100), page_token: args.page_token, sort_field: 'create_time', sort_order: 'DESC' }
        return asJson(forModel(await shop.call('POST', '/order/202309/orders/search', query, body, target.cipher, exec.signal)))
      },
    }),
    defineTool({
      name: 'silkroad_tts_products',
      description: 'Read products of the user\'s TikTok Shop. With product_id returns that product in full (title, description, SKUs, prices, stock, images, status); otherwise lists products by status.',
      parameters: {
        shop: SHOP,
        product_id: { type: 'string', description: 'One product to read in full' },
        status: { type: 'string', enum: ['ALL', 'DRAFT', 'PENDING', 'FAILED', 'ACTIVATE', 'SELLER_DEACTIVATED', 'PLATFORM_DEACTIVATED', 'FREEZE', 'DELETED'], description: 'Filter for listing, default ALL' },
        seller_skus: { type: 'array', items: { type: 'string' }, description: 'Filter by seller SKU codes' },
        page_size: { type: 'integer', description: '1 to 100, default 20' },
        page_token: { type: 'string', description: 'next_page_token from the previous page' },
      },
      output: { schema: JSON_OUTPUT, render },
      async execute(args, exec) {
        const target = await shop.shop(args.shop)
        if (args.product_id) {
          if (!/^\d+$/.test(args.product_id)) throw new Error('product_id must be digits.')
          return asJson(forModel(await shop.call('GET', `/product/202309/products/${args.product_id}`, {}, undefined, target.cipher, exec.signal)))
        }
        const body = { status: args.status ?? 'ALL', ...args.seller_skus?.length ? { seller_skus: args.seller_skus } : {} }
        return asJson(forModel(await shop.call('POST', '/product/202309/products/search', { page_size: clamp(args.page_size, 20, 100), page_token: args.page_token }, body, target.cipher, exec.signal)))
      },
    }),
    defineTool({
      name: 'silkroad_tts_messages',
      description: 'Read buyer conversations from the user\'s TikTok Shop customer service inbox. Without conversation_id lists recent conversations; with it returns that conversation\'s messages. Read only: replies are drafted for the user, who sends them in Seller Center.',
      parameters: {
        shop: SHOP,
        conversation_id: { type: 'string', description: 'Conversation to read messages from' },
        page_size: { type: 'integer', description: 'Conversations 1 to 20 (default 20); messages 1 to 10 (default 10)' },
        page_token: { type: 'string', description: 'next_page_token from the previous page' },
        locale: { type: 'string', description: 'Locale for system text, e.g. en-US' },
      },
      output: { schema: JSON_OUTPUT, render },
      async execute(args, exec) {
        const target = await shop.shop(args.shop)
        if (args.conversation_id) {
          if (!/^[A-Za-z0-9_-]+$/.test(args.conversation_id)) throw new Error('conversation_id has unexpected characters.')
          const query = { page_size: clamp(args.page_size, 10, 10), page_token: args.page_token, locale: args.locale, sort_order: 'DESC', sort_field: 'create_time' }
          return asJson(forModel(await shop.call('GET', `/customer_service/202309/conversations/${args.conversation_id}/messages`, query, undefined, target.cipher, exec.signal)))
        }
        return asJson(forModel(await shop.call('GET', '/customer_service/202309/conversations', { page_size: clamp(args.page_size, 20, 20), page_token: args.page_token, locale: args.locale }, undefined, target.cipher, exec.signal)))
      },
    }),
    defineTool({
      name: 'silkroad_tts_returns',
      description: 'Search return and refund requests of the user\'s TikTok Shop, by order ids, status or time window.',
      parameters: {
        shop: SHOP,
        order_ids: { type: 'array', items: { type: 'string' }, description: 'Limit to these orders' },
        return_status: { type: 'array', items: { type: 'string' }, description: 'TikTok Shop return status values, e.g. RETURN_OR_REFUND_REQUEST_PENDING' },
        create_time_ge: { type: 'string', description: 'Created at or after (YYYY-MM-DD or Unix seconds)' },
        create_time_lt: { type: 'string', description: 'Created before' },
        page_size: { type: 'integer', description: '1 to 50, default 20' },
        page_token: { type: 'string', description: 'next_page_token from the previous page' },
      },
      output: { schema: JSON_OUTPUT, render },
      async execute(args, exec) {
        const target = await shop.shop(args.shop)
        const body = Object.fromEntries(Object.entries({
          order_ids: args.order_ids?.length ? args.order_ids : undefined,
          return_status: args.return_status?.length ? args.return_status : undefined,
          create_time_ge: unixSeconds(args.create_time_ge),
          create_time_lt: unixSeconds(args.create_time_lt),
        }).filter(([, value]) => value !== undefined))
        return asJson(forModel(await shop.call('POST', '/return_refund/202309/returns/search', { page_size: clamp(args.page_size, 20, 50), page_token: args.page_token }, body, target.cipher, exec.signal)))
      },
    }),
    defineTool({
      name: 'silkroad_tts_api',
      description: 'Read-only escape hatch for other TikTok Shop Partner API endpoints the dedicated tools do not cover (see partner.tiktokshop.com docs). GET any versioned path, or POST to a path ending in /search. Never use it to change the shop.',
      parameters: {
        shop: SHOP,
        method: { type: 'string', required: true, enum: ['GET', 'POST'], description: 'POST only for /search endpoints' },
        path: { type: 'string', required: true, description: 'Versioned API path, e.g. /product/202309/categories' },
        query: { type: 'object', additionalProperties: true, description: 'Query parameters other than app_key, timestamp, sign, shop_cipher' },
        body: { type: 'object', additionalProperties: true, description: 'JSON body for a /search POST' },
        shop_scoped: { type: 'boolean', description: 'Send the shop cipher (default true)' },
      },
      output: { schema: JSON_OUTPUT, render },
      async execute(args, exec) {
        if (!PATH.test(args.path) || args.path.includes('..')) throw new Error('path must look like /<module>/<version>/<resource>.')
        if (args.method === 'POST' && !args.path.endsWith('/search')) throw new Error('Only /search endpoints may be POSTed; this tool never changes the shop.')
        const query: Record<string, string> = {}
        for (const [name, value] of Object.entries(args.query ?? {})) {
          if (['app_key', 'timestamp', 'sign', 'shop_cipher', 'access_token', 'app_secret'].includes(name) || value === null || value === undefined) continue
          query[name] = typeof value === 'object' ? JSON.stringify(value) : String(value)
        }
        const cipher = args.shop_scoped === false ? undefined : (await shop.shop(args.shop)).cipher
        return asJson(forModel(await shop.call(args.method as 'GET' | 'POST', args.path, query, args.method === 'POST' ? args.body ?? {} : undefined, cipher, exec.signal)))
      },
    }),
  ]
}
