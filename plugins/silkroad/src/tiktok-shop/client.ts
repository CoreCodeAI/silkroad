/**
 * TikTok Shop Open Platform (Partner API, 202309 versions) for the seller's
 * own shops. The user brings their own app (App Key, App Secret, Service ID
 * from Partner Center) and authorizes their shops in the browser; tokens and
 * the app secret live in DSH's credential store.
 *
 * Authorization: the seller opens `<auth host>/open/authorize?service_id=…&state=…`;
 * TikTok redirects to the app's configured redirect URL with `code` and
 * `state`. That URL is fixed in Partner Center, so besides the loopback
 * callback the user can paste the redirected address (or the bare code) into
 * the panel.
 */
import { createHmac, randomBytes } from 'node:crypto'
import type { CredentialsLike } from '../credentials.ts'
import { credentialKey, credentialRef, OWNER } from '../keys.ts'
import { UserError } from '../hub-errors.ts'
import { MAX_RESULT_CHARS, redact } from '../vendors/http.ts'

export const API_BASE = 'https://open-api.tiktokglobalshop.com'
export const TOKEN_BASE = 'https://auth.tiktok-shops.com'
export const AUTHORIZE_HOSTS = {
  global: 'https://services.tiktokshop.com',
  us: 'https://services.us.tiktokshop.com',
} as const
export type ShopRegion = keyof typeof AUTHORIZE_HOSTS
export const APP_SECRET = 'SILKROAD_TIKTOK_SHOP_APP_SECRET'

/** Pending authorizations expire after this long. */
const PENDING_TTL_MS = 30 * 60 * 1000
/** Refresh the access token when it has less than this left. */
const REFRESH_LEAD_MS = 10 * 60 * 1000

/**
 * Request signature: HMAC-SHA256 (key = app secret, hex) over
 * `secret + path + sorted(key + value, excluding sign/access_token) + body + secret`.
 * Multipart bodies are not signed.
 */
export function sign(path: string, query: Record<string, string>, body: string, secret: string): string {
  const pairs = Object.keys(query).filter(key => key !== 'sign' && key !== 'access_token').sort().map(key => `${key}${query[key]}`).join('')
  return createHmac('sha256', secret).update(`${secret}${path}${pairs}${body}${secret}`).digest('hex')
}

export interface ShopInfo { id: string; name: string; region: string; cipher: string; code?: string }

interface Tokens {
  accessToken: string
  accessExpiresAt: number
  refreshToken: string
  refreshExpiresAt: number
  sellerName?: string
}

interface ShopRecord {
  version: 1
  appKey?: string
  serviceId?: string
  region?: ShopRegion
  tokens?: Tokens
  shops?: ShopInfo[]
  pending?: { state: string; createdAt: number }
}

export type ShopState = 'unconfigured' | 'disconnected' | 'awaiting-authorization' | 'connected' | 'expired'

export interface ShopStatus {
  id: 'tiktok-shop'
  title: string
  state: ShopState
  appKey: string
  serviceId: string
  region: ShopRegion
  secretConfigured: boolean
  writable: boolean
  sellerName?: string
  shops: { id: string; name: string; region: string }[]
  accessExpiresAt?: number
  /** Loopback address the user may register as the app's redirect URL. */
  callbackUrl?: string
  error?: string
}

export class TikTokShopApiError extends Error {
  constructor(readonly code: number | string, message: string, readonly requestId?: string) { super(message) }
}

export interface TikTokShopOptions {
  credentials: CredentialsLike
  fetchFn?: typeof fetch
  now?: () => number
  openBrowser?: (url: string) => void | Promise<void>
  callbackUrl?: () => string | undefined
}

export class TikTokShop {
  private readonly key = credentialKey(OWNER, 'tiktok-shop')
  private readonly fetchFn: typeof fetch
  private readonly now: () => number
  private queue: Promise<unknown> = Promise.resolve()
  private lastError: string | undefined

  constructor(private readonly options: TikTokShopOptions) {
    this.fetchFn = options.fetchFn ?? fetch
    this.now = options.now ?? Date.now
  }

  private serial<T>(task: () => Promise<T>): Promise<T> {
    const next = this.queue.then(task, task)
    this.queue = next.catch(() => undefined)
    return next
  }

  private async read(): Promise<ShopRecord> {
    const record = await this.options.credentials.readRecord(this.key)
    const payload = record?.kind === 'grant' ? record.payload as ShopRecord | undefined : undefined
    return payload && payload.version === 1 ? payload : { version: 1 }
  }

  private async update(change: (current: ShopRecord) => ShopRecord): Promise<ShopRecord> {
    let next: ShopRecord = { version: 1 }
    await this.options.credentials.modifyRecord(this.key, async current => {
      const payload = current?.kind === 'grant' && (current.payload as ShopRecord | undefined)?.version === 1 ? current.payload as ShopRecord : { version: 1 as const }
      next = change(payload)
      return { kind: 'grant', payload: next }
    })
    return next
  }

  private async secret(): Promise<string | undefined> {
    return (await this.options.credentials.resolve(credentialRef(APP_SECRET)))?.value || undefined
  }

  async status(): Promise<ShopStatus> {
    const record = await this.read()
    const info = await this.options.credentials.describe(credentialRef(APP_SECRET))
    const now = this.now()
    let state: ShopState
    if (!record.appKey || !record.serviceId || !info.configured) state = 'unconfigured'
    else if (record.tokens && record.tokens.refreshExpiresAt > now) state = 'connected'
    else if (record.tokens) state = 'expired'
    else if (record.pending && now - record.pending.createdAt < PENDING_TTL_MS) state = 'awaiting-authorization'
    else state = 'disconnected'
    let callbackUrl: string | undefined
    try { callbackUrl = this.options.callbackUrl?.() } catch { callbackUrl = undefined }
    return {
      id: 'tiktok-shop', title: 'TikTok Shop 店铺', state,
      appKey: record.appKey ?? '', serviceId: record.serviceId ?? '', region: record.region ?? 'global',
      secretConfigured: info.configured, writable: info.writable,
      ...record.tokens?.sellerName ? { sellerName: record.tokens.sellerName } : {},
      shops: (record.shops ?? []).map(({ id, name, region }) => ({ id, name, region })),
      ...record.tokens ? { accessExpiresAt: record.tokens.accessExpiresAt } : {},
      ...callbackUrl ? { callbackUrl } : {},
      ...this.lastError && state !== 'connected' ? { error: this.lastError } : {},
    }
  }

  async configure(values: unknown): Promise<void> {
    if (!values || typeof values !== 'object') throw new UserError(400, 'Settings must be an object.')
    const { appKey, serviceId, region } = values as Record<string, unknown>
    for (const [label, value] of [['App Key', appKey], ['Service ID', serviceId]] as const) {
      if (value !== undefined && (typeof value !== 'string' || value.length > 128 || /\s/.test(value.trim()))) throw new UserError(400, `${label} 格式不对。`)
    }
    if (region !== undefined && region !== 'global' && region !== 'us') throw new UserError(400, '授权地区只能是 global 或 us。')
    await this.serial(() => this.update(current => {
      const next: ShopRecord = { ...current }
      if (typeof appKey === 'string') next.appKey = appKey.trim()
      if (typeof serviceId === 'string') next.serviceId = serviceId.trim()
      if (region) next.region = region as ShopRegion
      // Tokens belong to the app that issued them.
      if (current.appKey && next.appKey !== current.appKey) { delete next.tokens; delete next.shops; delete next.pending }
      return next
    }))
  }

  async setSecret(value: unknown): Promise<void> {
    if (typeof value !== 'string' || !value.trim()) throw new UserError(400, 'App Secret 是空的。')
    if (value.length > 512) throw new UserError(400, 'App Secret 太长了。')
    await this.options.credentials.set(credentialRef(APP_SECRET), value.trim())
  }

  async clearSecret(): Promise<void> {
    await this.options.credentials.unset(credentialRef(APP_SECRET))
  }

  /** Start a shop authorization in the user's browser. */
  beginAuthorization(): Promise<{ authorizationUrl: string }> {
    return this.serial(async () => {
      const record = await this.read()
      if (!record.appKey || !record.serviceId || !await this.secret()) throw new UserError(400, '请先填写 App Key、Service ID 和 App Secret。')
      const state = randomBytes(16).toString('base64url')
      await this.update(current => ({ ...current, pending: { state, createdAt: this.now() } }))
      const url = new URL('/open/authorize', AUTHORIZE_HOSTS[record.region ?? 'global'])
      url.searchParams.set('service_id', record.serviceId)
      url.searchParams.set('state', state)
      this.lastError = undefined
      await this.options.openBrowser?.(url.href)
      return { authorizationUrl: url.href }
    })
  }

  /**
   * Finish an authorization with what the user has: the full redirected
   * address, a query string, or the bare code. A `state` that is present must
   * match the pending one.
   */
  completeAuthorization(input: { code?: unknown; state?: unknown; pasted?: unknown }): Promise<ShopStatus> {
    return this.serial(async () => {
      let code = typeof input.code === 'string' ? input.code.trim() : ''
      let state = typeof input.state === 'string' ? input.state : undefined
      if (typeof input.pasted === 'string' && input.pasted.trim()) {
        const text = input.pasted.trim()
        if (/[?&]code=/.test(text) || /^https?:\/\//.test(text)) {
          const params = new URLSearchParams(text.includes('?') ? text.slice(text.indexOf('?') + 1) : text)
          code = params.get('code') ?? ''
          state = params.get('state') ?? undefined
        } else {
          code = text
        }
      }
      if (!code || code.length > 2048) throw new UserError(400, '没有找到授权码（code）。请粘贴授权后浏览器跳转到的完整地址。')
      const record = await this.read()
      const pending = record.pending
      if (!pending || this.now() - pending.createdAt > PENDING_TTL_MS) throw new UserError(400, '没有进行中的授权，或者已经超过 30 分钟。请在面板里重新点「授权店铺」。')
      if (state !== undefined && state !== pending.state) throw new UserError(400, '授权结果和发起的授权不匹配（state 不一致），已拒绝。请重新授权。')
      const secret = await this.secret()
      if (!record.appKey || !secret) throw new UserError(400, '应用配置不完整。')
      try {
        const tokens = await this.tokenRequest('/api/v2/token/get', { app_key: record.appKey, app_secret: secret, auth_code: code, grant_type: 'authorized_code' }, secret)
        await this.update(current => ({ ...current, tokens, pending: undefined }))
        const shops = await this.fetchShops()
        await this.update(current => ({ ...current, shops }))
        this.lastError = undefined
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : String(error)
        throw error instanceof UserError ? error : new UserError(502, `换取 token 失败：${this.lastError}`)
      }
      return this.status()
    })
  }

  async disconnect(): Promise<void> {
    await this.serial(() => this.update(current => ({ version: 1, appKey: current.appKey, serviceId: current.serviceId, region: current.region })))
    this.lastError = undefined
  }

  private async tokenRequest(path: string, params: Record<string, string>, secret: string): Promise<Tokens> {
    const url = new URL(path, TOKEN_BASE)
    for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value)
    const response = await this.fetchFn(url, { method: 'GET', signal: AbortSignal.timeout(30_000) })
    const text = await response.text()
    let body: { code?: number; message?: string; data?: Record<string, unknown>; request_id?: string }
    try { body = JSON.parse(text) } catch { throw new TikTokShopApiError(response.status, redact(`HTTP ${response.status}: ${text.slice(0, 300)}`, [secret])) }
    if (!response.ok || body.code !== 0 || !body.data) {
      throw new TikTokShopApiError(body.code ?? response.status, redact(body.message ?? `HTTP ${response.status}`, [secret, params.refresh_token ?? '', params.auth_code ?? '']), body.request_id)
    }
    const data = body.data
    if (typeof data.access_token !== 'string' || typeof data.refresh_token !== 'string') throw new TikTokShopApiError('token', 'Token response is missing tokens.')
    return {
      accessToken: data.access_token,
      accessExpiresAt: Number(data.access_token_expire_in) * 1000,
      refreshToken: data.refresh_token,
      refreshExpiresAt: Number(data.refresh_token_expire_in) * 1000,
      ...typeof data.seller_name === 'string' ? { sellerName: data.seller_name } : {},
    }
  }

  /** A valid access token, refreshed when close to expiry. */
  private async accessToken(): Promise<{ token: string; appKey: string; secret: string }> {
    const record = await this.read()
    const secret = await this.secret()
    if (!record.appKey || !secret) throw new UserError(400, 'TikTok Shop 应用还没有配置。请让用户在左侧栏「跨境电商」面板的「数据源」里填写 App Key、App Secret 和 Service ID，再授权店铺。')
    const tokens = record.tokens
    if (!tokens) throw new UserError(400, 'TikTok Shop 店铺还没有授权。请让用户在左侧栏「跨境电商」面板的「数据源」里点「授权店铺」。')
    const now = this.now()
    if (tokens.accessExpiresAt - now > REFRESH_LEAD_MS) return { token: tokens.accessToken, appKey: record.appKey, secret }
    if (tokens.refreshExpiresAt <= now) throw new UserError(401, 'TikTok Shop 授权已过期。请让用户在面板里重新授权店铺。')
    const fresh = await this.tokenRequest('/api/v2/token/refresh', { app_key: record.appKey, app_secret: secret, refresh_token: tokens.refreshToken, grant_type: 'refresh_token' }, secret)
    await this.update(current => ({ ...current, tokens: { ...fresh, sellerName: fresh.sellerName ?? tokens.sellerName } }))
    return { token: fresh.accessToken, appKey: record.appKey, secret }
  }

  /** Must run inside `serial`. */
  private async fetchShops(): Promise<ShopInfo[]> {
    const data = await this.send(await this.accessToken(), 'GET', '/authorization/202309/shops', {}, undefined, undefined) as { shops?: Record<string, unknown>[] }
    return (data.shops ?? []).map(shop => ({
      id: String(shop.id), name: String(shop.name ?? shop.id), region: String(shop.region ?? ''), cipher: String(shop.cipher ?? ''),
      ...shop.code ? { code: String(shop.code) } : {},
    }))
  }

  /** Authorized shops; refreshed from the API when asked to. */
  async shops(refresh = false): Promise<ShopInfo[]> {
    if (refresh) {
      return this.serial(async () => {
        const shops = await this.fetchShops()
        await this.update(current => ({ ...current, shops }))
        return shops
      })
    }
    return (await this.read()).shops ?? []
  }

  /** Resolve a shop by id, name or code; the only shop when omitted. */
  async shop(selector?: string): Promise<ShopInfo> {
    const shops = await this.shops()
    if (!shops.length) throw new UserError(400, '没有已授权的店铺。请让用户在面板里授权店铺。')
    if (!selector) {
      if (shops.length === 1) return shops[0]!
      throw new UserError(400, `授权了多个店铺，请指定 shop：${shops.map(s => `${s.name} (${s.id})`).join('、')}`)
    }
    const found = shops.find(s => s.id === selector || s.code === selector || s.name.toLowerCase() === selector.toLowerCase())
    if (!found) throw new UserError(400, `找不到店铺 ${selector}。已授权：${shops.map(s => `${s.name} (${s.id})`).join('、')}`)
    return found
  }

  /** One signed Partner API call; returns `data`. */
  async call(method: 'GET' | 'POST', path: string, query: Record<string, string | number | undefined>, body: unknown, shopCipher: string | undefined, signal?: AbortSignal): Promise<unknown> {
    return this.send(await this.serial(() => this.accessToken()), method, path, query, body, shopCipher, signal)
  }

  private async send(auth: { token: string; appKey: string; secret: string }, method: 'GET' | 'POST', path: string, query: Record<string, string | number | undefined>, body: unknown, shopCipher: string | undefined, signal?: AbortSignal): Promise<unknown> {
    const { token, appKey, secret } = auth
    const params: Record<string, string> = { app_key: appKey, timestamp: String(Math.floor(this.now() / 1000)) }
    for (const [name, value] of Object.entries(query)) if (value !== undefined && value !== '') params[name] = String(value)
    if (shopCipher) params.shop_cipher = shopCipher
    const text = method === 'POST' ? JSON.stringify(body ?? {}) : ''
    params.sign = sign(path, params, text, secret)
    const url = new URL(path, API_BASE)
    for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value)
    const response = await this.fetchFn(url, {
      method,
      headers: { 'x-tts-access-token': token, 'content-type': 'application/json' },
      ...method === 'POST' ? { body: text } : {},
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60_000)]) : AbortSignal.timeout(60_000),
    })
    const raw = await response.text()
    let parsed: { code?: number; message?: string; data?: unknown; request_id?: string }
    try { parsed = JSON.parse(raw) } catch { throw new TikTokShopApiError(response.status, redact(`HTTP ${response.status}: ${raw.slice(0, 300)}`, [token, secret])) }
    if (parsed.code !== 0) {
      throw new TikTokShopApiError(parsed.code ?? response.status, redact(`TikTok Shop API ${path} failed (code ${parsed.code ?? response.status}): ${parsed.message ?? 'unknown error'}`, [token, secret]), parsed.request_id)
    }
    return parsed.data ?? {}
  }
}

/** Trim a result for the model, keeping valid JSON-able output. */
export function forModel(value: unknown): unknown {
  const text = JSON.stringify(value)
  if (text.length <= MAX_RESULT_CHARS) return value
  return { truncated: true, note: `Result was ${text.length} characters; ask for a smaller page_size or narrower filters.`, preview: text.slice(0, MAX_RESULT_CHARS) }
}
