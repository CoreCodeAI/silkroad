/**
 * Reports are plain files the skills save under `~/SilkRoad/reports/`
 * (weekly reports, shop diagnoses, competitor teardowns). This module lists
 * them and reads one for the panel and the right-sidebar viewer. Reads are
 * confined to the folder: no absolute paths, no `..`, text files only.
 */
import { readdir, readFile, stat } from 'node:fs/promises'
import { extname, isAbsolute, join, normalize, relative, sep } from 'node:path'
import { UserError } from './hub-errors.ts'
import { silkroadHome } from './knowledge.ts'

const REPORT_EXTENSIONS = new Set(['.md', '.txt', '.csv'])
const MAX_LISTED = 500
const MAX_READ_BYTES = 1024 * 1024

export function defaultReportsDirectory(): string {
  return join(silkroadHome(), 'reports')
}

export interface ReportFile {
  /** Path relative to the reports folder, `/`-separated. */
  path: string
  title: string
  bytes: number
  modified: string
}

export interface ReportsStatus { directory: string; exists: boolean; count: number; latest?: ReportFile }

function titleOf(path: string, text: string | undefined): string {
  const heading = text?.match(/^#\s+(.+)$/m)?.[1]?.trim()
  return heading || path.split('/').pop()!.replace(/\.[^.]+$/, '')
}

/** Every report file, newest first. Missing folder lists as empty. */
export async function listReports(directory: string): Promise<ReportFile[]> {
  const found: ReportFile[] = []
  const walk = async (folder: string, depth: number): Promise<void> => {
    if (depth > 3 || found.length >= MAX_LISTED) return
    const entries = await readdir(folder, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const full = join(folder, entry.name)
      if (entry.isDirectory()) { await walk(full, depth + 1); continue }
      if (!entry.isFile() || !REPORT_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue
      const info = await stat(full).catch(() => undefined)
      if (!info) continue
      const path = relative(directory, full).split(sep).join('/')
      const head = extname(entry.name).toLowerCase() === '.md'
        ? await readFile(full, 'utf8').then(text => text.slice(0, 2048), () => undefined) : undefined
      found.push({ path, title: titleOf(path, head), bytes: info.size, modified: info.mtime.toISOString() })
    }
  }
  await walk(directory, 0)
  return found.sort((a, b) => b.modified.localeCompare(a.modified))
}

export async function reportsStatus(directory: string): Promise<ReportsStatus> {
  const exists = await stat(directory).then(info => info.isDirectory(), () => false)
  if (!exists) return { directory, exists, count: 0 }
  const files = await listReports(directory)
  return { directory, exists, count: files.length, ...files[0] ? { latest: files[0] } : {} }
}

/** Resolve a listed relative path inside the folder, refusing anything that escapes it. */
export function reportPath(directory: string, path: unknown): string {
  if (typeof path !== 'string' || !path || path.includes('\0') || isAbsolute(path)) throw new UserError(400, '报告路径无效。')
  const clean = normalize(path)
  if (clean === '..' || clean.startsWith(`..${sep}`) || isAbsolute(clean)) throw new UserError(400, '报告路径无效。')
  if (!REPORT_EXTENSIONS.has(extname(clean).toLowerCase())) throw new UserError(400, '只能打开 .md、.txt、.csv 报告。')
  return join(directory, clean)
}

export async function readReport(directory: string, path: unknown): Promise<{ path: string; title: string; text: string; truncated: boolean; modified: string }> {
  const full = reportPath(directory, path)
  const info = await stat(full).catch(() => undefined)
  if (!info?.isFile()) throw new UserError(404, '报告不存在，可能已被移动或删除。')
  const buffer = await readFile(full)
  const truncated = buffer.length > MAX_READ_BYTES
  const text = buffer.subarray(0, MAX_READ_BYTES).toString('utf8')
  const relativePath = relative(directory, full).split(sep).join('/')
  return { path: relativePath, title: titleOf(relativePath, text), text, truncated, modified: info.mtime.toISOString() }
}
