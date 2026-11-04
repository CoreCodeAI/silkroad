import { describe, expect, it } from 'vitest'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import { credentialRef } from '../src/keys.ts'
import { kalodataBase, kalodataDateRange, kalodataTools, RateGate } from '../src/vendors/kalodata.ts'
import { Hub } from '../src/hub.ts'
import { MemoryCredentials } from './fakes.ts'

async function run(tool: ToolDefinition, args: Record<string, unknown>) {
  const execute = (tool as unknown as { execute: (a: unknown, e: unknown) => Promise<unknown> }).execute
  return execute(args, { signal: new AbortController().signal })
}

async function setup(options: { key?: string; settings?: Record<string, string> } = { key: 'kd-key' }) {
  const credentials = new MemoryCredentials()
  if (options.key !== undefined) await credentials.set(credentialRef('SILKROAD_KALODATA_API_KEY'), options.key)
  const hub = new Hub(credentials, new Map())
  if (options.settings) await hub.setVendorSettings('kalodata', options.settings)
  const calls: { url: string; init?: RequestInit; body?: Record<string, unknown> }[] = []
  let reply = () => Response.json({ success: true, data: [{ product_id: '1', revenue: 1200 }], debug: { trace: 'x' } })
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init, ...typeof init?.body === 'string' ? { body: JSON.parse(init.body) as Record<string, unknown> } : {} })
    return reply()
  }) as typeof fetch
  const tools = Object.fromEntries(kalodataTools({ credentials, fetchFn, settings: id => hub.vendorSettings(id) }).map(tool => [tool.name, tool]))
  return { calls, tools, hub, setReply: (next: () => Response) => { reply = next } }
}

describe('silkroad_kalodata_rank', () => {
  it('posts the documented body to the production endpoint with the secret-key header', async () => {
    const { calls, tools } = await setup()
    const result = await run(tools.silkroad_kalodata_rank!, { entity: 'product', region: 'US', filters: { category_ids: ['601450'], unit_price_range: '10-30' }, sort_by: 'sales_volumn' })
    expect(calls[0]!.url).toBe('https://www.kalodata.com/openapi/v1/tiktok/product/rank')
    expect(calls[0]!.init?.method).toBe('POST')
    expect((calls[0]!.init?.headers as Record<string, string>)['secret-key']).toBe('kd-key')
    expect(calls[0]!.body).toEqual({
      region: 'US', language: 'zh-CN', currency: 'USD', date_range: 'last7Day',
      sort_field: { field: 'sales_volumn', type: 'DESC' }, page_size: 20, page_number: 1,
      category_ids: ['601450'], unit_price_range: '10-30',
    })
    expect(result).toEqual({ data: [{ product_id: '1', revenue: 1200 }] })
  })

  it('uses the language and currency saved in the panel', async () => {
    const { calls, tools } = await setup({ key: 'kd-key', settings: { language: 'en-US', currency: 'GBP' } })
    await run(tools.silkroad_kalodata_rank!, { entity: 'creator', region: 'GB', page_size: 500 })
    expect(calls[0]!.url).toBe('https://www.kalodata.com/openapi/v1/tiktok/creator/rank')
    expect(calls[0]!.body).toMatchObject({ language: 'en-US', currency: 'GBP', page_size: 100, sort_field: { field: 'revenue', type: 'DESC' } })
  })

  it('rejects undocumented filters and sort fields before calling Kalodata', async () => {
    const { calls, tools } = await setup()
    await expect(run(tools.silkroad_kalodata_rank!, { entity: 'shop', region: 'US', filters: { creator_id: '1' } })).rejects.toThrow(/shop ranking has no "creator_id"/)
    await expect(run(tools.silkroad_kalodata_rank!, { entity: 'video', region: 'US', sort_by: 'likes' })).rejects.toThrow(/sort field for video/)
    await expect(run(tools.silkroad_kalodata_rank!, { entity: 'product', region: 'CN' })).rejects.toThrow(/"region" must be one of/)
    await expect(run(tools.silkroad_kalodata_rank!, { entity: 'product', region: 'US', date_range: 'last90Day' })).rejects.toThrow(/Invalid Kalodata date_range/)
    expect(calls).toHaveLength(0)
  })

  it('asks for the key in the panel when none is saved, without calling Kalodata', async () => {
    const { calls, tools } = await setup({})
    await expect(run(tools.silkroad_kalodata_rank!, { entity: 'product', region: 'US' })).rejects.toThrow(/open-center\/account[\s\S]*Never ask for the key in chat/)
    expect(calls).toHaveLength(0)
  })

  it('reports success:false replies and rejected keys without leaking the key', async () => {
    const { tools, setReply } = await setup({ key: 'kd-secret' })
    setReply(() => Response.json({ success: false, code: 'CREDIT_NOT_ENOUGH', message: 'credit not enough' }))
    await expect(run(tools.silkroad_kalodata_detail!, { entity: 'product', id: '1', region: 'US' })).rejects.toThrow(/CREDIT_NOT_ENOUGH: credit not enough/)
    setReply(() => new Response('bad key kd-secret', { status: 401 }))
    const error = await run(tools.silkroad_kalodata_detail!, { entity: 'product', id: '1', region: 'US' }).then(() => undefined, cause => cause as Error)
    expect(error?.message).toContain('Kalodata rejected the key')
    expect(error?.message).not.toContain('kd-secret')
  })
})

describe('other Kalodata tools', () => {
  it('maps detail entities to their id field and documented options', async () => {
    const { calls, tools } = await setup()
    await run(tools.silkroad_kalodata_detail!, { entity: 'livestream', id: ' 77 ', region: 'ID', date_range: 'last90Day', options: { need_extra: true } })
    expect(calls[0]!.url).toBe('https://www.kalodata.com/openapi/v1/tiktok/livestream/detail')
    expect(calls[0]!.body).toMatchObject({ livestream_id: '77', region: 'ID', date_range: 'last90Day', need_extra: true })
    await expect(run(tools.silkroad_kalodata_detail!, { entity: 'category', id: '6', region: 'US', options: { need_extra: true } })).rejects.toThrow(/category detail has no "need_extra"/)
  })

  it('routes product insight kinds to their endpoints', async () => {
    const { calls, tools } = await setup()
    await run(tools.silkroad_kalodata_product_insight!, { kind: 'selling_points', product_id: 'p1', region: 'US' })
    await run(tools.silkroad_kalodata_product_insight!, { kind: 'review_insight', product_id: 'p1', region: 'US' })
    await run(tools.silkroad_kalodata_product_insight!, { kind: 'reviews', product_id: 'p1', region: 'TH', page_number: 2 })
    expect(calls.map(call => call.url.replace('https://www.kalodata.com/openapi/v1/', ''))).toEqual(['tiktok/product/analysis', 'tiktok/product/comment/insight', 'tiktok/product/comments'])
    expect(calls[0]!.body).toEqual({ product_id: 'p1', region: 'US', language: 'zh-CN' })
    expect(calls[1]!.body).toEqual({ product_id: 'p1', country_code: 'us' })
    expect(calls[2]!.body).toEqual({ product_id: 'p1', region: 'TH', page_number: 2, page_size: 100 })
    await expect(run(tools.silkroad_kalodata_product_insight!, { kind: 'reviews', product_id: 'p1', region: 'GB' })).rejects.toThrow(/region for reviews/)
  })

  it('fetches media and credit endpoints, with GET for the balance', async () => {
    const { calls, tools } = await setup()
    await run(tools.silkroad_kalodata_media!, { kind: 'creator_avatars', ids: ['a', 'b'] })
    await run(tools.silkroad_kalodata_credit!, { kind: 'balance' })
    await run(tools.silkroad_kalodata_credit!, { kind: 'logs', start_date: '2026-10-01', end_date: '2026-10-31' })
    expect(calls[0]!.body).toEqual({ creator_ids: ['a', 'b'] })
    expect(calls[1]!.url).toBe('https://www.kalodata.com/openapi/v1/credit/balance')
    expect(calls[1]!.init?.method).toBe('GET')
    expect(calls[2]!.body).toEqual({ startDate: '2026-10-01', endDate: '2026-10-31', pageNo: 1, pageSize: 20 })
    await expect(run(tools.silkroad_kalodata_media!, { kind: 'video_url', ids: ['v1', 'v2'] })).rejects.toThrow(/exactly one video_id/)
  })
})

describe('kalodata request checks', () => {
  it('accepts the date ranges each endpoint documents', () => {
    expect(kalodataDateRange(undefined, 'product', 'rank')).toBe('last7Day')
    expect(kalodataDateRange('2026-10', 'product', 'rank')).toBe('2026-10')
    expect(kalodataDateRange('2026-10-01~2026-10-30', 'video', 'rank')).toBe('2026-10-01~2026-10-30')
    expect(kalodataDateRange('last365Day', 'shop', 'detail')).toBe('last365Day')
    expect(kalodataDateRange('last180Day', 'category', 'rank')).toBe('last180Day')
    expect(() => kalodataDateRange('2026-10-01~2026-10-31', 'product', 'rank')).toThrow(/at most 30 days/)
    expect(() => kalodataDateRange('last90Day', 'product', 'rank')).toThrow(/Invalid Kalodata date_range/)
    expect(() => kalodataDateRange('2026-10', 'category', 'detail')).toThrow(/category endpoints accept/)
  })

  it('accepts https or a local test address only', () => {
    expect(kalodataBase('https://www.kalodata.com/')).toBe('https://www.kalodata.com')
    expect(kalodataBase('http://127.0.0.1:9000')).toBe('http://127.0.0.1:9000')
    for (const bad of ['', 'http://kalodata.example', 'https://user:pw@kalodata.example', 'https://kalodata.example/?a=1']) {
      expect(() => kalodataBase(bad), bad).toThrow(/API address setting is invalid/)
    }
  })

  it('rejects unsupported language and currency settings when saved', async () => {
    const { hub } = await setup()
    await expect(hub.setVendorSettings('kalodata', { currency: 'RMB' })).rejects.toThrow(/货币只能填/)
    await expect(hub.setVendorSettings('kalodata', { language: 'zh' })).rejects.toThrow(/数据语言只能填/)
  })

  it('waits for the documented per-endpoint rate window', async () => {
    let now = 0
    const waits: number[] = []
    const gate = new RateGate(() => now, async ms => { waits.push(ms); now += ms })
    for (let index = 0; index < 11; index++) await gate.wait('tiktok/product/rank')
    expect(waits).toEqual([10_000])
    for (let index = 0; index < 100; index++) await gate.wait('tiktok/product/detail')
    expect(waits).toHaveLength(1)
  })
})
