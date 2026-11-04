import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { OAuthMcpConnector, type McpMount } from '../src/connectors/oauth-connector.ts'
import { MemoryCredentials } from './fakes.ts'

/** A minimal MCP authorization server with dynamic registration, PKCE (S256) and refresh tokens. */
function mockAuthServer() {
  const clients = new Map<string, { redirect_uris: string[] }>()
  const codes = new Map<string, { challenge: string; client: string; redirect: string }>()
  let issued = 0
  let base = ''
  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', base)
    const send = (status: number, body: unknown) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)) }
    let raw = ''
    req.on('data', chunk => { raw += chunk })
    req.on('end', () => {
      if (url.pathname === '/.well-known/oauth-protected-resource/mcp') return send(200, { resource: `${base}/mcp`, authorization_servers: [base] })
      if (url.pathname === '/.well-known/oauth-authorization-server') {
        return send(200, {
          issuer: base, authorization_endpoint: `${base}/oauth/authorize`, token_endpoint: `${base}/oauth/token`,
          registration_endpoint: `${base}/oauth/register`, response_types_supported: ['code'],
          grant_types_supported: ['authorization_code', 'refresh_token'], code_challenge_methods_supported: ['S256'],
          token_endpoint_auth_methods_supported: ['none'],
        })
      }
      if (url.pathname === '/oauth/register' && req.method === 'POST') {
        const meta = JSON.parse(raw) as { redirect_uris: string[] }
        const id = `client-${clients.size + 1}`
        clients.set(id, meta)
        return send(201, { ...meta, client_id: id })
      }
      if (url.pathname === '/oauth/token' && req.method === 'POST') {
        const form = new URLSearchParams(raw)
        if (form.get('grant_type') === 'authorization_code') {
          const entry = codes.get(form.get('code') ?? '')
          const verifier = form.get('code_verifier') ?? ''
          const challenge = createHash('sha256').update(verifier).digest('base64url')
          if (!entry || entry.challenge !== challenge || entry.client !== form.get('client_id')) return send(400, { error: 'invalid_grant' })
          codes.delete(form.get('code') ?? '')
        } else if (form.get('grant_type') !== 'refresh_token' || !form.get('refresh_token')?.startsWith('refresh-')) {
          return send(400, { error: 'invalid_grant' })
        }
        issued += 1
        return send(200, { access_token: `access-${issued}`, token_type: 'Bearer', expires_in: 3600, refresh_token: `refresh-${issued}` })
      }
      send(404, { error: 'not_found' })
    })
  })
  return {
    server, clients, issued: () => issued,
    async listen() { await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`; return base },
    /** What the browser + user consent would produce: a code bound to the PKCE challenge in the URL. */
    approve(authorizationUrl: string) {
      const url = new URL(authorizationUrl)
      const code = `code-${codes.size + 1}-${Date.now()}`
      codes.set(code, { challenge: url.searchParams.get('code_challenge') ?? '', client: url.searchParams.get('client_id') ?? '', redirect: url.searchParams.get('redirect_uri') ?? '' })
      return { code, state: url.searchParams.get('state') ?? '' }
    },
  }
}

describe('OAuthMcpConnector', () => {
  let auth: ReturnType<typeof mockAuthServer>
  let base: string
  let mounts: Array<{ headers: Record<string, string>; disposed: boolean }>
  const mount: McpMount = async config => {
    const entry = { headers: config.headers, disposed: false }
    mounts.push(entry)
    return { dispose: async () => { entry.disposed = true } }
  }
  const make = (credentials: MemoryCredentials, opened: string[], extra: Partial<ConstructorParameters<typeof OAuthMcpConnector>[0]> = {}) =>
    new OAuthMcpConnector({
      spec: { id: 'mock', title: 'Mock', summary: 'mock', serverName: 'mock', url: `${base}/mcp`, docs: '' },
      credentials, owner: 'dsh-silkroad', redirectUrl: () => 'http://127.0.0.1:4567/silkroad/oauth/callback/mock',
      mount, openBrowser: url => { opened.push(url) }, ...extra,
    })

  beforeEach(async () => { auth = mockAuthServer(); base = await auth.listen(); mounts = [] })
  afterEach(async () => { await new Promise(resolve => auth.server.close(resolve)) })

  it('registers a client, logs in with PKCE, and mounts the MCP client with the bearer token', async () => {
    const credentials = new MemoryCredentials()
    const opened: string[] = []
    const connector = make(credentials, opened)

    const begun = await connector.beginLogin()
    expect(begun.state).toBe('awaiting-browser')
    expect(opened).toEqual([begun.authorizationUrl])
    expect(auth.clients.size).toBe(1)
    const url = new URL(begun.authorizationUrl!)
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:4567/silkroad/oauth/callback/mock')

    await connector.completeLogin(auth.approve(begun.authorizationUrl!))
    expect(connector.status().state).toBe('connected')
    expect(mounts).toHaveLength(1)
    expect(mounts[0]!.headers.Authorization).toBe('Bearer access-1')
    await connector.stop()
  })

  it('rejects a callback whose state does not match the started login', async () => {
    const connector = make(new MemoryCredentials(), [])
    const begun = await connector.beginLogin()
    const { code } = auth.approve(begun.authorizationUrl!)
    await expect(connector.completeLogin({ code, state: 'forged' })).rejects.toThrow(/did not match/)
    expect(connector.status().state).toBe('error')
    expect(mounts).toHaveLength(0)
  })

  it('restores a stored login at startup and refreshes a stale token before mounting', async () => {
    const credentials = new MemoryCredentials()
    const first = make(credentials, [])
    const begun = await first.beginLogin()
    await first.completeLogin(auth.approve(begun.authorizationUrl!))
    await first.stop()

    // An hour and a minute later the token has expired; the next start must refresh instead of mounting a dead token.
    const later = Date.now() + 3_660_000
    const second = make(credentials, [], { now: () => later })
    await second.start()
    expect(second.status().state).toBe('connected')
    expect(mounts.at(-1)!.headers.Authorization).toBe('Bearer access-2')
    expect(auth.issued()).toBe(2)
    await second.stop()
  })

  it('logout forgets the grant and unmounts', async () => {
    const credentials = new MemoryCredentials()
    const connector = make(credentials, [])
    const begun = await connector.beginLogin()
    await connector.completeLogin(auth.approve(begun.authorizationUrl!))
    await connector.logout()
    expect(connector.status().state).toBe('disconnected')
    expect(mounts[0]!.disposed).toBe(true)
    expect(credentials.records.size).toBe(0)
  })
})
