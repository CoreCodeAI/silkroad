import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { describe, expect, it } from 'vitest'
import { credentialRef } from '../src/keys.ts'
import { callbackUrl, createCallbackHandler, managementRoutes } from '../src/http.ts'
import { Hub } from '../src/hub.ts'
import type { OAuthMcpConnector } from '../src/connectors/oauth-connector.ts'
import { MemoryCredentials } from './fakes.ts'

function fakeConnector(log: string[]): OAuthMcpConnector {
  return {
    id: 'fastmoss',
    status: () => ({ id: 'fastmoss', title: 'FastMoss', summary: '', kind: 'oauth-mcp', state: 'disconnected', toolPrefix: 'mcp__fastmoss__' }),
    beginLogin: async () => { log.push('login'); return { authorizationUrl: 'https://example.test/authorize', state: 'awaiting-browser' } },
    completeLogin: async (params: { code?: string; state?: string }) => {
      log.push(`complete:${params.code}:${params.state}`)
      if (params.state !== 'good') throw new Error('The login response did not match.')
    },
    logout: async () => { log.push('logout') },
  } as unknown as OAuthMcpConnector
}

function routesOf(hub: Hub) {
  const routes = new Map(managementRoutes(hub).map(route => [route.path, route]))
  return (path: string, body?: unknown) => {
    const route = routes.get(path)
    if (!route) throw new Error(`no route ${path}`)
    return route.fetch(new Request(`http://127.0.0.1${path}`, body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }))
  }
}

describe('management routes', () => {
  it('report status without ever returning key values', async () => {
    const credentials = new MemoryCredentials()
    await credentials.set(credentialRef('SILKROAD_SERPAPI_API_KEY'), 'secret-123')
    const call = routesOf(new Hub(credentials, new Map([['fastmoss', fakeConnector([])]])))
    const response = await call('/api/silkroad/status')
    const text = await response.text()
    expect(response.status).toBe(200)
    expect(text).not.toContain('secret-123')
    const status = JSON.parse(text)
    expect(status.vendors.find((v: { id: string }) => v.id === 'serpapi').state).toBe('configured')
    expect(status.vendors.find((v: { id: string }) => v.id === 'anysearch').state).toBe('anonymous')
    expect(status.connectors[0].state).toBe('disconnected')
  })

  it('store and clear vendor keys, rejecting empty values and unknown vendors', async () => {
    const credentials = new MemoryCredentials()
    const call = routesOf(new Hub(credentials, new Map()))
    expect((await call('/api/silkroad/vendors/key', { id: 'serpapi', value: '  k-1  ' })).status).toBe(200)
    expect(credentials.values.get('SILKROAD_SERPAPI_API_KEY')).toBe('k-1')
    expect((await call('/api/silkroad/vendors/key', { id: 'serpapi', value: ' ' })).status).toBe(400)
    expect((await call('/api/silkroad/vendors/key', { id: 'nope', value: 'x' })).status).toBe(404)
    expect((await call('/api/silkroad/vendors/clear', { id: 'serpapi' })).status).toBe(200)
    expect(credentials.values.has('SILKROAD_SERPAPI_API_KEY')).toBe(false)
  })

  it('start and end OAuth logins', async () => {
    const log: string[] = []
    const call = routesOf(new Hub(new MemoryCredentials(), new Map([['fastmoss', fakeConnector(log)]])))
    const login = await (await call('/api/silkroad/connectors/login', { id: 'fastmoss' })).json()
    expect(login.authorizationUrl).toBe('https://example.test/authorize')
    expect((await call('/api/silkroad/connectors/logout', { id: 'fastmoss' })).status).toBe(200)
    expect((await call('/api/silkroad/connectors/login', {})).status).toBe(400)
    expect(log).toEqual(['login', 'logout'])
  })
})

describe('OAuth callback route', () => {
  it('passes code and state to the connector and reports the outcome as a page', async () => {
    const log: string[] = []
    const handler = createCallbackHandler(new Hub(new MemoryCredentials(), new Map([['fastmoss', fakeConnector(log)]])))
    const server = createServer((req, res) => { void handler(req, res) })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const port = (server.address() as AddressInfo).port
    try {
      const ok = await fetch(`${callbackUrl('127.0.0.1', port, 'fastmoss')}?code=c1&state=good`)
      expect(ok.status).toBe(200)
      expect(await ok.text()).toContain('登录成功')
      const bad = await fetch(`${callbackUrl('127.0.0.1', port, 'fastmoss')}?code=c2&state=forged`)
      expect(bad.status).toBe(400)
      expect(log).toEqual(['complete:c1:good', 'complete:c2:forged'])
    } finally {
      await new Promise(resolve => server.close(resolve))
    }
  })

  it('builds loopback redirect URIs, bracketing IPv6', () => {
    expect(callbackUrl('127.0.0.1', 51234, 'fastmoss')).toBe('http://127.0.0.1:51234/silkroad/oauth/callback/fastmoss')
    expect(callbackUrl('::1', 8080, 'fastmoss')).toBe('http://[::1]:8080/silkroad/oauth/callback/fastmoss')
  })
})
