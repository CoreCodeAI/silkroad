/**
 * Shared look for SilkRoad surfaces. Colors come from DSH's theme variables
 * (with neutral fallbacks) so light and dark themes both work; classes are
 * prefixed `sr-` and injected once.
 */
import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { CATEGORIES, NEED_LABEL, SCENARIOS, type CategoryId, type Scenario } from './scenarios.ts'
import type { HubStatus } from './api.ts'
import { needMet, startScenario } from './state.ts'

const CSS = `
.sr-root{--sr-border:var(--dsw-alias-border-l3,rgba(127,127,127,.28));--sr-layer:var(--dsw-alias-bg-layer-1,transparent);--sr-hover:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.08));--sr-muted:var(--dsw-alias-label-secondary,inherit);--sr-accent:#2f6fed;--sr-fg:var(--dsw-alias-label-primary,currentColor);--sr-subtle:var(--dsw-alias-label-tertiary,var(--sr-muted));--sr-solid:var(--dsw-alias-button-primary-fill,#0f1115);--sr-on-solid:var(--dsw-alias-bg-base,#fff);--sr-tint:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.08));--sr-tint-strong:var(--dsw-alias-interactive-bg-active,rgba(127,127,127,.16));--sr-line:var(--dsw-alias-border-l2,rgba(127,127,127,.2));--sr-ok:#1a9a4b;--sr-warn:#c27c0e;--sr-bad:#d33;color:inherit;font-size:14px;line-height:1.6}
.sr-muted{color:var(--sr-muted);opacity:.78;font-size:13px}
.sr-card{border:1px solid var(--sr-border);background:var(--sr-layer);border-radius:10px;padding:12px 14px;margin-bottom:10px}
.sr-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.sr-title{font-weight:600}
.sr-error{color:var(--sr-bad);font-size:13px;margin-top:6px}
.sr-btn{padding:4px 12px;border-radius:6px;border:1px solid var(--sr-border);background:transparent;color:inherit;cursor:pointer;font:inherit;font-size:13px}
.sr-btn:hover{background:var(--sr-hover)}
.sr-btn:disabled{opacity:.5;cursor:default}
.sr-btn-primary{background:var(--sr-solid);border-color:var(--sr-solid);color:var(--sr-on-solid)}
.sr-btn-primary:hover{background:var(--sr-solid);opacity:.88}
.sr-link{background:none;border:none;padding:0;color:var(--sr-accent);cursor:pointer;font:inherit}
.sr-input{flex:1;min-width:180px;padding:6px 8px;border-radius:6px;border:1px solid var(--sr-border);background:transparent;color:inherit;font:inherit}
.sr-badge{font-size:12px;padding:0 8px;border-radius:999px;border:1px solid currentColor;white-space:nowrap;line-height:20px}
.sr-tabs{display:flex;gap:4px;border-bottom:1px solid var(--sr-border);margin:0 0 16px;flex-wrap:wrap}
.sr-tab{padding:6px 12px;border:none;background:none;color:inherit;cursor:pointer;font:inherit;opacity:.7;border-bottom:2px solid transparent;margin-bottom:-1px}
.sr-tab[aria-selected=true]{opacity:1;font-weight:600;border-bottom-color:var(--sr-fg)}
.sr-seg{display:inline-flex;gap:2px;padding:3px;border-radius:12px;background:var(--sr-tint);max-width:100%;overflow-x:auto;scrollbar-width:none}
.sr-seg::-webkit-scrollbar{display:none}
.sr-seg-item{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 14px;border:none;border-radius:9px;background:transparent;color:var(--sr-muted);font:inherit;font-size:13.5px;white-space:nowrap;cursor:pointer;transition:background-color .15s,color .15s}
.sr-seg-item:hover{color:var(--sr-fg);background:var(--sr-tint)}
.sr-seg-item[aria-selected=true]{background:var(--sr-solid);color:var(--sr-on-solid);font-weight:600}
.sr-seg-item svg{flex:none;opacity:.9}
.sr-seg-item:focus-visible,.sr-chip:focus-visible{outline:2px solid var(--sr-accent);outline-offset:2px}
.sr-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}
.sr-chip{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 16px;border-radius:999px;border:1px solid var(--sr-line);background:transparent;color:var(--sr-fg);font:inherit;font-size:13.5px;white-space:nowrap;cursor:pointer;transition:background-color .15s,border-color .15s}
.sr-chip:hover{background:var(--sr-tint);border-color:var(--sr-border)}
.sr-chip-more{color:var(--sr-muted);border-style:dashed}
.sr-quick{container-type:inline-size;display:flex;flex-direction:column;align-items:center;gap:12px;padding:12px 16px 8px}
@container (max-width:560px){.sr-seg-item svg{display:none}.sr-seg-item{padding:0 10px}}
.sr-pickbar{display:flex;justify-content:flex-start;margin-bottom:14px}
.sr-picker{container-type:inline-size}
.sr-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
@container (max-width:680px){.sr-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@container (max-width:360px){.sr-grid{grid-template-columns:minmax(0,1fr)}}
.sr-dock{padding:0 16px;margin:4px 0}
.sr-source-pill{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:8px;border:none;background:transparent;color:var(--sr-muted);font:inherit;font-size:12.5px;white-space:nowrap;cursor:pointer}
.sr-source-pill:hover{background:var(--sr-tint);color:var(--sr-fg)}
.sr-source-pill:focus-visible{outline:2px solid var(--sr-accent);outline-offset:2px}
/* New session: scenarios right under the brand, the workspace row as the input's header. */
[class*="_composerHero"]:has(.sr-quick)>[class*="_heroWorkspaceRow"]{order:1;margin-top:4px}
[class*="_composerHero"]:has(.sr-quick)>div>[class*="_hero"][class*="_root"]{order:2}
[class*="_composerHero"]:has(.sr-quick)>[class*="_root"]:first-child{margin-bottom:12px}
.sr-scenario{text-align:left;border:1px solid var(--sr-border);background:var(--sr-layer);border-radius:10px;padding:10px 12px;cursor:pointer;color:inherit;font:inherit;display:flex;flex-direction:column;align-items:stretch;gap:4px;min-height:96px;min-width:0;transition:border-color .15s,background-color .15s}
.sr-scenario:focus-visible{outline:2px solid var(--sr-accent);outline-offset:2px}
.sr-scenario:hover{border-color:var(--sr-border);background:var(--sr-tint)}
.sr-scenario-title{font-weight:600;font-size:13.5px}
.sr-scenario-summary{font-size:12px;color:var(--sr-muted);opacity:.8;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.sr-needs{display:flex;gap:4px;flex-wrap:wrap;margin-top:auto;padding-top:2px}
.sr-need{font-size:11px;padding:0 6px;border-radius:4px;line-height:18px;border:1px solid var(--sr-border);opacity:.85}
.sr-need[data-met=false]{color:var(--sr-warn);border-color:var(--sr-warn)}
.sr-need[data-met=true]{color:var(--sr-ok);border-color:var(--sr-ok)}
.sr-strip{display:flex;align-items:center;column-gap:12px;row-gap:2px;flex-wrap:wrap;font-size:12px;padding:8px 0 0;color:var(--sr-muted);line-height:18px}
.sr-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:4px;vertical-align:middle}
.sr-table{width:100%;border-collapse:collapse;font-size:12.5px}
.sr-table th,.sr-table td{border-bottom:1px solid var(--sr-border);padding:4px 8px;text-align:left;vertical-align:top}
.sr-table th{font-weight:600;white-space:nowrap}
.sr-table td{max-width:320px;overflow:hidden;text-overflow:ellipsis}
.sr-md h1{font-size:18px;margin:12px 0 6px}.sr-md h2{font-size:16px;margin:14px 0 6px}.sr-md h3{font-size:14.5px;margin:12px 0 4px}
.sr-md p{margin:6px 0}.sr-md ul,.sr-md ol{margin:6px 0;padding-left:20px}.sr-md code{font-size:12.5px;padding:0 3px;border-radius:3px;background:var(--sr-hover)}
.sr-md pre{background:var(--sr-hover);padding:8px;border-radius:6px;overflow:auto;font-size:12.5px}
.sr-md blockquote{margin:6px 0;padding-left:10px;border-left:3px solid var(--sr-border);opacity:.85}
.sr-md table{border-collapse:collapse;margin:8px 0;font-size:12.5px;display:block;overflow:auto}
.sr-md th,.sr-md td{border:1px solid var(--sr-border);padding:3px 8px;text-align:left}
.sr-list-item{display:block;width:100%;text-align:left;border:none;background:none;color:inherit;font:inherit;padding:6px 8px;border-radius:6px;cursor:pointer}
.sr-list-item:hover,.sr-list-item[aria-current=true]{background:var(--sr-hover)}
`

let injected = false
export function ensureStyles(): () => void {
  if (injected || typeof document === 'undefined') return () => {}
  const style = document.createElement('style')
  style.dataset.silkroad = ''
  style.textContent = CSS
  document.head.appendChild(style)
  injected = true
  return () => { style.remove(); injected = false }
}

export function Badge({ label, color }: { label: string; color: string }) {
  return <span className="sr-badge" style={{ color }}>{label}</span>
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (id: T) => void }) {
  return <div className="sr-tabs" role="tablist">
    {tabs.map(tab => <button key={tab.id} className="sr-tab" role="tab" aria-selected={tab.id === value} onClick={() => onChange(tab.id)}>{tab.label}</button>)}
  </div>
}

export function NeedChips({ scenario, status }: { scenario: Scenario; status?: HubStatus }) {
  return <span className="sr-needs">
    {scenario.needs.map(need => {
      const met = needMet(status, need)
      return <span key={need} className="sr-need" data-met={met === undefined ? undefined : String(met)} title={met === false ? `${NEED_LABEL[need]} 还没连接，结果会受影响` : undefined}>
        {met === false ? `需 ${NEED_LABEL[need]}` : NEED_LABEL[need]}
      </span>
    })}
  </span>
}

export function ScenarioCard({ scenario, status }: { scenario: Scenario; status?: HubStatus }) {
  return <button className="sr-scenario" onClick={() => startScenario(scenario)} title="新建会话并填好提示词，替换【】里的内容后发送">
    <span className="sr-scenario-title">{scenario.title}</span>
    <span className="sr-scenario-summary">{scenario.summary}</span>
    <NeedChips scenario={scenario} status={status} />
  </button>
}

const ICON_PATHS: Record<CategoryId | 'all', string[]> = {
  all: ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'],
  launch: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'M20 20l-4-4'],
  content: ['M4 5h16v14H4z', 'M10 9l5 3-5 3z'],
  operations: ['M4 9l1.5-5h13L20 9', 'M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0', 'M5.5 12v8h13v-8', 'M10 20v-4h4v4'],
  service: ['M5 5h14v10H10l-4 4v-4H5z', 'M9 10h6'],
  creators: ['M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z', 'M3 20a6 6 0 0 1 12 0', 'M16 4.5a3.5 3.5 0 0 1 0 6.5', 'M18 14.5a6 6 0 0 1 3 5.5'],
}

export function CategoryIcon({ id, size = 16 }: { id: CategoryId | 'all'; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {ICON_PATHS[id].map(d => <path key={d} d={d} />)}
  </svg>
}

const CATEGORY_KEY = 'silkroad.scenario.category'

function rememberedCategory(fallback: CategoryId | 'all'): CategoryId | 'all' {
  try {
    const value = globalThis.localStorage?.getItem(CATEGORY_KEY)
    return value === 'all' || CATEGORIES.some(item => item.id === value) ? value as CategoryId | 'all' : fallback
  } catch { return fallback }
}

/** Remembers the last category on this device so the dock and panel open where the user left off. */
export function useCategory(fallback: CategoryId | 'all' = 'launch', withAll = false) {
  const [category, setCategory] = useState<CategoryId | 'all'>(() => {
    const value = rememberedCategory(fallback)
    return value === 'all' && !withAll ? fallback : value
  })
  const choose = (value: CategoryId | 'all') => {
    setCategory(value)
    try { globalThis.localStorage?.setItem(CATEGORY_KEY, value) } catch { /* storage unavailable */ }
  }
  return [category, choose] as const
}

/** Segmented category control; arrow keys move between categories. */
export function CategoryTabs({ value, onChange, withAll = false }: { value: CategoryId | 'all'; onChange: (id: CategoryId | 'all') => void; withAll?: boolean }) {
  const items: { id: CategoryId | 'all'; label: string }[] = withAll ? [{ id: 'all', label: '全部' }, ...CATEGORIES] : CATEGORIES
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const index = items.findIndex(item => item.id === value)
    const next = items[(index + step + items.length) % items.length]!
    onChange(next.id)
    const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=tab]')
    buttons[items.indexOf(next)]?.focus()
  }
  return <div className="sr-seg" role="tablist" aria-label="场景分类" onKeyDown={onKeyDown}>
    {items.map(item => <button key={item.id} type="button" role="tab" className="sr-seg-item" aria-selected={item.id === value} tabIndex={item.id === value ? 0 : -1} onClick={() => onChange(item.id)}>
      <CategoryIcon id={item.id} />{item.label}
    </button>)}
  </div>
}

/** Tooltip and accessible label for a scenario chip: what it does and what it still needs. */
export function chipHint(scenario: Scenario, status?: HubStatus): { title: string; missing: string[] } {
  const missing = scenario.needs.filter(need => needMet(status, need) === false).map(need => NEED_LABEL[need])
  const title = missing.length ? `${scenario.summary}\n需要先连接：${missing.join('、')}` : scenario.summary
  return { title, missing }
}

/** New-session quick start: category tabs over one row of scenario chips. */
export function ScenarioQuick({ status, onMore }: { status?: HubStatus; onMore: () => void }) {
  const [category, setCategory] = useCategory()
  const current = category === 'all' ? 'launch' : category
  const shown = SCENARIOS.filter(item => item.category === current)
  return <div className="sr-quick">
    <CategoryTabs value={current} onChange={setCategory} />
    <div className="sr-chips" role="tabpanel" aria-label={CATEGORIES.find(item => item.id === current)?.label}>
      {shown.map(item => {
        const hint = chipHint(item, status)
        return <button key={item.id} type="button" className="sr-chip" title={hint.title} onClick={() => startScenario(item)}
          aria-label={hint.missing.length ? `${item.title}（需要先连接 ${hint.missing.join('、')}）` : item.title}>
          {item.title}
        </button>
      })}
      <button type="button" className="sr-chip sr-chip-more" onClick={onMore}>全部场景</button>
    </div>
  </div>
}

/** Category tabs over a card grid; `limit` caps cards per category. */
export function ScenarioPicker({ status, limit, query = '', footer }: { status?: HubStatus; limit?: number; query?: string; footer?: ReactNode }) {
  const [category, setCategory] = useCategory('launch', true)
  const needle = query.trim().toLowerCase()
  const matches = SCENARIOS.filter(item => (needle !== '' || category === 'all' || item.category === category)
    && (!needle || `${item.title}${item.summary}${item.skill}`.toLowerCase().includes(needle)))
  const shown = limit === undefined ? matches : matches.slice(0, limit)
  return <div className="sr-picker">
    <div className="sr-pickbar"><CategoryTabs value={category} onChange={setCategory} withAll /></div>
    <div className="sr-grid">{shown.map(item => <ScenarioCard key={item.id} scenario={item} status={status} />)}</div>
    {shown.length === 0 && <div className="sr-muted">没有匹配的场景。</div>}
    {footer}
  </div>
}

export function errorText(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}
