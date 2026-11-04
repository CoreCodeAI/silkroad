/**
 * The SilkRoad hub: one place that knows every data source, its state, and
 * how to connect it. HTTP routes, model tools and the panel all go through it.
 */
import { mkdir } from 'node:fs/promises'
import { credentialKey, credentialRef, OWNER } from './keys.ts'
import type { CredentialsLike } from './credentials.ts'
import type { ConnectorStatus, OAuthMcpConnector } from './connectors/oauth-connector.ts'
import { API_KEY_VENDORS, vendorById } from './vendors/catalog.ts'
import { KALODATA_CURRENCIES, KALODATA_LANGUAGES } from './vendors/kalodata.ts'
import { ROLES } from './presets.ts'
import { UserError } from './hub-errors.ts'
import type { ShopStatus, TikTokShop } from './tiktok-shop/client.ts'
import { defaultKnowledgeDirectory, ensureKnowledgeDirectory, knowledgeStatus, type KnowledgeStatus } from './knowledge.ts'
import { defaultReportsDirectory, reportsStatus, type ReportsStatus } from './reports.ts'

export interface VendorStatus {
  id: string
  title: string
  summary: string
  kind: 'api-key'
  /** `configured`: a key is stored (or present in the environment); `anonymous`: no key but the vendor works without one. */
  state: 'configured' | 'missing' | 'anonymous'
  writable: boolean
  signup: string
  signupLabel: string
  /** Editable non-secret settings with their current values. */
  settings?: { id: string; label: string; hint?: string; value: string }[]
}

export interface RoleStatus {
  id: string
  name: string
  description: string
  /** `ready`: selectable for new sessions; `broken`: DSH could not compose it; `pending`: not registered (yet). */
  state: 'ready' | 'broken' | 'pending'
  broken?: string
}

export interface HubStatus {
  connectors: ConnectorStatus[]
  vendors: VendorStatus[]
  roles: RoleStatus[]
  shop?: ShopStatus
  knowledge: KnowledgeStatus
  reports: ReportsStatus
}

/** What the DSH preset registry reports for a declared preset. */
export interface DeclaredPreset { id: string; broken?: string }

export { UserError }

export class Hub {
  constructor(
    private readonly credentials: CredentialsLike,
    readonly connectors: ReadonlyMap<string, OAuthMcpConnector>,
    readonly tiktokShop?: TikTokShop,
  ) {}

  shop(): TikTokShop {
    if (!this.tiktokShop) throw new UserError(404, 'TikTok Shop is not available.')
    return this.tiktokShop
  }

  /** Folder the agent reads product sheets and after-sales rules from. */
  knowledgeDirectory: string = defaultKnowledgeDirectory()
  reportsDirectory: string = defaultReportsDirectory()

  /** Create the folder if needed; returns its path for the panel to open. */
  /** Create the reports folder on first use so the file manager has something to open. */
  async prepareReports(): Promise<string> {
    await mkdir(this.reportsDirectory, { recursive: true })
    return this.reportsDirectory
  }

  async prepareKnowledge(): Promise<string> {
    await ensureKnowledgeDirectory(this.knowledgeDirectory)
    return this.knowledgeDirectory
  }

  /** Set once the role presets are registered; reads DSH's preset roster. */
  presetSource?: () => Promise<readonly DeclaredPreset[]>

  connector(id: string): OAuthMcpConnector {
    const connector = this.connectors.get(id)
    if (!connector) throw new UserError(404, `Unknown data source: ${id}`)
    return connector
  }

  async status(): Promise<HubStatus> {
    const vendors = await Promise.all(API_KEY_VENDORS.map(async (vendor): Promise<VendorStatus> => {
      const info = await this.credentials.describe(credentialRef(vendor.credential))
      const state: VendorStatus['state'] = info.configured ? 'configured' : vendor.keyOptional ? 'anonymous' : 'missing'
      const base = { id: vendor.id, title: vendor.title, summary: vendor.summary, kind: 'api-key' as const, state, writable: info.writable, signup: vendor.signup, signupLabel: vendor.signupLabel ?? vendor.title }
      if (!vendor.settings) return base
      const values = await this.vendorSettings(vendor.id)
      return { ...base, settings: vendor.settings.map(spec => ({ id: spec.id, label: spec.label, ...spec.hint ? { hint: spec.hint } : {}, value: values[spec.id]! })) }
    }))
    const declared = this.presetSource ? await this.presetSource().catch(() => []) : []
    const roles = ROLES.map((role): RoleStatus => {
      const preset = declared.find(item => item.id === role.id)
      const base = { id: role.id, name: role.name, description: role.description }
      if (!preset) return { ...base, state: 'pending' }
      return preset.broken ? { ...base, state: 'broken', broken: preset.broken } : { ...base, state: 'ready' }
    })
    const shop = this.tiktokShop ? await this.tiktokShop.status() : undefined
    return { connectors: [...this.connectors.values()].map(connector => connector.status()), vendors, roles, ...shop ? { shop } : {}, knowledge: await knowledgeStatus(this.knowledgeDirectory), reports: await reportsStatus(this.reportsDirectory) }
  }

  async setVendorKey(id: string, value: unknown): Promise<void> {
    const vendor = vendorById(id)
    if (!vendor) throw new UserError(404, `Unknown data source: ${id}`)
    if (typeof value !== 'string' || !value.trim()) throw new UserError(400, 'The API key is empty.')
    if (value.length > 4096) throw new UserError(400, 'The API key is too long.')
    await this.credentials.set(credentialRef(vendor.credential), value.trim())
  }

  /** Current settings for a vendor, with defaults filled in. */
  async vendorSettings(id: string): Promise<Record<string, string>> {
    const vendor = vendorById(id)
    if (!vendor) throw new UserError(404, `Unknown data source: ${id}`)
    const record = await this.credentials.readRecord(credentialKey(OWNER, `vendor-settings-${id}`))
    const stored = record?.kind === 'grant' && record.payload && typeof record.payload === 'object' ? record.payload as Record<string, unknown> : {}
    return Object.fromEntries((vendor.settings ?? []).map(spec => {
      const value = stored[spec.id]
      return [spec.id, typeof value === 'string' && value.trim() ? value.trim() : spec.default]
    }))
  }

  async setVendorSettings(id: string, values: unknown): Promise<void> {
    const vendor = vendorById(id)
    if (!vendor?.settings) throw new UserError(404, `Data source ${id} has no settings.`)
    if (!values || typeof values !== 'object') throw new UserError(400, 'Settings must be an object.')
    const next: Record<string, string> = {}
    for (const spec of vendor.settings) {
      const value = (values as Record<string, unknown>)[spec.id]
      if (value === undefined) continue
      if (typeof value !== 'string' || value.length > 512) throw new UserError(400, `Invalid value for ${spec.label}.`)
      if (spec.id === 'baseUrl' && value.trim() && !/^https:\/\/|^http:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(value.trim())) {
        throw new UserError(400, '接口地址必须是 https 地址（本机测试可用 http://127.0.0.1）。')
      }
      if (id === 'kalodata' && value.trim()) {
        const allowed: readonly string[] | undefined = spec.id === 'language' ? KALODATA_LANGUAGES : spec.id === 'currency' ? KALODATA_CURRENCIES : undefined
        if (allowed && !allowed.includes(value.trim())) throw new UserError(400, `${spec.label}只能填：${allowed.join('、')}。`)
      }
      next[spec.id] = value.trim()
    }
    await this.credentials.modifyRecord(credentialKey(OWNER, `vendor-settings-${id}`), async current => {
      const previous = current?.kind === 'grant' && current.payload && typeof current.payload === 'object' ? current.payload as Record<string, string> : {}
      return { kind: 'grant', payload: { ...previous, ...next } }
    })
  }

  async clearVendorKey(id: string): Promise<void> {
    const vendor = vendorById(id)
    if (!vendor) throw new UserError(404, `Unknown data source: ${id}`)
    await this.credentials.unset(credentialRef(vendor.credential))
  }
}
