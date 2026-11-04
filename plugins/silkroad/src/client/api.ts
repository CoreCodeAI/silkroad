/** Typed client for the SilkRoad management routes on DSH's authenticated `/api` channel. */
import type { HubStatus } from '../hub.ts'
import type { ReportFile } from '../reports.ts'

export type { HubStatus, ReportFile }
export interface ReportContent { path: string; title: string; text: string; truncated: boolean; modified: string }

async function call<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/silkroad${path}`, body === undefined
    ? { method: 'GET', credentials: 'same-origin' }
    : { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const text = await response.text()
  let value: unknown
  try { value = text ? JSON.parse(text) : {} } catch { value = undefined }
  if (!response.ok) {
    const message = (value as { error?: unknown } | undefined)?.error
    throw new Error(typeof message === 'string' ? message
      : response.status === 404 ? 'SilkRoad 插件没有响应，可能还在启动。' : `请求失败（HTTP ${response.status}）`)
  }
  return value as T
}

export const api = {
  status: () => call<HubStatus>('/status'),
  login: (id: string) => call<{ authorizationUrl?: string; state: string }>('/connectors/login', { id }),
  logout: (id: string) => call<{ ok: true }>('/connectors/logout', { id }),
  saveKey: (id: string, value: string) => call<{ ok: true }>('/vendors/key', { id, value }),
  clearKey: (id: string) => call<{ ok: true }>('/vendors/clear', { id }),
  saveSettings: (id: string, values: Record<string, string>) => call<{ ok: true }>('/vendors/settings', { id, values }),
  shopSettings: (values: Record<string, string>) => call<{ ok: true }>('/shop/settings', { values }),
  shopSecret: (value: string) => call<{ ok: true }>('/shop/secret', { value }),
  shopClearSecret: () => call<{ ok: true }>('/shop/secret/clear', {}),
  shopAuthorize: () => call<{ authorizationUrl: string }>('/shop/authorize', {}),
  shopComplete: (pasted: string) => call<unknown>('/shop/complete', { pasted }),
  openKnowledge: () => call<{ directory: string }>('/knowledge/open', {}),
  shopDisconnect: () => call<{ ok: true }>('/shop/disconnect', {}),
  reports: () => call<{ directory: string; files: ReportFile[] }>('/reports'),
  readReport: (path: string) => call<ReportContent>('/reports/read', { path }),
  openReports: () => call<{ directory: string }>('/reports/open', {}),
}
