/**
 * Browser plugin. Surfaces:
 * - sidebar entry + main panel (场景 · 角色团队 · 数据源 · 知识库 · 报表)
 * - new session: category tabs and scenario chips above the input, a data source
 *   pill in the workspace row; in a session, a FastMoss reminder
 * - right-sidebar 报告 tab, reachable from the sidebar guide and a header button
 * - result rows for SilkRoad's tools
 * Optional host services are bound in child plugins, so a missing one only
 * disables the surface that needs it.
 */
import { Panel } from './panel.tsx'
import { InputDock, SourcesPill } from './dock.tsx'
import { ReportsBrowser } from './reports.tsx'
import { bindHost, takePendingReport, type HostActions, type ScheduleRecord } from './state.ts'
import { SilkRoadToolRow, TOOL_LABELS, type ToolRowProps } from './toolviews.tsx'
import { ensureStyles } from './ui.tsx'

const NS = 'dshSilkroad'
const PANEL_ID = 'dsh-silkroad'
const REPORTS_TAB_ID = 'dsh-silkroad/reports'
const REPORTS_TAB_KIND = 'silkroadReports'
const SCHEDULES_PANEL_ID = 'schedules'

type Dispose = () => void

/** The slice of the client context this plugin touches; registrations return disposers. */
interface ClientContext {
  effect(execute: () => Dispose, label?: string): void
  plugin(plugin: { name?: string; inject: string[]; apply: (ctx: ClientContext) => void }): unknown
  locale: {
    register(namespace: string, dictionaries: Record<string, Record<string, string>>): Dispose
    bind(namespace: string): (key: string) => string
  }
  slots: {
    inject(name: string, register: () => Dispose): void
    register(spec: Record<string, unknown>, component: (props: never) => unknown): Dispose
  }
  layout: { selectPanel(id: string | null): void }
  uiWorkspace: { startSession(workspaceId?: string, options?: { agentPreset?: string; prompt?: string; whenDraftExists?: 'keep' | 'replace' | 'append' }): void }
  sidebarRight: { openTab(kind: string, options?: { params?: Record<string, unknown> }): void }
  sidebarRightTabs: { register(definition: Record<string, unknown>): Dispose }
  remote: { schedule: { catalog(): Promise<{ ok: boolean; value?: ScheduleRecord[] }> } }
}

const zh = { panel: '跨境电商', reports: '丝路报告', reportsGuide: '店铺诊断、竞品拆解、每周报表等报告' }
const en = { panel: 'Cross-border', reports: 'SilkRoad reports', reportsGuide: 'Shop diagnoses, competitor teardowns, weekly reports' }

function RouteIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="5" cy="18" r="2" /><circle cx="19" cy="6" r="2" />
    <path d="M7 18h6a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h6" />
  </svg>
}

function ReportIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /><path d="M10 13h6M10 17h4" />
  </svg>
}

const actions: HostActions = {
  startSession: () => {},
  openPanel: () => {},
  openReportsTab: () => false,
  listSchedules: async () => [],
  openSchedules: () => {},
}

export const inject = ['slots', 'locale', 'layout']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'silkroad: dictionaries')
  ctx.effect(ensureStyles, 'silkroad: styles')
  ctx.effect(() => bindHost(actions), 'silkroad: host actions')
  const t = ctx.locale.bind(NS)

  actions.openPanel = () => ctx.layout.selectPanel(PANEL_ID)
  actions.openSchedules = () => { try { ctx.layout.selectPanel(SCHEDULES_PANEL_ID) } catch { /* schedule panel not installed */ } }
  ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS, inject: () => ({}) }, () => <Panel />))
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 20, label: () => t('panel'), locale: NS }, RouteIcon))

  for (const tool of Object.keys(TOOL_LABELS)) {
    ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({ name: 'tool.call.toolview', key: tool, locale: NS }, (props: ToolRowProps) => <SilkRoadToolRow {...props} name={tool} />))
  }

  ctx.plugin({
    name: 'dsh-silkroad-sessions',
    inject: ['slots', 'uiWorkspace', 'layout'],
    apply(scope) {
      actions.startSession = options => {
        scope.layout.selectPanel(null)
        scope.uiWorkspace.startSession(undefined, { ...options, ...options.prompt === undefined ? {} : { whenDraftExists: 'replace' } })
      }
      scope.effect(() => () => { actions.startSession = () => {} }, 'silkroad: session actions')
      scope.slots.inject('conversation.input.dock', () => scope.slots.register({ name: 'conversation.input.dock', id: 'silkroad', order: 30, locale: NS, inject: () => ({}) }, (props: { session?: { blank?: boolean } }) => <InputDock {...props} />))
      scope.slots.inject('conversation.hero.options', () => scope.slots.register({ name: 'conversation.hero.options', id: 'silkroad-sources', order: 30, locale: NS, inject: () => ({}) }, () => <SourcesPill />))
    },
  })

  ctx.plugin({
    name: 'dsh-silkroad-reports-tab',
    inject: ['slots', 'sidebarRight', 'sidebarRightTabs'],
    apply(scope) {
      scope.effect(() => scope.sidebarRightTabs.register({
        id: REPORTS_TAB_ID, kind: REPORTS_TAB_KIND, title: () => t('reports'),
        guide: [{ id: 'reports', order: 60, title: () => t('reports'), description: () => t('reportsGuide'), icon: ReportIcon }],
      }), 'silkroad: reports tab type')
      scope.slots.inject('sidebar.right.pane.tab', () => scope.slots.register({ name: 'sidebar.right.pane.tab', key: REPORTS_TAB_ID, locale: NS, inject: () => ({}) },
        () => <ReportsBrowser layout="narrow" initial={takePendingReport()} />))
      scope.slots.inject('sidebar.right.pane.tab.title', () => scope.slots.register({ name: 'sidebar.right.pane.tab.title', key: REPORTS_TAB_ID, locale: NS },
        () => <><ReportIcon size={14} /> {t('reports')}</>))
      actions.openReportsTab = () => {
        try { scope.sidebarRight.openTab(REPORTS_TAB_KIND); return true } catch { return false }
      }
      scope.effect(() => () => { actions.openReportsTab = () => false }, 'silkroad: reports tab action')
      scope.slots.inject('conversation.session.header.utilities', () => scope.slots.register({ name: 'conversation.session.header.utilities', id: 'silkroad-reports', order: 20, locale: NS, inject: () => ({}) },
        () => <button type="button" title={t('reports')} aria-label={t('reports')} onClick={() => { actions.openReportsTab() }}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, border: 'none', borderRadius: 6, background: 'transparent', color: 'inherit', cursor: 'pointer', opacity: 0.75 }}>
          <ReportIcon size={16} />
        </button>))
    },
  })

  ctx.plugin({
    name: 'dsh-silkroad-schedules',
    inject: ['remote', 'remote.schedule'],
    apply(scope) {
      actions.listSchedules = async () => {
        const result = await scope.remote.schedule.catalog()
        return result.ok && Array.isArray(result.value) ? result.value : []
      }
      scope.effect(() => () => { actions.listSchedules = async () => [] }, 'silkroad: schedules')
    },
  })
}
