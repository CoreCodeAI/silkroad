/**
 * Shared client state: one status poller for every SilkRoad surface (panel,
 * input dock, right-sidebar tab), and the host actions those surfaces call.
 * Polling runs only while something is subscribed.
 */
import { useSyncExternalStore } from 'react'
import { api, type HubStatus } from './api.ts'
import type { Need, Scenario } from './scenarios.ts'
import { scenarioPrompt } from './scenarios.ts'

const POLL_MS = 4000

interface Snapshot { status?: HubStatus; error?: string }

let snapshot: Snapshot = {}
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | undefined
let inFlight: Promise<void> | undefined

function publish(next: Snapshot): void {
  snapshot = next
  for (const listener of listeners) listener()
}

/** Fetch the status now; concurrent callers share one request. */
export function refreshStatus(): Promise<void> {
  inFlight ??= api.status()
    .then(status => publish({ status }), cause => publish({ ...snapshot, error: cause instanceof Error ? cause.message : String(cause) }))
    .finally(() => { inFlight = undefined })
  return inFlight
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (listeners.size === 1) {
    void refreshStatus()
    timer = setInterval(() => { void refreshStatus() }, POLL_MS)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timer !== undefined) { clearInterval(timer); timer = undefined }
  }
}

export function useStatus(): Snapshot {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot)
}

/** Whether a data source a scenario relies on is usable right now. */
export function needMet(status: HubStatus | undefined, need: Need): boolean | undefined {
  if (!status) return undefined
  switch (need) {
    case 'market': return status.connectors.some(item => item.id === 'fastmoss' && item.state === 'connected')
      || status.vendors.some(item => item.id === 'kalodata' && item.state === 'configured')
    case 'shop': return status.shop?.state === 'connected'
    case 'serpapi': return status.vendors.some(item => item.id === 'serpapi' && item.state === 'configured')
    case 'image': return status.vendors.some(item => item.id === 'image' && item.state === 'configured')
    case 'knowledge': return status.knowledge.files > 0
  }
}

/** Host operations, bound once in `apply` so components stay free of the client context. */
export interface HostActions {
  startSession(options: { agentPreset?: string; prompt?: string }): void
  openPanel(): void
  /** Open the reports viewer in the current session's right sidebar; false when no session is open. */
  openReportsTab(path?: string): boolean
  /** DSH scheduled tasks (all sessions); empty when the schedule service is unavailable. */
  listSchedules(): Promise<ScheduleRecord[]>
  openSchedules(): void
}

export interface ScheduleRecord { id: string; sessionId: string; title: string; prompt: string; scheduledAt?: string; kind: string; status: string }

export function listSchedules(): Promise<ScheduleRecord[]> {
  return host?.listSchedules() ?? Promise.resolve([])
}
export function openSchedules(): void { host?.openSchedules() }

let host: HostActions | undefined
export function bindHost(actions: HostActions): () => void {
  host = actions
  return () => { if (host === actions) host = undefined }
}

/** Panel tab requested by another surface (e.g. the dock's 管理 link). */
let requestedTab: string | undefined
const tabListeners = new Set<() => void>()
export function requestPanelTab(tab: string): void {
  requestedTab = tab
  for (const listener of tabListeners) listener()
  host?.openPanel()
}
export function takeRequestedTab(): string | undefined {
  const tab = requestedTab
  requestedTab = undefined
  return tab
}
export function onPanelTabRequest(listener: () => void): () => void {
  tabListeners.add(listener)
  return () => { tabListeners.delete(listener) }
}

/** Report the right-sidebar viewer should show first, set before it opens. */
let pendingReport: string | undefined
export function takePendingReport(): string | undefined {
  const path = pendingReport
  pendingReport = undefined
  return path
}

export function startScenario(scenario: Scenario): void {
  host?.startSession({ ...scenario.preset ? { agentPreset: scenario.preset } : {}, prompt: scenarioPrompt(scenario) })
}

export function startRole(preset: string): void {
  host?.startSession({ agentPreset: preset })
}

export function openReport(path?: string): boolean {
  pendingReport = path
  const opened = host?.openReportsTab(path) ?? false
  if (!opened) pendingReport = undefined
  return opened
}

export function openPanel(tab?: string): void {
  if (tab) requestPanelTab(tab)
  else host?.openPanel()
}
