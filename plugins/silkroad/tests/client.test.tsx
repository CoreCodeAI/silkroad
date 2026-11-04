import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CATEGORIES, SCENARIOS, placeholders, scenarioPrompt } from '../src/client/scenarios.ts'
import { ROLES } from '../src/presets.ts'
import { Markdown, parseCsv } from '../src/client/markdown.tsx'
import { columnsFor, findRows, formatCell, SilkRoadToolRow, TOOL_LABELS } from '../src/client/toolviews.tsx'
import { needMet } from '../src/client/state.ts'
import { sourceProgress, sourceSummary } from '../src/client/dock.tsx'
import { listReports, readReport, reportPath } from '../src/reports.ts'
import type { HubStatus } from '../src/hub.ts'

describe('scenario catalog', () => {
  it('points every scenario at a bundled skill and a registered role', () => {
    const roles = new Set(ROLES.map(role => role.id))
    for (const scenario of SCENARIOS) {
      expect(existsSync(join('skills', scenario.skill, 'SKILL.md')), scenario.skill).toBe(true)
      if (scenario.preset) expect(roles.has(scenario.preset), scenario.preset).toBe(true)
      expect(CATEGORIES.map(category => category.id)).toContain(scenario.category)
      expect(placeholders(scenario.prompt).length, scenario.id).toBeGreaterThan(0)
      expect(scenarioPrompt(scenario)).toContain(scenario.skill)
    }
  })

  it('covers every bundled tiktok skill and has unique ids', () => {
    const skills = new Set(SCENARIOS.map(scenario => scenario.skill))
    for (const name of ['tiktok-product-research', 'tiktok-market-opportunity', 'tiktok-listing-seo', 'tiktok-pricing-strategy', 'tiktok-product-images', 'tiktok-video-script',
      'tiktok-launch-team', 'tiktok-buyer-reply', 'tiktok-review-insights', 'tiktok-shop-diagnosis', 'tiktok-competitor-shop', 'tiktok-gmv-max-diagnosis', 'tiktok-weekly-report',
      'tiktok-creator-discovery', 'tiktok-creator-outreach', 'tiktok-sample-brief', 'tiktok-product-diagnosis', 'tiktok-creator-diagnosis', 'tiktok-viral-video-breakdown']) expect(skills.has(name), name).toBe(true)
    expect(new Set(SCENARIOS.map(scenario => scenario.id)).size).toBe(SCENARIOS.length)
  })

  it('reads placeholders in order', () => {
    expect(placeholders('给【商品】在【站点，如 美国】定价')).toEqual(['商品', '站点，如 美国'])
  })
})

const status = {
  connectors: [{ id: 'fastmoss', title: 'FastMoss', state: 'connected' }],
  vendors: [{ id: 'serpapi', title: 'SerpApi', state: 'missing' }, { id: 'image', title: '图片生成', state: 'configured' }],
  roles: [],
  shop: { state: 'disconnected', shops: [] },
  knowledge: { directory: '/k', exists: true, files: 5 },
  reports: { directory: '/r', exists: false, count: 0 },
} as unknown as HubStatus

describe('data source summary', () => {
  it('maps scenario needs to connection state', () => {
    expect(needMet(status, 'market')).toBe(true)
    expect(needMet(status, 'serpapi')).toBe(false)
    expect(needMet(status, 'image')).toBe(true)
    expect(needMet(status, 'shop')).toBe(false)
    expect(needMet(status, 'knowledge')).toBe(true)
    expect(needMet(undefined, 'market')).toBeUndefined()
  })

  it('accepts either FastMoss or a Kalodata key as TikTok market data', () => {
    const offline = { ...status, connectors: [{ id: 'fastmoss', title: 'FastMoss', state: 'disconnected' }] } as unknown as HubStatus
    expect(needMet(offline, 'market')).toBe(false)
    const kalodata = { ...offline, vendors: [...offline.vendors, { id: 'kalodata', title: 'Kalodata', state: 'configured' }] } as unknown as HubStatus
    expect(needMet(kalodata, 'market')).toBe(true)
  })

  it('lists connected and missing sources for the dock strip', () => {
    expect(sourceSummary(status)).toEqual([
      { label: 'FastMoss', state: '已连接', ok: true },
      { label: '我的店铺', state: '未授权', ok: false },
      { label: '图片生成', state: '已配置', ok: true },
      { label: '知识库', state: '5 个文件', ok: true },
    ])
    expect(sourceProgress(status)).toEqual({ ready: 2, total: 3 })
  })

  it('renders category tabs and one chip per scenario plus 全部场景', async () => {
    const { ScenarioQuick, chipHint } = await import('../src/client/ui.tsx')
    const html = renderToStaticMarkup(<ScenarioQuick status={status} onMore={() => {}} />)
    expect(html.match(/role="tab"/g)).toHaveLength(CATEGORIES.length)
    const launch = SCENARIOS.filter(item => item.category === 'launch')
    expect(html.match(/class="sr-chip"/g)).toHaveLength(launch.length)
    expect(html).toContain('全部场景')
    const research = SCENARIOS.find(item => item.id === 'product-research')!
    expect(chipHint(research, status).missing).toEqual(['SerpApi'])
  })
})

describe('markdown preview', () => {
  it('renders headings, tables, lists and safe links only', () => {
    const html = renderToStaticMarkup(<Markdown text={'# 周报\n\n| 指标 | 本周 |\n|---|---|\n| GMV | **$1,200** |\n\n- 一\n- [链接](https://example.com)\n- [坏](javascript:alert(1))\n\n<script>x</script>'} />)
    expect(html).toContain('<h1>周报</h1>')
    expect(html).toContain('<th>指标</th>')
    expect(html).toContain('<strong>$1,200</strong>')
    expect(html).toContain('href="https://example.com"')
    expect(html).not.toContain('href="javascript')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('parses quoted CSV cells', () => {
    expect(parseCsv('a,b\n"x, y","say ""hi"""\n')).toEqual([['a', 'b'], ['x, y', 'say "hi"']])
  })
})

describe('tool result rows', () => {
  it('finds the collection and picks preferred columns', () => {
    const value = { orders: [{ id: '1', status: 'COMPLETED', create_time: 1700000000, payment: { total_amount: '9.99', currency: 'USD' }, line_items: [{ sku: 'a' }] }], next_page_token: 'x' }
    const table = findRows(value)!
    expect(table.key).toBe('orders')
    expect(columnsFor(table.key, table.rows).slice(0, 5)).toEqual(['id', 'status', 'create_time', 'payment.total_amount', 'payment.currency'])
    expect(formatCell('create_time', 1700000000)).toMatch(/2023/)
    expect(formatCell('line_items', [{ sku: 'a' }])).toBe('1 项')
  })

  it('falls back to the first array of objects', () => {
    expect(findRows({ data: { list: [{ a: 1 }] } })?.key).toBe('list')
    expect(findRows({ ok: true })).toBeUndefined()
  })

  it('renders a settled call as a summary line and every SilkRoad tool has a label', () => {
    const block = { kind: 'result', callId: 'c1', call: { argsRaw: '{"status":"COMPLETED"}' }, content: [{ type: 'text', text: JSON.stringify({ orders: [{ id: '1' }, { id: '2' }] }) }] }
    const html = renderToStaticMarkup(<SilkRoadToolRow name="silkroad_tts_orders" phase="settled" block={block} />)
    expect(html).toContain('读取订单')
    expect(html).toContain('COMPLETED')
    expect(html).toContain('2 条')
    const failed = renderToStaticMarkup(<SilkRoadToolRow name="silkroad_knowledge" block={{ kind: 'result', isError: true, content: [{ type: 'text', text: 'boom\nmore' }] }} />)
    expect(failed).toContain('boom')
    expect(Object.keys(TOOL_LABELS)).toContain('silkroad_tts_returns')
  })
})

describe('reports folder', () => {
  it('lists reports newest first with titles and refuses paths outside the folder', async () => {
    const root = await mkdtemp(join(tmpdir(), 'silkroad-reports-'))
    await mkdir(join(root, 'input'))
    await writeFile(join(root, 'weekly-2026-11-02.md'), '# 第 45 周经营周报\n\n内容')
    await writeFile(join(root, 'input', 'gmv.csv'), 'a,b\n1,2\n')
    await writeFile(join(root, 'image.png'), 'x')
    const files = await listReports(root)
    expect(files.map(file => file.path).sort()).toEqual(['input/gmv.csv', 'weekly-2026-11-02.md'])
    expect(files.find(file => file.path.endsWith('.md'))?.title).toBe('第 45 周经营周报')
    const report = await readReport(root, 'weekly-2026-11-02.md')
    expect(report.text).toContain('内容')
    expect(() => reportPath(root, '../secret.md')).toThrow()
    expect(() => reportPath(root, '/etc/passwd')).toThrow()
    expect(() => reportPath(root, 'image.png')).toThrow()
    await expect(readReport(root, 'missing.md')).rejects.toThrow(/不存在/)
    expect(await listReports(join(root, 'nope'))).toEqual([])
  })
})

describe('status details', () => {
  it('counts only the user\'s own knowledge files', async () => {
    const { ensureKnowledgeDirectory, knowledgeStatus } = await import('../src/knowledge.ts')
    const root = join(await mkdtemp(join(tmpdir(), 'silkroad-kbs-')), 'knowledge')
    await ensureKnowledgeDirectory(root)
    expect((await knowledgeStatus(root)).files).toBe(0)
    await writeFile(join(root, 'products', 'lamp.md'), '# Lamp')
    expect((await knowledgeStatus(root)).files).toBe(1)
  })

  it('splits an ordered list from a following bullet list', () => {
    const html = renderToStaticMarkup(<Markdown text={'1. a\n2. b\n- c'} />)
    expect(html).toBe('<div class="sr-md"><ol><li>a</li><li>b</li></ol><ul><li>c</li></ul></div>')
  })
})

describe('brand', () => {
  it('renders the panel mark with per-instance gradient ids', async () => {
    const { BrandMark } = await import('../src/client/brand.tsx')
    const html = renderToStaticMarkup(<><BrandMark size={28} /><BrandMark /></>)
    expect(html.match(/<svg/g)).toHaveLength(2)
    expect(html).toContain('width="28"')
  })
})
