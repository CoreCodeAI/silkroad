/**
 * One remote MCP server behind OAuth (FastMoss first). The connector runs the
 * login, keeps the access token fresh, and mounts DSH's own MCP client with a
 * bearer header whenever a valid token exists. DSH 0.2.1's MCP client has no
 * OAuth flow of its own, so this is the piece that fills the gap.
 */
import { auth, type FetchLike } from '@modelcontextprotocol/client'
import type { CredentialsLike } from '../credentials.ts'
import { credentialKey } from '../keys.ts'
import { GrantOAuthProvider, tokenExpiry, type GrantPayload } from './oauth-provider.ts'
import type { OAuthConnectorSpec } from './catalog.ts'

export type ConnectorState = 'disconnected' | 'awaiting-browser' | 'connected' | 'expired' | 'error'

export interface ConnectorStatus {
  id: string
  title: string
  summary: string
  kind: 'oauth-mcp'
  state: ConnectorState
  /** Model-facing tool prefix once connected, e.g. `mcp__fastmoss__`. */
  toolPrefix: string
  expiresAt?: number
  error?: string
  docs?: string
}

export interface McpHandle { dispose(): Promise<void> }
/** Mounts DSH's MCP client for one server; injected so tests need no Cordis runtime. */
export type McpMount = (config: { serverName: string; url: string; headers: Record<string, string> }) => Promise<McpHandle>

export interface ConnectorOptions {
  spec: OAuthConnectorSpec
  credentials: CredentialsLike
  /** Plugin name that owns the credential record. */
  owner: string
  redirectUrl: () => string
  mount: McpMount
  /** Opens the system browser for an interactive login. */
  openBrowser: (url: string) => void | Promise<void>
  fetchFn?: FetchLike
  logger?: { info(...args: unknown[]): void; warn(...args: unknown[]): void }
  /** Refresh this long before expiry. */
  refreshLeadMs?: number
  now?: () => number
}

export class OAuthMcpConnector {
  private state: ConnectorState = 'disconnected'
  private error: string | undefined
  private expiresAt: number | undefined
  private handle: McpHandle | undefined
  private mountedToken: string | undefined
  private timer: ReturnType<typeof setTimeout> | undefined
  private queue: Promise<unknown> = Promise.resolve()
  private stopped = false
  /** Set only while an interactive login is collecting the authorization URL. */
  private capture: ((url: URL) => void) | undefined
  private readonly provider: GrantOAuthProvider

  constructor(private readonly options: ConnectorOptions) {
    this.provider = new GrantOAuthProvider({
      credentials: options.credentials,
      key: credentialKey(options.owner, `oauth-${options.spec.id}`),
      redirectUrl: options.redirectUrl,
      clientName: 'SilkRoad',
      onRedirect: url => {
        // A background refresh that falls back to a redirect must never pop a browser on its own.
        if (this.capture) this.capture(url)
      },
    })
  }

  get id(): string { return this.options.spec.id }

  status(): ConnectorStatus {
    const { spec } = this.options
    return {
      id: spec.id, title: spec.title, summary: spec.summary, kind: 'oauth-mcp', state: this.state,
      toolPrefix: `mcp__${spec.serverName}__`, docs: spec.docs,
      ...this.expiresAt === undefined ? {} : { expiresAt: this.expiresAt },
      ...this.error === undefined ? {} : { error: this.error },
    }
  }

  /** Restores a stored login at startup: mounts the MCP client, refreshing first when the token is stale. */
  start(): Promise<void> {
    return this.serial(async () => {
      const payload = await this.provider.read()
      if (!payload.tokens?.access_token) { this.set('disconnected'); return }
      const expiry = tokenExpiry(payload)
      if (expiry !== undefined && expiry - this.lead() <= this.now()) await this.refreshLocked()
      else await this.connect(payload)
    })
  }

  /** Starts an interactive login and returns the URL the user must open. Opens the system browser too. */
  beginLogin(): Promise<{ authorizationUrl?: string; state: ConnectorState }> {
    return this.serial(async () => {
      let captured: URL | undefined
      this.capture = url => { captured = url }
      try {
        const result = await auth(this.provider, { serverUrl: this.options.spec.url, ...this.fetchOption() })
        if (result === 'AUTHORIZED') {
          await this.connect(await this.provider.read())
          return { state: this.state }
        }
        if (!captured) throw new Error('The authorization server did not return a login URL.')
        this.set('awaiting-browser')
        await this.options.openBrowser(captured.href)
        return { authorizationUrl: captured.href, state: this.state }
      } catch (error) {
        this.fail(error)
        throw error
      } finally {
        this.capture = undefined
      }
    })
  }

  /** Handles the browser redirect: checks `state`, exchanges the code, and mounts the MCP client. */
  completeLogin(params: { code?: string; state?: string; iss?: string; error?: string }): Promise<void> {
    return this.serial(async () => {
      if (params.error) { this.fail(new Error(`Authorization was refused: ${params.error}`)); throw new Error(this.error) }
      const payload = await this.provider.read()
      if (!params.code || !params.state || !payload.pendingState || params.state !== payload.pendingState) {
        this.fail(new Error('The login response did not match the login that was started. Start the login again.'))
        throw new Error(this.error)
      }
      try {
        const result = await auth(this.provider, {
          serverUrl: this.options.spec.url, authorizationCode: params.code, ...params.iss ? { iss: params.iss } : {},
          ...this.fetchOption(),
        })
        if (result !== 'AUTHORIZED') throw new Error('The authorization server did not issue a token.')
        await this.provider.update(current => ({ ...current, pendingState: undefined, codeVerifier: undefined }))
        await this.connect(await this.provider.read())
      } catch (error) {
        this.fail(error)
        throw error
      }
    })
  }

  /** Forgets the login: removes the grant and unmounts the MCP client. */
  logout(): Promise<void> {
    return this.serial(async () => {
      this.clearTimer()
      await this.unmount()
      await this.options.credentials.deleteRecord(credentialKey(this.options.owner, `oauth-${this.options.spec.id}`))
      this.expiresAt = undefined
      this.set('disconnected')
    })
  }

  /** Stops timers and unmounts without touching the stored login. */
  async stop(): Promise<void> {
    this.stopped = true
    this.clearTimer()
    await this.queue.catch(() => undefined)
    await this.unmount()
  }

  // ---- internals; every method below runs inside `serial` ----

  private async connect(payload: GrantPayload): Promise<void> {
    const token = payload.tokens?.access_token
    if (!token) { this.set('disconnected'); return }
    this.expiresAt = tokenExpiry(payload)
    if (this.mountedToken !== token) {
      await this.unmount()
      if (this.stopped) return
      const { spec } = this.options
      this.handle = await this.options.mount({
        serverName: spec.serverName, url: spec.url, headers: { Authorization: `Bearer ${token}` },
      })
      this.mountedToken = token
    }
    this.set('connected')
    this.schedule()
  }

  private async refreshLocked(): Promise<void> {
    try {
      const result = await auth(this.provider, { serverUrl: this.options.spec.url, ...this.fetchOption() })
      if (result === 'AUTHORIZED') { await this.connect(await this.provider.read()); return }
      // Refresh failed and the SDK wants a fresh login; wait for the user instead of opening a browser.
      await this.unmount()
      this.set('expired', 'The login expired. Log in again from the 跨境电商 (SilkRoad) panel, 数据源 tab.')
    } catch (error) {
      this.options.logger?.warn('silkroad: %s token refresh failed: %s', this.id, String(error))
      await this.unmount()
      this.set('expired', `Token refresh failed: ${messageOf(error)}`)
    }
  }

  private schedule(): void {
    this.clearTimer()
    if (this.expiresAt === undefined || this.stopped) return
    const delay = Math.max(this.expiresAt - this.lead() - this.now(), 5_000)
    this.timer = setTimeout(() => { void this.serial(() => this.refreshLocked()) }, delay)
    this.timer.unref?.()
  }

  private async unmount(): Promise<void> {
    const handle = this.handle
    this.handle = undefined
    this.mountedToken = undefined
    if (handle) await handle.dispose()
  }

  private serial<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task)
    this.queue = run.catch(() => undefined)
    return run
  }

  private set(state: ConnectorState, error?: string): void {
    this.state = state
    this.error = error
  }

  private fail(error: unknown): void { this.set('error', messageOf(error)) }
  private clearTimer(): void { if (this.timer) clearTimeout(this.timer); this.timer = undefined }
  private lead(): number { return this.options.refreshLeadMs ?? 120_000 }
  private now(): number { return this.options.now?.() ?? Date.now() }
  private fetchOption(): { fetchFn?: FetchLike } { return this.options.fetchFn ? { fetchFn: this.options.fetchFn } : {} }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
