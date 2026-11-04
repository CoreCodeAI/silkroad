import { describe, expect, it } from 'vitest'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import { credentialRef } from '../src/keys.ts'
import { anySearchTool, serpApiTool } from '../src/vendors/tools.ts'
import { MAX_RESULT_CHARS, modelText, redact } from '../src/vendors/http.ts'
import { MemoryCredentials } from './fakes.ts'

type Call = { url: string; init: RequestInit | undefined }

function recordingFetch(calls: Call[], reply: (url: string) => Response): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init })
    return reply(url)
  }) as typeof fetch
}

/** Runs a tool's validated execute path the way the registry does, minus the pipeline. */
async function run(tool: ToolDefinition, args: Record<string, unknown>): Promise<unknown> {
  const execute = (tool as unknown as { execute: (args: unknown, exec: unknown) => Promise<unknown> }).execute
  return execute(args, { signal: new AbortController().signal })
}

describe('silkroad_serpapi_search', () => {
  it('sends engine parameters with the stored key and strips request metadata from the result', async () => {
    const credentials = new MemoryCredentials()
    await credentials.set(credentialRef('SILKROAD_SERPAPI_API_KEY'), 'serp-key')
    const calls: Call[] = []
    const tool = serpApiTool({ credentials, fetchFn: recordingFetch(calls, () => Response.json({ search_metadata: { id: 1 }, search_parameters: {}, interest_over_time: { timeline_data: [1, 2] } })) })
    const result = await run(tool, { engine: 'google_trends', q: 'yoga mat', params: { geo: 'US', date: 'today 12-m', api_key: 'injected' } }) as Record<string, unknown>
    const url = new URL(calls[0]!.url)
    expect(url.origin + url.pathname).toBe('https://serpapi.com/search.json')
    expect(url.searchParams.get('engine')).toBe('google_trends')
    expect(url.searchParams.get('q')).toBe('yoga mat')
    expect(url.searchParams.get('geo')).toBe('US')
    expect(url.searchParams.get('api_key')).toBe('serp-key')
    expect(result).toEqual({ interest_over_time: { timeline_data: [1, 2] } })
  })

  it('refuses to run without a key and points the user to the panel', async () => {
    const tool = serpApiTool({ credentials: new MemoryCredentials(), fetchFn: recordingFetch([], () => Response.json({})) })
    await expect(run(tool, { engine: 'google' })).rejects.toThrow(/SilkRoad\) panel/)
  })

  it('never leaks the key in an upstream error', async () => {
    const credentials = new MemoryCredentials()
    await credentials.set(credentialRef('SILKROAD_SERPAPI_API_KEY'), 'serp-key')
    const tool = serpApiTool({ credentials, fetchFn: recordingFetch([], url => new Response(`bad request for ${url}`, { status: 401 })) })
    const error = await run(tool, { engine: 'google', q: 'x' }).catch(e => e as Error)
    expect(String(error)).not.toContain('serp-key')
    expect(String(error)).toMatch(/rejected/)
  })
})

describe('silkroad_web_search', () => {
  it('works anonymously and clamps max_results', async () => {
    const calls: Call[] = []
    const tool = anySearchTool({ credentials: new MemoryCredentials(), fetchFn: recordingFetch(calls, () => Response.json({ code: 0, data: { results: [] } })) })
    await run(tool, { query: 'tiktok shop fees', max_results: 50 })
    expect(calls[0]!.url).toBe('https://api.anysearch.com/v1/search')
    expect(JSON.parse(String(calls[0]!.init!.body))).toEqual({ query: 'tiktok shop fees', max_results: 10 })
    expect(new Headers(calls[0]!.init!.headers).has('authorization')).toBe(false)
  })

  it('sends the key when one is stored and surfaces body-level errors', async () => {
    const credentials = new MemoryCredentials()
    await credentials.set(credentialRef('SILKROAD_ANYSEARCH_API_KEY'), 'any-key')
    const calls: Call[] = []
    const tool = anySearchTool({ credentials, fetchFn: recordingFetch(calls, () => Response.json({ code: 429, message: 'quota' })) })
    await expect(run(tool, { query: 'x' })).rejects.toThrow(/429/)
    expect(new Headers(calls[0]!.init!.headers).get('authorization')).toBe('Bearer any-key')
  })
})

describe('helpers', () => {
  it('redacts raw and URL-encoded secrets', () => {
    expect(redact('a=k+1&b=k%2B1', ['k+1'])).toBe('a=***&b=***')
  })
  it('caps model text with an explicit marker', () => {
    const text = modelText('x'.repeat(MAX_RESULT_CHARS + 100))
    expect(text.length).toBeLessThan(MAX_RESULT_CHARS + 200)
    expect(text).toMatch(/truncated/)
  })
})
