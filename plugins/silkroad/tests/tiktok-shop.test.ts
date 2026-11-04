import { describe, expect, it } from 'vitest'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import { sign, TikTokShop } from '../src/tiktok-shop/client.ts'
import { tiktokShopTools, unixSeconds } from '../src/tiktok-shop/tools.ts'
import { MemoryCredentials } from './fakes.ts'

const NOW = 1_700_000_000_000

async function run(tool: ToolDefinition, args: Record<string, unknown>) {
  const execute = (tool as unknown as { execute: (a: unknown, e: unknown) => Promise<unknown> }).execute
  return execute(args, { signal: new AbortController().signal }) as Promise<Record<string, unknown>>
}

function fakeTikTok(options: { accessExpiresIn?: number } = {}) {
  const calls: { url: URL; init?: RequestInit }[] = []
  let issued = 0
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input))
    calls.push({ url, init })
    if (url.hostname === 'auth.tiktok-shops.com') {
      issued += 1
      return Response.json({ code: 0, message: 'success', data: {
        access_token: `AT${issued}`, access_token_expire_in: NOW / 1000 + (options.accessExpiresIn ?? 7 * 86400),
        refresh_token: `RT${issued}`, refresh_token_expire_in: NOW / 1000 + 365 * 86400, seller_name: 'Acme Store',
      } })
    }
    const body = init?.body ? String(init.body) : ''
    const query = Object.fromEntries(url.searchParams)
    const expected = sign(url.pathname, query, body, 'app-secret')
    if (query.sign !== expected) return Response.json({ code: 106001, message: 'Invalid sign' })
    if (url.pathname === '/authorization/202309/shops') return Response.json({ code: 0, data: { shops: [{ id: '7001', name: 'Acme US', region: 'US', cipher: 'CIPHER1', code: 'USLC1' }] } })
    if (url.pathname === '/order/202309/orders/search') return Response.json({ code: 0, data: { orders: [{ id: 'O1', status: 'COMPLETED' }], total_count: 1 } })
    return Response.json({ code: 40006, message: 'not found' })
  }) as typeof fetch
  return { calls, fetchFn }
}

async function connectedShop(options: { accessExpiresIn?: number } = {}) {
  const credentials = new MemoryCredentials()
  const fake = fakeTikTok(options)
  let now = NOW
  const opened: string[] = []
  const shop = new TikTokShop({ credentials, fetchFn: fake.fetchFn, now: () => now, openBrowser: url => { opened.push(url) } })
  await shop.configure({ appKey: 'app-key', serviceId: 'svc-1', region: 'us' })
  await shop.setSecret('app-secret')
  const { authorizationUrl } = await shop.beginAuthorization()
  const state = new URL(authorizationUrl).searchParams.get('state')!
  return { shop, fake, opened, authorizationUrl, state, credentials, advance: (ms: number) => { now += ms } }
}

describe('TikTok Shop signing', () => {
  it('matches an independently computed HMAC-SHA256 vector', () => {
    const query = { app_key: 'k1', timestamp: '1700000000', shop_cipher: 'C1', page_size: '20', sign: 'ignored', access_token: 'ignored' }
    expect(sign('/order/202309/orders/search', query, '{"order_status":"COMPLETED"}', 'secret'))
      .toBe('ec5357ff9b0c4b3d3c1d70fc2211bba471b9bc698bafb91ca0dc04d6650d200c')
  })

  it('parses dates and timestamps to Unix seconds', () => {
    expect(unixSeconds('2024-01-02')).toBe(Date.parse('2024-01-02') / 1000)
    expect(unixSeconds('1700000000')).toBe(1700000000)
    expect(unixSeconds(1700000000123)).toBe(1700000000)
  })
})

describe('TikTok Shop authorization', () => {
  it('opens the regional authorize page and completes from a pasted redirect address', async () => {
    const { shop, opened, authorizationUrl, state, fake } = await connectedShop()
    expect(authorizationUrl).toMatch(/^https:\/\/services\.us\.tiktokshop\.com\/open\/authorize\?service_id=svc-1&state=/)
    expect(opened).toEqual([authorizationUrl])
    expect((await shop.status()).state).toBe('awaiting-authorization')

    const status = await shop.completeAuthorization({ pasted: `https://example.com/cb?code=AUTH1&state=${state}` })
    expect(status.state).toBe('connected')
    expect(status.sellerName).toBe('Acme Store')
    expect(status.shops).toEqual([{ id: '7001', name: 'Acme US', region: 'US' }])
    const token = fake.calls.find(call => call.url.pathname === '/api/v2/token/get')!
    expect(token.url.searchParams.get('auth_code')).toBe('AUTH1')
    expect(token.url.searchParams.get('grant_type')).toBe('authorized_code')
    const shops = fake.calls.find(call => call.url.pathname === '/authorization/202309/shops')!
    expect(new Headers(shops.init!.headers).get('x-tts-access-token')).toBe('AT1')
    expect(shops.url.searchParams.has('access_token')).toBe(false)
    expect(JSON.stringify(status)).not.toContain('AT1')
  })

  it('rejects a mismatched state and an authorization without one pending', async () => {
    const { shop } = await connectedShop()
    await expect(shop.completeAuthorization({ pasted: 'https://example.com/cb?code=X&state=forged' })).rejects.toThrow(/state/)
    await shop.disconnect()
    await expect(shop.completeAuthorization({ pasted: 'BARECODE' })).rejects.toThrow(/没有进行中的授权/)
  })

  it('refuses to authorize before the app is configured', async () => {
    const shop = new TikTokShop({ credentials: new MemoryCredentials(), fetchFn: fakeTikTok().fetchFn })
    expect((await shop.status()).state).toBe('unconfigured')
    await expect(shop.beginAuthorization()).rejects.toThrow(/App Key/)
  })
})

describe('TikTok Shop tools', () => {
  it('searches orders with a signed, shop-scoped request', async () => {
    const { shop, state, fake } = await connectedShop()
    await shop.completeAuthorization({ pasted: `?code=AUTH1&state=${state}` })
    const tools = tiktokShopTools(shop)
    const orders = tools.find(tool => tool.name === 'silkroad_tts_orders')!
    const result = await run(orders, { order_status: 'COMPLETED', create_time_ge: '2023-11-01', page_size: 500 })
    expect(result).toEqual({ orders: [{ id: 'O1', status: 'COMPLETED' }], total_count: 1 })
    const call = fake.calls.at(-1)!
    expect(call.url.searchParams.get('shop_cipher')).toBe('CIPHER1')
    expect(call.url.searchParams.get('page_size')).toBe('100')
    expect(JSON.parse(String(call.init!.body))).toEqual({ order_status: 'COMPLETED', create_time_ge: Date.parse('2023-11-01') / 1000 })
  })

  it('refreshes an access token that is about to expire', async () => {
    const { shop, state, fake } = await connectedShop({ accessExpiresIn: 60 })
    await shop.completeAuthorization({ pasted: `?code=AUTH1&state=${state}` })
    await run(tiktokShopTools(shop).find(tool => tool.name === 'silkroad_tts_orders')!, {})
    expect(fake.calls.some(call => call.url.pathname === '/api/v2/token/refresh' && call.url.searchParams.get('refresh_token') === 'RT1')).toBe(true)
    expect(new Headers(fake.calls.at(-1)!.init!.headers).get('x-tts-access-token')).toMatch(/^AT[23]$/)
  })

  it('keeps the generic tool read-only', async () => {
    const { shop, state } = await connectedShop()
    await shop.completeAuthorization({ pasted: `?code=AUTH1&state=${state}` })
    const api = tiktokShopTools(shop).find(tool => tool.name === 'silkroad_tts_api')!
    await expect(run(api, { method: 'POST', path: '/product/202309/products' })).rejects.toThrow(/search/)
    await expect(run(api, { method: 'GET', path: '../../etc' })).rejects.toThrow(/path/)
    await expect(run(api, { method: 'GET', path: '/product/202309/unknown' })).rejects.toThrow(/code 40006/)
  })

  it('tells the model to ask the user to connect when nothing is authorized', async () => {
    const shop = new TikTokShop({ credentials: new MemoryCredentials(), fetchFn: fakeTikTok().fetchFn })
    await expect(run(tiktokShopTools(shop).find(tool => tool.name === 'silkroad_tts_orders')!, {})).rejects.toThrow(/授权/)
  })
})
