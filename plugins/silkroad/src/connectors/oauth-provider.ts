/**
 * An MCP SDK `OAuthClientProvider` whose whole state (dynamic client
 * registration, tokens, PKCE verifier, pending `state`) lives in one DSH
 * credential grant record. Nothing is cached in memory, so a second process
 * or a restart sees the same login.
 */
import { randomBytes } from 'node:crypto'
import type {
  OAuthClientMetadata,
  OAuthClientProvider,
  StoredOAuthClientInformation,
  StoredOAuthTokens,
} from '@modelcontextprotocol/client'
import type { CredentialKey, CredentialsLike } from '../credentials.ts'

/** Persisted grant payload. `redirectUri` binds the client registration to the callback it was made for. */
export interface GrantPayload {
  version: 1
  redirectUri?: string
  clientInformation?: StoredOAuthClientInformation
  tokens?: StoredOAuthTokens
  /** Epoch ms when `tokens` were saved; with `expires_in` this gives the expiry. */
  tokensSavedAt?: number
  codeVerifier?: string
  pendingState?: string
}

export interface ProviderOptions {
  credentials: CredentialsLike
  key: CredentialKey
  /** Loopback callback URL served by the DSH web server; read lazily because the port is known only after listen. */
  redirectUrl: () => string
  clientName: string
  /** Called with the authorization URL when an interactive login must open the browser. */
  onRedirect: (url: URL) => void | Promise<void>
}

function payloadOf(record: Awaited<ReturnType<CredentialsLike['readRecord']>>): GrantPayload {
  if (record?.kind === 'grant' && record.payload && typeof record.payload === 'object') {
    const payload = record.payload as Partial<GrantPayload>
    if (payload.version === 1) return payload as GrantPayload
  }
  return { version: 1 }
}

export class GrantOAuthProvider implements OAuthClientProvider {
  constructor(private readonly options: ProviderOptions) {}

  get redirectUrl(): string { return this.options.redirectUrl() }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: this.options.clientName,
      redirect_uris: [this.options.redirectUrl()],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    }
  }

  async read(): Promise<GrantPayload> {
    return payloadOf(await this.options.credentials.readRecord(this.options.key))
  }

  async update(change: (payload: GrantPayload) => GrantPayload): Promise<GrantPayload> {
    let next: GrantPayload = { version: 1 }
    await this.options.credentials.modifyRecord(this.options.key, async current => {
      next = change(payloadOf(current))
      return { kind: 'grant', payload: next }
    })
    return next
  }

  async state(): Promise<string> {
    const value = randomBytes(24).toString('base64url')
    await this.update(payload => ({ ...payload, pendingState: value }))
    return value
  }

  async clientInformation(): Promise<StoredOAuthClientInformation | undefined> {
    const payload = await this.read()
    // A registration made for another callback port is useless: registering again is cheap.
    if (payload.redirectUri !== this.options.redirectUrl()) return undefined
    return payload.clientInformation
  }

  async saveClientInformation(clientInformation: StoredOAuthClientInformation): Promise<void> {
    await this.update(payload => ({ ...payload, clientInformation, redirectUri: this.options.redirectUrl() }))
  }

  async tokens(): Promise<StoredOAuthTokens | undefined> {
    return (await this.read()).tokens
  }

  async saveTokens(tokens: StoredOAuthTokens): Promise<void> {
    await this.update(payload => ({ ...payload, tokens, tokensSavedAt: Date.now() }))
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    await this.options.onRedirect(authorizationUrl)
  }

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    await this.update(payload => ({ ...payload, codeVerifier }))
  }

  async codeVerifier(): Promise<string> {
    const verifier = (await this.read()).codeVerifier
    if (!verifier) throw new Error('No PKCE code verifier is stored; start the login again.')
    return verifier
  }

  async invalidateCredentials(scope: 'all' | 'client' | 'tokens' | 'verifier' | 'discovery'): Promise<void> {
    await this.update(payload => {
      switch (scope) {
        case 'all': return { version: 1 }
        case 'client': return { ...payload, clientInformation: undefined, redirectUri: undefined }
        case 'tokens': return { ...payload, tokens: undefined, tokensSavedAt: undefined }
        case 'verifier': return { ...payload, codeVerifier: undefined }
        case 'discovery': return payload
      }
    })
  }
}

/** Epoch ms at which the stored access token expires, or undefined when the server gave no lifetime. */
export function tokenExpiry(payload: GrantPayload): number | undefined {
  const seconds = payload.tokens?.expires_in
  if (typeof seconds !== 'number' || payload.tokensSavedAt === undefined) return undefined
  return payload.tokensSavedAt + seconds * 1000
}
