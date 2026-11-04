/**
 * `tool.call.toolview` rows for SilkRoad's tools: one summary line (what was
 * read, how many rows), expandable to a table of the result, with the raw
 * JSON one click further. Everything is derived from the tool's own output.
 */
import { useState } from 'react'

export const TOOL_LABELS: Record<string, string> = {
  silkroad_status: '查看数据源状态',
  silkroad_connect: '连接数据源',
  silkroad_knowledge: '查知识库',
  silkroad_generate_image: '生成图片',
  silkroad_kalodata_rank: 'Kalodata 榜单',
  silkroad_kalodata_detail: 'Kalodata 详情',
  silkroad_kalodata_product_insight: 'Kalodata 商品洞察',
  silkroad_kalodata_media: 'Kalodata 图片和视频链接',
  silkroad_kalodata_credit: 'Kalodata 积分',
  silkroad_serpapi_search: '搜索（SerpApi）',
  silkroad_web_search: '网页搜索',
  silkroad_tts_shops: '读取已授权店铺',
  silkroad_tts_orders: '读取订单',
  silkroad_tts_products: '读取商品',
  silkroad_tts_messages: '读取买家消息',
  silkroad_tts_returns: '读取退货退款',
  silkroad_tts_api: '读取店铺数据',
}

/** Preferred columns per collection key; the rest are filled from the data. */
const PREFERRED: Record<string, string[]> = {
  orders: ['id', 'status', 'create_time', 'payment.total_amount', 'payment.currency', 'buyer_message'],
  products: ['id', 'title', 'status', 'skus', 'create_time', 'update_time'],
  conversations: ['id', 'participant_count', 'unread_count', 'latest_message.content', 'update_time'],
  messages: ['sender.role', 'type', 'content', 'create_time'],
  return_orders: ['return_id', 'order_id', 'return_status', 'return_reason_text', 'refund_amount.refund_total', 'create_time'],
  shops: ['name', 'region', 'id', 'code'],
  matches: ['path', 'line', 'text'],
  files: ['path', 'title', 'bytes', 'modified'],
  organic_results: ['position', 'title', 'link', 'snippet'],
  shopping_results: ['position', 'title', 'price', 'source', 'rating', 'reviews'],
  results: ['title', 'url', 'snippet'],
}

interface Block {
  callId?: string
  argsRaw?: string
  kind?: string
  call?: { argsRaw?: string }
  content?: { type: string; text?: string }[]
  isError?: boolean
  error?: { name?: string; code?: string }
}

export interface ToolRowProps { phase?: string; block?: Block }

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

function resultText(block: Block): string | null {
  if (!('kind' in block) || block.kind === undefined) return null
  const parts = (block.content ?? []).map(item => item.type === 'text' ? item.text ?? '' : JSON.stringify(item))
  if (parts.length === 0 && block.error) parts.push(`${block.error.name ?? 'Error'}: ${block.error.code ?? ''}`)
  return parts.join('\n') || null
}

function parse(text: string | null): Json | undefined {
  if (text === null) return undefined
  try { return JSON.parse(text) as Json } catch { return undefined }
}

const isRecord = (value: Json | undefined): value is { [key: string]: Json } => typeof value === 'object' && value !== null && !Array.isArray(value)

/** The most table-like array in a result: a known collection key first, else the first array of objects. */
export function findRows(value: Json | undefined): { key: string; rows: { [key: string]: Json }[] } | undefined {
  const queue: { key: string; value: Json; depth: number }[] = [{ key: '', value: value ?? null, depth: 0 }]
  let fallback: { key: string; rows: { [key: string]: Json }[] } | undefined
  while (queue.length) {
    const { key, value: current, depth } = queue.shift()!
    if (Array.isArray(current)) {
      const rows = current.filter(isRecord)
      if (rows.length > 0) {
        if (key in PREFERRED) return { key, rows }
        fallback ??= { key, rows }
      }
      continue
    }
    if (isRecord(current) && depth < 4) for (const [child, inner] of Object.entries(current)) queue.push({ key: child, value: inner, depth: depth + 1 })
  }
  return fallback
}

function pick(row: { [key: string]: Json }, path: string): Json | undefined {
  let current: Json | undefined = row
  for (const part of path.split('.')) current = isRecord(current) ? current[part] : undefined
  return current
}

/** Scalar columns, one level of nesting flattened, preferred ones first, at most `max`. */
export function columnsFor(key: string, rows: { [key: string]: Json }[], max = 6): string[] {
  const seen: string[] = []
  const add = (column: string) => { if (!seen.includes(column)) seen.push(column) }
  for (const row of rows.slice(0, 20)) for (const [name, value] of Object.entries(row)) {
    if (isRecord(value)) { for (const [inner, innerValue] of Object.entries(value)) if (!isRecord(innerValue) && !Array.isArray(innerValue)) add(`${name}.${inner}`) }
    else add(name)
  }
  const preferred = (PREFERRED[key] ?? []).filter(column => rows.some(row => pick(row, column) !== undefined))
  return [...preferred, ...seen.filter(column => !preferred.includes(column))].slice(0, max)
}

export function formatCell(column: string, value: Json | undefined): string {
  if (value === undefined || value === null) return ''
  if (Array.isArray(value)) return value.length === 0 ? '' : value.every(item => !isRecord(item) && !Array.isArray(item)) ? value.join(', ') : `${value.length} 项`
  if (isRecord(value)) return JSON.stringify(value)
  if (typeof value === 'number' && /time|_at$|date/i.test(column) && value > 1e9 && value < 1e13) {
    return new Date(value < 1e12 ? value * 1000 : value).toLocaleString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  const text = String(value)
  return text.length > 160 ? `${text.slice(0, 157)}…` : text
}

function argsSummary(raw: string | undefined): string {
  if (!raw) return ''
  try {
    const args = JSON.parse(raw) as Record<string, unknown>
    return Object.entries(args).filter(([, value]) => value !== undefined && value !== null && value !== '' && typeof value !== 'object')
      .slice(0, 3).map(([, value]) => String(value)).join(' · ').slice(0, 80)
  } catch { return '' }
}

export function SilkRoadToolRow({ phase, block, name }: ToolRowProps & { name: string }) {
  const [open, setOpen] = useState(false)
  const [raw, setRaw] = useState(false)
  const label = TOOL_LABELS[name] ?? name
  if (phase === 'preparing' || !block) return <div className="sr-root sr-strip" data-tool={name}><span>{label}…</span></div>

  const settled = block.kind !== undefined
  const output = resultText(block)
  const failed = settled && (block.isError === true || block.error !== undefined)
  const value = parse(output)
  const table = failed ? undefined : findRows(value)
  const args = argsSummary(settled ? block.call?.argsRaw : block.argsRaw)
  const summary = !settled ? '进行中…' : failed ? (output?.split('\n')[0] ?? '失败') : table ? `${table.rows.length} 条` : output ? '完成' : '无结果'
  const more = isRecord(value) && (typeof value.next_page_token === 'string' && value.next_page_token !== '' || typeof value.note === 'string')

  return <div className="sr-root" data-tool={name} style={{ margin: '4px 0' }}>
    <button className="sr-list-item" style={{ padding: '3px 6px', display: 'flex', gap: 8, alignItems: 'center' }} onClick={() => setOpen(!open)} aria-expanded={open} disabled={!output}>
      <span style={{ opacity: 0.6, width: 12 }}>{output ? (open ? '▾' : '▸') : '·'}</span>
      <span style={{ fontWeight: 500, fontSize: 13 }}>{label}</span>
      {args && <span className="sr-muted" style={{ fontSize: 12 }}>{args}</span>}
      <span style={{ fontSize: 12, color: failed ? 'var(--sr-bad)' : 'var(--sr-muted)', opacity: failed ? 1 : 0.8 }}>{summary}{more ? ' · 还有更多' : ''}</span>
    </button>
    {open && output && <div style={{ margin: '4px 0 8px 26px' }}>
      {table && !raw && <div style={{ overflow: 'auto', maxHeight: 360 }}>
        <ResultTable collection={table.key} rows={table.rows} />
      </div>}
      {(raw || !table) && <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, maxHeight: 360, overflow: 'auto', margin: 0 }}>{value !== undefined ? JSON.stringify(value, null, 2) : output}</pre>}
      {table && <button className="sr-link" style={{ fontSize: 12 }} onClick={() => setRaw(!raw)}>{raw ? '显示表格' : '查看原始数据'}</button>}
    </div>}
  </div>
}

function ResultTable({ collection, rows }: { collection: string; rows: { [key: string]: Json }[] }) {
  const columns = columnsFor(collection, rows)
  return <table className="sr-table">
    <thead><tr>{columns.map(column => <th key={column}>{column}</th>)}</tr></thead>
    <tbody>{rows.slice(0, 100).map((row, index) => <tr key={index}>{columns.map(column => {
      const text = formatCell(column, pick(row, column))
      return <td key={column} title={text.length > 40 ? text : undefined}>{text}</td>
    })}</tr>)}</tbody>
  </table>
}
