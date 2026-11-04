/**
 * Kalodata Open API (https://www.kalodata.com/open-center/docs), reached with
 * the user's own key. Every endpoint is `POST <base>/openapi/v1/...` with a JSON
 * body and the key in the `secret-key` header, except `credit/balance` (GET).
 * Calls cost Kalodata credits (detail 0.1, rank 0.1 per 100 rows returned,
 * review insight 1, video URL 0.5, images 0.01, credit queries free), so the
 * tool descriptions state the cost and the skills ask before deep dives.
 *
 * Parameter names follow the Kalodata docs. Filters and sort fields are
 * checked against the documented lists so a wrong name fails with the allowed
 * names instead of being silently ignored by the API.
 */
import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'
import { credentialRef } from '../keys.ts'
import { vendorById } from './catalog.ts'
import { modelText, requestJson, VendorError } from './http.ts'
import type { VendorToolDeps } from './tools.ts'

const PANEL = 'the 跨境电商 (SilkRoad) panel in the left sidebar, 数据源 tab'
/** Header name from the Kalodata docs ("在请求头中进行 secret-key 认证"). */
export const KALODATA_KEY_HEADER = 'secret-key'

export const KALODATA_REGIONS = ['US', 'BR', 'MX', 'ID', 'JP', 'MY', 'PH', 'SG', 'TH', 'VN', 'GB', 'ES', 'DE', 'FR', 'IT', 'PL', 'NL', 'BE', 'CZ', 'AT', 'GR', 'PT', 'HU', 'IE'] as const
export const KALODATA_LANGUAGES = ['zh-CN', 'en-US', 'id-ID', 'th-TH', 'vi-VN', 'es-ES', 'ja-JP', 'pt-BR', 'ko-KR', 'fr-FR', 'de-DE', 'pl-PL', 'nl-NL', 'cs-CZ', 'el-GR', 'hu-HU', 'pt-PT', 'it-IT'] as const
export const KALODATA_CURRENCIES = ['CNY', 'USD', 'IDR', 'VND', 'THB', 'MYR', 'JPY', 'PHP', 'GBP', 'SGD', 'MXN', 'EUR', 'BRL', 'PLN', 'CZK', 'HUF'] as const
/** Regions `tiktok/product/comments` serves (first phase, per the docs). */
export const KALODATA_REVIEW_REGIONS = ['US', 'SG', 'ID', 'TH', 'VN', 'PH', 'MY'] as const

export const KALODATA_ENTITIES = ['product', 'shop', 'creator', 'video', 'livestream', 'category'] as const
export type KalodataEntity = typeof KALODATA_ENTITIES[number]

interface EntitySpec {
  /** Path segment under /openapi/v1/tiktok/. */
  segment: string
  idField: string
  /** Documented `sort_field.field` values; the first is the default. */
  sorts: readonly string[]
  rankFilters: readonly string[]
  detailOptions: readonly string[]
  /** Category endpoints accept only named ranges (no natural days or months). */
  namedRangesOnly?: boolean
}

export const KALODATA_SPECS: Record<KalodataEntity, EntitySpec> = {
  product: {
    segment: 'product', idField: 'product_id',
    sorts: ['revenue', 'commission_rate', 'revenue_growth_rate', 'sales_volumn', 'unit_price', 'launch_date', 'live_revenue', 'video_revenue', 'showcase_revenue', 'product_id', 'product_name'],
    rankFilters: ['category_ids', 'shop_id', 'creator_id', 'video_id', 'livestream_id', 'revenue_range', 'is_affiliate', 'commission_rate', 'is_tts_product', 'unit_price_range', 'need_all', 'delivery_type', 'launch_date', 'need_image', 'keyword', 'need_extra'],
    detailOptions: ['need_image', 'need_extra'],
  },
  shop: {
    segment: 'shop', idField: 'shop_id',
    sorts: ['revenue', 'sales_volumn', 'revenue_growth_rate', 'unit_price', 'shop_type', 'affiliate_revenue', 'self_promotion_revenue', 'shopping_mall_revenue', 'on_sell_product_count', 'rank', 'shop_id', 'shop_name'],
    rankFilters: ['category_ids', 'revenue_range', 'shop_type', 'keyword', 'need_image', 'need_category', 'unit_price_range'],
    detailOptions: ['category_ids', 'need_extra'],
  },
  creator: {
    segment: 'creator', idField: 'creator_id',
    sorts: ['revenue', 'revenue_growth_rate', 'content_views', 'creator_followers', 'sales_volumn', 'video_revenue', 'live_revenue', 'creator_id', 'creator_nickname', 'creator_handle'],
    rankFilters: ['category_ids', 'category_id_list', 'shop_id', 'product_id', 'revenue_range', 'creator_type', 'followers_range', 'engagement_rate', 'keyword', 'need_image', 'need_category', 'need_ter_category'],
    detailOptions: ['category_ids', 'shop_id', 'need_extra'],
  },
  video: {
    segment: 'video', idField: 'video_id',
    sorts: ['revenue', 'views', 'revenue_growth_rate', 'ads_roas', 'video_id', 'video_title', 'belonged_creator_id', 'belonged_creator_handle'],
    rankFilters: ['category_ids', 'shop_id', 'creator_id', 'product_id', 'revenue_range', 'followers_range', 'ads_roas', 'keyword', 'is_ai_video', 'views_range', 'publish_date_range'],
    detailOptions: ['need_extra'],
  },
  livestream: {
    segment: 'livestream', idField: 'livestream_id',
    sorts: ['revenue', 'unit_price', 'views', 'livestream_start_time', 'livestream_end_time', 'livestream_duration', 'livestream_id', 'livestream_title', 'creator_id', 'creator_handle'],
    rankFilters: ['category_ids', 'shop_id', 'creator_id', 'product_id', 'followers_range', 'keyword'],
    detailOptions: ['need_extra'],
  },
  category: {
    segment: 'category', idField: 'category_id',
    sorts: ['revenue', 'revenue_growth_rate', 'top3_shop_revenue_ratio', 'average_revenue', 'rank', 'category_id', 'category_name'],
    rankFilters: ['category_ids', 'category_level', 'revenue_range'],
    detailOptions: [],
    namedRangesOnly: true,
  },
}

/** Requests per 10 seconds, per endpoint, from the docs. */
const RATE_LIMITS: Record<string, number> = {
  'tiktok/creator/detail': 500,
  'tiktok/product/detail': 100, 'tiktok/shop/detail': 100, 'tiktok/video/detail': 100, 'tiktok/livestream/detail': 100, 'tiktok/category/detail': 100,
  'tiktok/product/analysis': 100, 'tiktok/product/comment/insight': 100,
}
const DEFAULT_RATE_LIMIT = 10
const RATE_WINDOW_MS = 10_000

const NAMED_RANGES = ['lastDay', 'last7Day', 'last30Day', 'last60Day', 'last90Day', 'last180Day', 'last365Day'] as const
const RANK_NAMED_RANGES = ['lastDay', 'last7Day', 'last30Day'] as const
const CATEGORY_RANGES = ['last7Day', 'last30Day', 'last90Day', 'last180Day', 'last365Day'] as const
const DAY = 86_400_000

function bad(message: string): never { throw new VendorError('bad-request', message) }

function pick<T extends string>(value: string | undefined, allowed: readonly T[], label: string): T {
  const hit = allowed.find(item => item.toLowerCase() === (value ?? '').trim().toLowerCase())
  return hit ?? bad(`Invalid Kalodata ${label} "${value ?? ''}". Use one of: ${allowed.join(', ')}.`)
}

/**
 * Check a `date_range` against what the endpoint accepts.
 * @param kind - `rank` (window up to 30 days) or `detail`.
 * @returns the range, unchanged.
 */
export function kalodataDateRange(value: string | undefined, entity: KalodataEntity, kind: 'rank' | 'detail'): string {
  const range = (value ?? 'last7Day').trim()
  if (KALODATA_SPECS[entity].namedRangesOnly) {
    if ((CATEGORY_RANGES as readonly string[]).includes(range)) return range
    bad(`Kalodata category endpoints accept date_range ${CATEGORY_RANGES.join(', ')} only.`)
  }
  const named = kind === 'rank' ? RANK_NAMED_RANGES : NAMED_RANGES
  if ((named as readonly string[]).includes(range)) return range
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(range)) return range
  const days = /^(\d{4}-\d{2}-\d{2})~(\d{4}-\d{2}-\d{2})$/.exec(range)
  if (days) {
    const start = Date.parse(`${days[1]}T00:00:00Z`)
    const end = Date.parse(`${days[2]}T00:00:00Z`)
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      if (kind === 'rank' && (end - start) / DAY + 1 > 30) bad('Kalodata rankings cover at most 30 days; shorten the yyyy-MM-dd~yyyy-MM-dd range.')
      return range
    }
  }
  bad(`Invalid Kalodata date_range "${range}". Use ${named.join(', ')}, a natural month yyyy-MM, or days yyyy-MM-dd~yyyy-MM-dd${kind === 'rank' ? ' (at most 30 days)' : ''}.`)
}

/** Only documented names pass, so a typo cannot be silently dropped by the API. */
function checkedFields(values: Record<string, unknown> | undefined, allowed: readonly string[], label: string): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [name, value] of Object.entries(values ?? {})) {
    if (value === null || value === undefined || value === '') continue
    if (!allowed.includes(name)) bad(`Kalodata ${label} has no "${name}". Allowed: ${allowed.length ? allowed.join(', ') : 'none'}.`)
    out[name] = value
  }
  return out
}

/** The configured base URL (https, no credentials, query or hash), without a trailing slash. */
export function kalodataBase(value: string | undefined): string {
  const base = (value ?? '').trim().replace(/\/+$/, '')
  let url: URL | undefined
  try { url = new URL(base) } catch { url = undefined }
  const local = url?.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost')
  if (!url || (url.protocol !== 'https:' && !local) || url.search || url.hash || url.username || url.password) {
    throw new VendorError('missing-key', `The Kalodata API address setting is invalid. Ask the user to reset it to https://www.kalodata.com under Kalodata in ${PANEL}.`)
  }
  return base
}

/** Per-endpoint sliding window that waits instead of tripping Kalodata's rate limit. */
export class RateGate {
  private readonly calls = new Map<string, number[]>()
  constructor(private readonly now: () => number = Date.now, private readonly sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
    const onAbort = () => { clearTimeout(timer); reject(signal?.reason) }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve() }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })) {}

  async wait(endpoint: string, signal?: AbortSignal): Promise<void> {
    const limit = RATE_LIMITS[endpoint] ?? DEFAULT_RATE_LIMIT
    for (;;) {
      const now = this.now()
      const recent = (this.calls.get(endpoint) ?? []).filter(time => now - time < RATE_WINDOW_MS)
      if (recent.length < limit) {
        recent.push(now)
        this.calls.set(endpoint, recent)
        return
      }
      this.calls.set(endpoint, recent)
      await this.sleep(recent[0]! + RATE_WINDOW_MS - now, signal)
    }
  }
}

export interface KalodataDeps extends VendorToolDeps {
  settings: (id: string) => Promise<Record<string, string>>
  gate?: RateGate
}

interface KalodataReply { success?: unknown; data?: unknown; message?: unknown; code?: unknown; debug?: unknown; cached?: unknown }

function client(deps: KalodataDeps) {
  const vendor = vendorById('kalodata')!
  const gate = deps.gate ?? new RateGate()
  return {
    async defaults() {
      const settings = await deps.settings('kalodata')
      return { language: settings.language ?? 'zh-CN', currency: settings.currency ?? 'USD', base: kalodataBase(settings.baseUrl) }
    },
    /** Call `/openapi/v1/<endpoint>`; returns `data` (plus `cached` when Kalodata reports it). */
    async call(endpoint: string, body: Record<string, unknown> | undefined, signal: AbortSignal, base: string): Promise<unknown> {
      const hit = await deps.credentials.resolve(credentialRef(vendor.credential))
      const key = hit?.value
      if (!key) throw new VendorError('missing-key', `Kalodata has no API key yet. Ask the user to generate one at ${vendor.signup} and save it under Kalodata in ${PANEL}. Never ask for the key in chat.`)
      await gate.wait(endpoint, signal)
      let reply: KalodataReply
      try {
        reply = await requestJson({
          label: 'Kalodata', url: `${base}/openapi/v1/${endpoint}`, secrets: [key], signal,
          init: body === undefined
            ? { method: 'GET', headers: { [KALODATA_KEY_HEADER]: key, accept: 'application/json' } }
            : { method: 'POST', headers: { [KALODATA_KEY_HEADER]: key, accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(body) },
          ...deps.fetchFn ? { fetchFn: deps.fetchFn } : {},
        }) as KalodataReply
      } catch (error) {
        if (error instanceof VendorError && error.kind === 'auth') {
          throw new VendorError('auth', `${error.message}\nKalodata rejected the key. Ask the user to check or replace it under Kalodata in ${PANEL}.`)
        }
        throw error
      }
      if (reply.success === false) {
        const detail = [reply.code, reply.message].filter(part => typeof part === 'string' && part).join(': ')
        throw new VendorError('upstream', `Kalodata ${endpoint} failed${detail ? ` (${detail})` : ''}. Calls that fail are not charged. If the message is about the key or credits, ask the user to check their key or top up at https://www.kalodata.com/open-center/account; for an unknown id or empty result say there is no data instead of guessing.`)
      }
      const result = reply.cached === undefined ? { data: reply.data ?? null } : { data: reply.data ?? null, cached: reply.cached }
      return JSON.parse(JSON.stringify(result)) as unknown
    },
  }
}

const OUTPUT = { schema: { type: 'json' as const }, render: (_args: unknown, value: unknown) => [{ type: 'text' as const, text: modelText(value) }] }

const ENTITY_PARAM = { type: 'string', required: true, enum: KALODATA_ENTITIES, description: 'What to query: product, shop, creator, video, livestream or category' } as const
const REGION_PARAM = { type: 'string', required: true, enum: KALODATA_REGIONS, description: 'TikTok Shop market (country code). Ask the user when they have not said which market.' } as const
const LOCALE_PARAMS = {
  language: { type: 'string', enum: KALODATA_LANGUAGES, description: 'Language of text fields (default from the 数据源 settings, normally zh-CN)' },
  currency: { type: 'string', enum: KALODATA_CURRENCIES, description: 'Currency of revenue and price fields (default from the 数据源 settings, normally USD)' },
} as const

function filterGuide(kind: 'rankFilters' | 'detailOptions'): string {
  return KALODATA_ENTITIES.map(entity => `${entity}: ${KALODATA_SPECS[entity][kind].join(', ') || '(none)'}`).join('; ')
}

/** `silkroad_kalodata_rank`: the six ranking endpoints. */
export function kalodataRankTool(deps: KalodataDeps): ToolDefinition {
  const kalodata = client(deps)
  return defineTool({
    name: 'silkroad_kalodata_rank',
    description: 'TikTok Shop rankings from Kalodata with the user\'s own key: products, shops, creators, videos, livestreams or categories in one market, with filters and sorting. Costs 0.1 Kalodata credit per 100 rows returned. '
      + 'Ranges use the docs\' syntax: "1-10", "<10", ">1000". Filters by entity — ' + filterGuide('rankFilters') + '. '
      + 'Notes: category_ids are Kalodata category ids (get them from entity=category); is_affiliate/is_tts_product/is_ai_video take 1 or 0; delivery_type is local or global; launch_date and publish_date_range are relative days like "<7"; creator_type is BELONGED_TO_SELLER or INDEPENDENT; engagement_rate is LOW, MEDIUM or HIGH; shop_type is BRAND or RETAILER; category_level is 1, 2 or 3. '
      + 'Sort fields by entity — ' + KALODATA_ENTITIES.map(entity => `${entity}: ${KALODATA_SPECS[entity].sorts.join(', ')}`).join('; ') + '.',
    parameters: {
      entity: ENTITY_PARAM,
      region: REGION_PARAM,
      date_range: { type: 'string', description: 'lastDay, last7Day (default) or last30Day; a natural month yyyy-MM; or days yyyy-MM-dd~yyyy-MM-dd up to 30 days. Categories accept only last7Day, last30Day, last90Day, last180Day, last365Day.' },
      sort_by: { type: 'string', description: 'Sort field for the entity (default revenue)' },
      sort_order: { type: 'string', enum: ['DESC', 'ASC'], description: 'Default DESC' },
      page_size: { type: 'integer', description: '1 to 100 rows (default 20)' },
      page_number: { type: 'integer', description: 'Page, starting at 1' },
      filters: { type: 'object', additionalProperties: true, description: 'Documented filters for the entity, by their Kalodata names, e.g. {"category_ids":["601450"],"unit_price_range":"10-30"}' },
      ...LOCALE_PARAMS,
    },
    output: OUTPUT,
    async execute(args, exec) {
      const entity = pick(args.entity, KALODATA_ENTITIES, 'entity')
      const spec = KALODATA_SPECS[entity]
      const sortBy = args.sort_by ? pick(args.sort_by, spec.sorts, `sort field for ${entity}`) : spec.sorts[0]!
      const pageSize = Math.min(Math.max(Math.trunc(args.page_size ?? 20), 1), 100)
      const { language, currency, base } = await kalodata.defaults()
      const body = {
        region: pick(args.region, KALODATA_REGIONS, 'region'),
        language: pick(args.language ?? language, KALODATA_LANGUAGES, 'language'),
        currency: pick(args.currency ?? currency, KALODATA_CURRENCIES, 'currency'),
        date_range: kalodataDateRange(args.date_range, entity, 'rank'),
        sort_field: { field: sortBy, type: args.sort_order === 'ASC' ? 'ASC' : 'DESC' },
        page_size: pageSize,
        page_number: Math.max(Math.trunc(args.page_number ?? 1), 1),
        ...checkedFields(args.filters, spec.rankFilters, `${entity} ranking`),
      }
      return kalodata.call(`tiktok/${spec.segment}/rank`, body, exec.signal, base) as never
    },
  })
}

/** `silkroad_kalodata_detail`: the six detail endpoints. */
export function kalodataDetailTool(deps: KalodataDeps): ToolDefinition {
  const kalodata = client(deps)
  return defineTool({
    name: 'silkroad_kalodata_detail',
    description: 'Full metrics for one TikTok Shop product, shop, creator, video, livestream or category from Kalodata, including the revenue trend over the date range and revenue split by channel. Costs 0.1 Kalodata credit per call. '
      + 'Options by entity — ' + filterGuide('detailOptions') + ' (need_image: 1 = official image link; need_extra: true adds extra fields such as seller name; category_ids/shop_id limit revenue attribution).',
    parameters: {
      entity: ENTITY_PARAM,
      id: { type: 'string', required: true, description: 'The product_id, shop_id, creator_id, video_id, livestream_id or category_id (from a ranking or the user). Never guess an id from a URL.' },
      region: REGION_PARAM,
      date_range: { type: 'string', description: 'last7Day (default), last30Day, last60Day, last90Day, last180Day, last365Day, lastDay; a month yyyy-MM; or days yyyy-MM-dd~yyyy-MM-dd. Categories accept only last7Day, last30Day, last90Day, last180Day, last365Day.' },
      options: { type: 'object', additionalProperties: true, description: 'Documented options for the entity, e.g. {"need_extra":true}' },
      ...LOCALE_PARAMS,
    },
    output: OUTPUT,
    async execute(args, exec) {
      const entity = pick(args.entity, KALODATA_ENTITIES, 'entity')
      const spec = KALODATA_SPECS[entity]
      const id = String(args.id ?? '').trim()
      if (!id) bad(`Kalodata ${entity} detail needs ${spec.idField}.`)
      const { language, currency, base } = await kalodata.defaults()
      const body = {
        region: pick(args.region, KALODATA_REGIONS, 'region'),
        language: pick(args.language ?? language, KALODATA_LANGUAGES, 'language'),
        currency: pick(args.currency ?? currency, KALODATA_CURRENCIES, 'currency'),
        date_range: kalodataDateRange(args.date_range, entity, 'detail'),
        [spec.idField]: id,
        ...checkedFields(args.options, spec.detailOptions, `${entity} detail`),
      }
      return kalodata.call(`tiktok/${spec.segment}/detail`, body, exec.signal, base) as never
    },
  })
}

/** `silkroad_kalodata_product_insight`: selling points, review insight and raw reviews. */
export function kalodataProductInsightTool(deps: KalodataDeps): ToolDefinition {
  const kalodata = client(deps)
  return defineTool({
    name: 'silkroad_kalodata_product_insight',
    description: 'What buyers and the listing say about one TikTok Shop product, from Kalodata. kind=selling_points: cached selling-point keywords and attributes (0.1 credit; when not cached yet Kalodata starts generating it and the call fails without charge, so try again later). '
      + 'kind=review_insight: cached review insight such as pain points, positives and usage scenarios (1 credit, charged again only after the insight is refreshed, about every two weeks). '
      + `kind=reviews: original reviews, newest first, up to 100 per page (free; markets ${KALODATA_REVIEW_REGIONS.join(', ')} only).`,
    parameters: {
      kind: { type: 'string', required: true, enum: ['selling_points', 'review_insight', 'reviews'], description: 'Which insight to fetch' },
      product_id: { type: 'string', required: true, description: 'TikTok product id' },
      region: REGION_PARAM,
      language: { type: 'string', enum: KALODATA_LANGUAGES, description: 'selling_points only: language of keywords and attributes (default from settings)' },
      page_number: { type: 'integer', description: 'reviews only: page, starting at 1' },
      page_size: { type: 'integer', description: 'reviews only: 1 to 100 (default 100)' },
    },
    output: OUTPUT,
    async execute(args, exec) {
      const productId = String(args.product_id ?? '').trim()
      if (!productId) bad('Kalodata product insight needs product_id.')
      const region = pick(args.region, KALODATA_REGIONS, 'region')
      const { language, base } = await kalodata.defaults()
      switch (args.kind) {
        case 'selling_points':
          return kalodata.call('tiktok/product/analysis', { product_id: productId, region, language: pick(args.language ?? language, KALODATA_LANGUAGES, 'language') }, exec.signal, base) as never
        case 'review_insight':
          return kalodata.call('tiktok/product/comment/insight', { product_id: productId, country_code: region.toLowerCase() }, exec.signal, base) as never
        case 'reviews': {
          const reviewRegion = pick(region, KALODATA_REVIEW_REGIONS, 'region for reviews')
          const pageSize = Math.min(Math.max(Math.trunc(args.page_size ?? 100), 1), 100)
          return kalodata.call('tiktok/product/comments', { product_id: productId, region: reviewRegion, page_number: Math.max(Math.trunc(args.page_number ?? 1), 1), page_size: pageSize }, exec.signal, base) as never
        }
        default:
          return bad('kind must be selling_points, review_insight or reviews.')
      }
    },
  })
}

/** `silkroad_kalodata_media`: signed product image, creator avatar and video URLs. */
export function kalodataMediaTool(deps: KalodataDeps): ToolDefinition {
  const kalodata = client(deps)
  return defineTool({
    name: 'silkroad_kalodata_media',
    description: 'Signed media URLs from Kalodata that expire after about 5 minutes, so use or download them right away and never put them in a report as lasting links. kind=product_images: all images of one product (0.01 credit). kind=creator_avatars: avatars for up to 100 creator ids (0.1 credit). kind=video_url: the video file of one TikTok video (0.5 credit).',
    parameters: {
      kind: { type: 'string', required: true, enum: ['product_images', 'creator_avatars', 'video_url'], description: 'Which media' },
      ids: { type: 'array', items: { type: 'string' }, required: true, description: 'One product_id or video_id; or up to 100 creator ids' },
    },
    output: OUTPUT,
    async execute(args, exec) {
      const ids = (args.ids ?? []).map(id => String(id).trim()).filter(Boolean)
      if (!ids.length) bad('Kalodata media needs at least one id.')
      const { base } = await kalodata.defaults()
      switch (args.kind) {
        case 'product_images':
          if (ids.length !== 1) bad('product_images takes exactly one product_id.')
          return kalodata.call('tiktok/product/images', { product_id: ids[0] }, exec.signal, base) as never
        case 'video_url':
          if (ids.length !== 1) bad('video_url takes exactly one video_id.')
          return kalodata.call('tiktok/video/url', { video_id: ids[0] }, exec.signal, base) as never
        case 'creator_avatars':
          if (ids.length > 100) bad('creator_avatars takes at most 100 creator ids per call.')
          return kalodata.call('tiktok/creator/avatar-images', { creator_ids: ids }, exec.signal, base) as never
        default:
          return bad('kind must be product_images, creator_avatars or video_url.')
      }
    },
  })
}

/** `silkroad_kalodata_credit`: credit balance and consumption log (free). */
export function kalodataCreditTool(deps: KalodataDeps): ToolDefinition {
  const kalodata = client(deps)
  return defineTool({
    name: 'silkroad_kalodata_credit',
    description: 'The user\'s Kalodata credit balance (kind=balance) or consumption log between two dates (kind=logs). Free. Check the balance before a multi-call analysis and tell the user the expected cost.',
    parameters: {
      kind: { type: 'string', required: true, enum: ['balance', 'logs'], description: 'balance or logs' },
      start_date: { type: 'string', description: 'logs only: yyyy-MM-dd' },
      end_date: { type: 'string', description: 'logs only: yyyy-MM-dd' },
      page_number: { type: 'integer', description: 'logs only: page, starting at 1' },
      page_size: { type: 'integer', description: 'logs only: 1 to 100' },
    },
    output: OUTPUT,
    async execute(args, exec) {
      const { base } = await kalodata.defaults()
      if (args.kind === 'balance') return kalodata.call('credit/balance', undefined, exec.signal, base) as never
      if (args.kind !== 'logs') bad('kind must be balance or logs.')
      const date = /^\d{4}-\d{2}-\d{2}$/
      if (!date.test(args.start_date ?? '') || !date.test(args.end_date ?? '')) bad('Kalodata credit logs need start_date and end_date as yyyy-MM-dd.')
      return kalodata.call('credit/logs', {
        startDate: args.start_date, endDate: args.end_date,
        pageNo: Math.max(Math.trunc(args.page_number ?? 1), 1),
        pageSize: Math.min(Math.max(Math.trunc(args.page_size ?? 20), 1), 100),
      }, exec.signal, base) as never
    },
  })
}

/** All Kalodata tools, sharing one rate gate. */
export function kalodataTools(deps: KalodataDeps): ToolDefinition[] {
  const shared = { ...deps, gate: deps.gate ?? new RateGate() }
  return [kalodataRankTool(shared), kalodataDetailTool(shared), kalodataProductInsightTool(shared), kalodataMediaTool(shared), kalodataCreditTool(shared)]
}
