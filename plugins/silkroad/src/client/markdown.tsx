/**
 * Minimal Markdown → React for report previews: headings, paragraphs, lists,
 * block quotes, fenced code, GFM tables, bold/italic/inline code and http(s)
 * links. Builds elements only (no HTML strings), so report text cannot inject markup.
 */
import type { ReactNode } from 'react'

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\*[^*\s][^*]*\*)/g

export function inline(text: string, keyPrefix = 'i'): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let index = 0
  for (const match of text.matchAll(INLINE)) {
    const token = match[0]
    if (match.index > last) out.push(text.slice(last, match.index))
    const key = `${keyPrefix}${index++}`
    if (token.startsWith('**')) out.push(<strong key={key}>{token.slice(2, -2)}</strong>)
    else if (token.startsWith('`')) out.push(<code key={key}>{token.slice(1, -1)}</code>)
    else if (token.startsWith('[')) {
      const [, label, href] = token.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)!
      out.push(/^https?:\/\//i.test(href!) ? <a key={key} href={href} target="_blank" rel="noreferrer">{label}</a> : `${label} (${href})`)
    } else out.push(<em key={key}>{token.slice(1, -1)}</em>)
    last = match.index + token.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

const cells = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim())
const isDivider = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line)

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let key = 0
  while (i < lines.length) {
    const line = lines[i]!
    if (!line.trim()) { i++; continue }
    const fence = line.match(/^```/)
    if (fence) {
      const body: string[] = []
      i++
      while (i < lines.length && !lines[i]!.startsWith('```')) body.push(lines[i++]!)
      i++
      blocks.push(<pre key={key++}><code>{body.join('\n')}</code></pre>)
      continue
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      const level = Math.min(heading[1]!.length, 3)
      const content = inline(heading[2]!, `h${key}`)
      blocks.push(level === 1 ? <h1 key={key++}>{content}</h1> : level === 2 ? <h2 key={key++}>{content}</h2> : <h3 key={key++}>{content}</h3>)
      i++
      continue
    }
    if (line.includes('|') && i + 1 < lines.length && isDivider(lines[i + 1]!)) {
      const head = cells(line)
      const rows: string[][] = []
      i += 2
      while (i < lines.length && lines[i]!.includes('|') && lines[i]!.trim()) rows.push(cells(lines[i++]!))
      blocks.push(<table key={key++}><thead><tr>{head.map((cell, c) => <th key={c}>{inline(cell, `t${c}`)}</th>)}</tr></thead>
        <tbody>{rows.map((row, r) => <tr key={r}>{head.map((_, c) => <td key={c}>{inline(row[c] ?? '', `t${r}-${c}`)}</td>)}</tr>)}</tbody></table>)
      continue
    }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line)
      const items: string[] = []
      const marker = ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*+]\s+/
      while (i < lines.length && marker.test(lines[i]!)) items.push(lines[i++]!.replace(/^\s*([-*+]|\d+[.)])\s+/, ''))
      const children = items.map((item, n) => <li key={n}>{inline(item.replace(/^\[( |x)\]\s*/i, match => match.includes('x') ? '☑ ' : '☐ '), `l${n}`)}</li>)
      blocks.push(ordered ? <ol key={key++}>{children}</ol> : <ul key={key++}>{children}</ul>)
      continue
    }
    if (line.startsWith('>')) {
      const quote: string[] = []
      while (i < lines.length && lines[i]!.startsWith('>')) quote.push(lines[i++]!.replace(/^>\s?/, ''))
      blocks.push(<blockquote key={key++}>{inline(quote.join(' '), `q${key}`)}</blockquote>)
      continue
    }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) { blocks.push(<hr key={key++} />); i++; continue }
    const paragraph: string[] = []
    while (i < lines.length && lines[i]!.trim() && !/^(#{1,6}\s|```|>|\s*([-*+]|\d+[.)])\s+)/.test(lines[i]!)
      && !(lines[i]!.includes('|') && i + 1 < lines.length && isDivider(lines[i + 1]!))) paragraph.push(lines[i++]!)
    blocks.push(<p key={key++}>{inline(paragraph.join(' '), `p${key}`)}</p>)
  }
  return <div className="sr-md">{blocks}</div>
}

/** CSV preview as a table (first 200 rows). */
export function CsvTable({ text }: { text: string }) {
  const rows = parseCsv(text).slice(0, 201)
  if (rows.length === 0) return null
  const [head, ...body] = rows
  return <div className="sr-md"><table><thead><tr>{head!.map((cell, c) => <th key={c}>{cell}</th>)}</tr></thead>
    <tbody>{body.map((row, r) => <tr key={r}>{head!.map((_, c) => <td key={c}>{row[c] ?? ''}</td>)}</tr>)}</tbody></table></div>
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows.filter(r => r.some(value => value !== ''))
}
