// Live check of FastMoss OAuth without an account: dynamic client registration, PKCE, and the authorization page. Opens no browser.
import { auth } from '@modelcontextprotocol/client'
import { GrantOAuthProvider } from '../src/connectors/oauth-provider.ts'
import { MemoryCredentials } from '../tests/fakes.ts'
const credentials = new MemoryCredentials()
let captured: URL | undefined
const provider = new GrantOAuthProvider({
  credentials: credentials as never, key: 'probe' as never, clientName: 'SilkRoad',
  redirectUrl: () => 'http://127.0.0.1:51999/silkroad/oauth/callback/fastmoss',
  onRedirect: url => { captured = url },
})
const result = await auth(provider, { serverUrl: 'https://mcp.fastmoss.com/mcp' })
console.log('auth result:', result)
const info = await provider.clientInformation()
console.log('registered client_id present:', Boolean(info?.client_id))
if (captured) {
  const u = new URL(captured)
  console.log('authorize endpoint:', u.origin + u.pathname)
  console.log('params:', [...u.searchParams.keys()].join(','), 'method=', u.searchParams.get('code_challenge_method'))
  const res = await fetch(u, { redirect: 'manual' })
  console.log('authorize page HTTP', res.status, res.headers.get('location')?.slice(0, 80) ?? '')
}
