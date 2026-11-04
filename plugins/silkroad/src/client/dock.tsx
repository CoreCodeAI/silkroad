/**
 * `conversation.input.dock` seat, shown above the input box.
 * - New (blank) session: category tabs and scenario chips.
 * - Session in progress: only a reminder when FastMoss is not connected.
 * Data source status lives in the workspace row (`SourcesPill`).
 */
import { useState } from 'react'
import type { HubStatus } from './api.ts'
import { needMet, openPanel, useStatus } from './state.ts'
import { ScenarioQuick } from './ui.tsx'

const HINT_KEY = 'silkroad.dock.hideFastmossHint'

function remembered(key: string): boolean {
  try { return globalThis.localStorage?.getItem(key) === '1' } catch { return false }
}
function remember(key: string, value: boolean): void {
  try { globalThis.localStorage?.setItem(key, value ? '1' : '0') } catch { /* storage unavailable */ }
}

interface Source { label: string; state: string; ok: boolean }

export function sourceSummary(status: HubStatus): Source[] {
  const sources: Source[] = status.connectors.map(item => ({ label: item.title, state: item.state === 'connected' ? '已连接' : item.state === 'expired' ? '登录过期' : '未登录', ok: item.state === 'connected' }))
  if (status.shop) sources.push({ label: '我的店铺', state: status.shop.state === 'connected' ? `${status.shop.shops.length} 家` : '未授权', ok: status.shop.state === 'connected' })
  for (const item of status.vendors) if (item.state === 'configured') sources.push({ label: item.title, state: '已配置', ok: true })
  sources.push({ label: '知识库', state: status.knowledge.files > 0 ? `${status.knowledge.files} 个文件` : '空', ok: status.knowledge.files > 0 })
  return sources
}

/** Core sources a seller should connect; optional API keys only show once configured. */
export function sourceProgress(status: HubStatus): { ready: number; total: number } {
  const core = [
    ...status.connectors.map(item => item.state === 'connected'),
    ...status.shop ? [status.shop.state === 'connected'] : [],
    status.knowledge.files > 0,
  ]
  return { ready: core.filter(Boolean).length, total: core.length }
}

/** Right end of the new-session workspace row: how many data sources are ready; opens the 数据源 tab. */
export function SourcesPill() {
  const { status } = useStatus()
  if (!status) return null
  const { ready, total } = sourceProgress(status)
  const done = ready === total
  const label = done ? '数据源已就绪' : `数据源 ${ready}/${total}`
  const detail = sourceSummary(status).map(source => `${source.label}：${source.state}`).join('\n')
  return <span className="sr-root"><button type="button" className="sr-source-pill" onClick={() => openPanel('sources')}
    title={`${detail}\n点击管理数据源`} aria-label={`${label}，点击管理数据源`}>
    <span className="sr-dot" style={{ background: done ? 'var(--sr-ok)' : 'var(--dsw-alias-state-warn-primary, var(--sr-warn))', marginRight: 0 }} />
    {label}
  </button></span>
}

/**
 * New session: category tabs and scenario chips between the brand and the
 * input. In a session: a one-time reminder when FastMoss is not connected.
 */
export function InputDock({ session }: { session?: { blank?: boolean } }) {
  const { status } = useStatus()
  const [hintHidden, setHintHidden] = useState(() => remembered(HINT_KEY))
  const hideHint = () => { setHintHidden(true); remember(HINT_KEY, true) }
  if (!status) return null

  if (session?.blank !== true) {
    const fastmoss = status.connectors.find(item => item.id === 'fastmoss')
    if (!fastmoss || needMet(status, 'market') || hintHidden) return null
    return <div className="sr-root sr-dock"><div className="sr-strip">
      <span className="sr-dot" style={{ background: 'var(--sr-warn)' }} />
      FastMoss {fastmoss.state === 'expired' ? '登录已过期' : '未登录'}，也没有填 Kalodata Key，丝路查不到 TikTok 市场数据。
      <button className="sr-link" onClick={() => openPanel('sources')}>去连接</button>
      <button className="sr-link" style={{ color: 'inherit', opacity: 0.6 }} onClick={hideHint}>不再提示</button>
    </div></div>
  }

  return <div className="sr-root"><ScenarioQuick status={status} onMore={() => openPanel('scenarios')} /></div>
}
