/**
 * Report browser: the files skills saved under ~/SilkRoad/reports, with a
 * preview. Used by the right-sidebar tab (narrow, list then preview) and the
 * panel's 报表 tab (wide, list beside preview).
 */
import { useCallback, useEffect, useState } from 'react'
import { api, type ReportContent, type ReportFile } from './api.ts'
import { CsvTable, Markdown } from './markdown.tsx'
import { errorText } from './ui.tsx'

function when(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function Preview({ path, onBack }: { path: string; onBack?: () => void }) {
  const [report, setReport] = useState<ReportContent>()
  const [error, setError] = useState<string>()
  useEffect(() => {
    let live = true
    setReport(undefined); setError(undefined)
    api.readReport(path).then(value => { if (live) setReport(value) }, cause => { if (live) setError(errorText(cause)) })
    return () => { live = false }
  }, [path])
  return <div>
    <div className="sr-row" style={{ marginBottom: 6 }}>
      {onBack && <button className="sr-link" onClick={onBack}>← 全部报告</button>}
      <span style={{ flex: 1 }} />
      {report && <span className="sr-muted" style={{ fontSize: 12 }}>{report.path} · {when(report.modified)}</span>}
    </div>
    {error && <div className="sr-error">{error}</div>}
    {!report && !error && <div className="sr-muted">正在读取…</div>}
    {report && (report.path.toLowerCase().endsWith('.csv') ? <CsvTable text={report.text} />
      : report.path.toLowerCase().endsWith('.md') ? <Markdown text={report.text} />
      : <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12.5 }}>{report.text}</pre>)}
    {report?.truncated && <div className="sr-muted">文件太大，只显示了前 1 MB。</div>}
  </div>
}

export function ReportsBrowser({ layout, initial }: { layout: 'narrow' | 'wide'; initial?: string }) {
  const [files, setFiles] = useState<ReportFile[]>()
  const [directory, setDirectory] = useState<string>()
  const [error, setError] = useState<string>()
  const [selected, setSelected] = useState<string | undefined>(initial)
  const load = useCallback(async () => {
    try { const result = await api.reports(); setFiles(result.files); setDirectory(result.directory); setError(undefined) } catch (cause) { setError(errorText(cause)) }
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => { if (initial) setSelected(initial) }, [initial])
  useEffect(() => {
    if (layout === 'wide' && !selected && files?.[0]) setSelected(files[0].path)
  }, [layout, selected, files])

  const list = <div>
    <div className="sr-row" style={{ marginBottom: 6 }}>
      <span className="sr-title">报告</span>
      <span className="sr-muted">{files ? `${files.length} 份` : ''}</span>
      <span style={{ flex: 1 }} />
      <button className="sr-link" onClick={() => { void load() }}>刷新</button>
      <button className="sr-link" onClick={() => { void api.openReports().catch(cause => setError(errorText(cause))) }}>打开文件夹</button>
    </div>
    {error && <div className="sr-error">{error}</div>}
    {files?.length === 0 && <div className="sr-muted">还没有报告。店铺诊断、竞品拆解、每周报表等场景生成的报告会保存在 <code>{directory}</code>，并出现在这里。</div>}
    {files?.map(file => <button key={file.path} className="sr-list-item" aria-current={file.path === selected} onClick={() => setSelected(file.path)}>
      <div style={{ fontWeight: 500, fontSize: 13 }}>{file.title}</div>
      <div className="sr-muted" style={{ fontSize: 12 }}>{file.path} · {when(file.modified)}</div>
    </button>)}
  </div>

  if (layout === 'narrow') {
    return <div className="sr-root" style={{ padding: '12px 14px', overflow: 'auto', height: '100%', boxSizing: 'border-box' }}>
      {selected ? <Preview path={selected} onBack={() => setSelected(undefined)} /> : list}
    </div>
  }
  return <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
    <div>{list}</div>
    <div className="sr-card" style={{ minHeight: 200 }}>{selected ? <Preview path={selected} /> : <div className="sr-muted">选择左边的报告查看。</div>}</div>
  </div>
}
