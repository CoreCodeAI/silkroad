/**
 * The SilkRoad main panel. Tabs follow what the user wants to do:
 * 场景 (start a task) · 角色团队 · 数据源 · 知识库 · 报表.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { ConnectorStatus } from '../connectors/oauth-connector.ts'
import type { RoleStatus, VendorStatus } from '../hub.ts'
import type { ShopStatus } from '../tiktok-shop/client.ts'
import { api, type HubStatus } from './api.ts'
import { ReportsBrowser } from './reports.tsx'
import { SCENARIOS } from './scenarios.ts'
import { listSchedules, onPanelTabRequest, openSchedules, refreshStatus, startRole, startScenario, takeRequestedTab, useStatus, type ScheduleRecord } from './state.ts'
import { Badge, errorText, ScenarioPicker, Tabs } from './ui.tsx'
import { BrandMark } from './brand.tsx'

export type PanelTab = 'scenarios' | 'roles' | 'sources' | 'knowledge' | 'reports'

const TABS: { id: PanelTab; label: string }[] = [
  { id: 'scenarios', label: '场景' },
  { id: 'roles', label: '角色团队' },
  { id: 'sources', label: '数据源' },
  { id: 'knowledge', label: '知识库' },
  { id: 'reports', label: '报表' },
]

const OK = 'var(--sr-ok)'
const WARN = 'var(--sr-warn)'
const BAD = 'var(--sr-bad)'
const IDLE = 'var(--sr-muted)'
const ACCENT = 'var(--sr-accent)'

const CONNECTOR_STATE: Record<ConnectorStatus['state'], { label: string; color: string }> = {
  connected: { label: '已连接', color: OK },
  disconnected: { label: '未登录', color: IDLE },
  'awaiting-browser': { label: '等待浏览器登录', color: WARN },
  expired: { label: '登录已过期', color: WARN },
  error: { label: '登录失败', color: BAD },
}

const VENDOR_STATE: Record<VendorStatus['state'], { label: string; color: string }> = {
  configured: { label: '已配置', color: OK },
  anonymous: { label: '匿名可用', color: ACCENT },
  missing: { label: '缺少 API key', color: IDLE },
}

const ROLE_STATE: Record<RoleStatus['state'], { label: string; color: string }> = {
  ready: { label: '可用', color: OK },
  pending: { label: '加载中', color: IDLE },
  broken: { label: '无法加载', color: BAD },
}

const SHOP_STATE: Record<ShopStatus['state'], { label: string; color: string }> = {
  unconfigured: { label: '未配置应用', color: IDLE },
  disconnected: { label: '未授权', color: IDLE },
  'awaiting-authorization': { label: '等待授权', color: WARN },
  connected: { label: '已连接', color: OK },
  expired: { label: '授权已过期', color: WARN },
}

function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const run = useCallback(async (task: () => Promise<unknown>) => {
    setBusy(true); setError(undefined)
    try { await task(); await refreshStatus() } catch (cause) { setError(errorText(cause)) } finally { setBusy(false) }
  }, [])
  return { busy, error, run }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="sr-row" style={{ marginBottom: 6 }}><span className="sr-muted" style={{ width: 84 }}>{label}</span>{children}</div>
}

// ── 数据源 ─────────────────────────────────────────────────────────────

function ConnectorCard({ item }: { item: ConnectorStatus }) {
  const { busy, error, run } = useAction()
  const [link, setLink] = useState<string>()
  const login = () => run(async () => { const result = await api.login(item.id); setLink(result.authorizationUrl) })
  return <div className="sr-card">
    <div className="sr-row">
      <span className="sr-title">{item.title}</span><Badge {...CONNECTOR_STATE[item.state]} />
      <span style={{ flex: 1 }} />
      {item.state === 'connected'
        ? <button className="sr-btn" disabled={busy} onClick={() => run(() => api.logout(item.id))}>退出登录</button>
        : <button className="sr-btn sr-btn-primary" disabled={busy} onClick={login}>{item.state === 'awaiting-browser' ? '重新打开登录页' : '在浏览器中登录'}</button>}
    </div>
    <div className="sr-muted">{item.summary}</div>
    {item.state === 'connected' && <div className="sr-muted">对话中可用的工具以 <code>{item.toolPrefix}</code> 开头{item.expiresAt ? `；登录有效期至 ${new Date(item.expiresAt).toLocaleString()}，到期前会自动续期` : ''}。</div>}
    {item.state === 'awaiting-browser' && <div className="sr-muted">请在打开的浏览器页面里登录并同意授权，完成后这里会自动变成"已连接"。{link && <> 浏览器没有打开？<a href={link} target="_blank" rel="noreferrer">手动打开登录页</a></>}</div>}
    {item.error && item.state !== 'connected' && <div className="sr-error">{item.error}</div>}
    {error && <div className="sr-error">{error}</div>}
  </div>
}

function ShopCard({ item }: { item: ShopStatus }) {
  const { busy, error, run } = useAction()
  const [values, setValues] = useState({ appKey: item.appKey, serviceId: item.serviceId, region: item.region as string })
  const [secret, setSecret] = useState('')
  const [pasted, setPasted] = useState('')
  const [link, setLink] = useState<string>()
  const dirty = values.appKey !== item.appKey || values.serviceId !== item.serviceId || values.region !== item.region
  const text = (id: 'appKey' | 'serviceId', hint: string) => <input className="sr-input" value={values[id]} placeholder={hint} onChange={event => setValues(current => ({ ...current, [id]: event.target.value }))} />
  return <div className="sr-card">
    <div className="sr-row">
      <span className="sr-title">{item.title}</span><Badge {...SHOP_STATE[item.state]} />
      <span style={{ flex: 1 }} />
      {item.state === 'connected' && <button className="sr-btn" disabled={busy} onClick={() => run(() => api.shopDisconnect())}>断开</button>}
    </div>
    <div className="sr-muted">你自己店铺的订单、商品、买家消息和退货退款（只读）。需要在 TikTok Shop Partner Center 创建自己的应用。</div>
    {item.state === 'connected' && <div className="sr-muted">
      {item.sellerName ? `卖家：${item.sellerName}；` : ''}店铺：{item.shops.map(shop => `${shop.name}（${shop.region}）`).join('、') || '无'}
    </div>}
    <div style={{ marginTop: 8 }}>
      <Field label="App Key">{text('appKey', 'Partner Center 应用的 App Key')}</Field>
      <Field label="Service ID">{text('serviceId', '应用的 Service ID（授权链接里的 service_id）')}</Field>
      <Field label="授权地区">
        <select className="sr-input" value={values.region} onChange={event => setValues(current => ({ ...current, region: event.target.value }))}>
          <option value="global">全球（美国以外）</option>
          <option value="us">美国</option>
        </select>
      </Field>
      {dirty && <button className="sr-btn sr-btn-primary" disabled={busy} onClick={() => run(() => api.shopSettings(values))}>保存设置</button>}
    </div>
    {item.writable && <Field label="App Secret">
      <input className="sr-input" type="password" autoComplete="off" placeholder={item.secretConfigured ? '已保存；输入新值以替换' : '粘贴 App Secret'} value={secret} onChange={event => setSecret(event.target.value)} />
      <button className="sr-btn sr-btn-primary" disabled={busy || !secret.trim()} onClick={() => run(async () => { await api.shopSecret(secret); setSecret('') })}>保存</button>
      {item.secretConfigured && <button className="sr-btn" disabled={busy} onClick={() => run(() => api.shopClearSecret())}>清除</button>}
    </Field>}
    {item.state !== 'unconfigured' && item.state !== 'connected' && <div style={{ marginTop: 10 }}>
      <button className="sr-btn sr-btn-primary" disabled={busy} onClick={() => run(async () => { setLink((await api.shopAuthorize()).authorizationUrl) })}>{item.state === 'awaiting-authorization' ? '重新打开授权页' : '授权店铺'}</button>
      {item.state === 'awaiting-authorization' && <div style={{ marginTop: 8 }}>
        <div className="sr-muted">在浏览器里用卖家账号同意授权。之后浏览器会跳到你应用设置的回调地址：把那个完整地址（含 code=）粘贴到下面。{link && <> 浏览器没打开？<a href={link} target="_blank" rel="noreferrer">手动打开授权页</a></>}</div>
        <div className="sr-row" style={{ marginTop: 6 }}>
          <input className="sr-input" placeholder="https://…?code=…&state=…" value={pasted} onChange={event => setPasted(event.target.value)} />
          <button className="sr-btn sr-btn-primary" disabled={busy || !pasted.trim()} onClick={() => run(async () => { await api.shopComplete(pasted); setPasted('') })}>完成授权</button>
        </div>
      </div>}
    </div>}
    {item.callbackUrl && item.state !== 'connected' && <div className="sr-muted" style={{ marginTop: 6 }}>也可以把应用的回调地址设成 <code>{item.callbackUrl}</code>，授权后会自动完成（这个地址的端口在 Desktop 重启后可能变化）。</div>}
    {item.error && <div className="sr-error">{item.error}</div>}
    {error && <div className="sr-error">{error}</div>}
  </div>
}

function VendorCard({ item }: { item: VendorStatus }) {
  const { busy, error, run } = useAction()
  const [value, setValue] = useState('')
  const initial = Object.fromEntries((item.settings ?? []).map(setting => [setting.id, setting.value]))
  const [values, setValues] = useState<Record<string, string>>(initial)
  const dirty = (item.settings ?? []).some(setting => values[setting.id] !== setting.value)
  const save = () => run(async () => { await api.saveKey(item.id, value); setValue('') })
  return <div className="sr-card">
    <div className="sr-row"><span className="sr-title">{item.title}</span><Badge {...VENDOR_STATE[item.state]} /></div>
    <div className="sr-muted">{item.summary}</div>
    {item.settings && <div style={{ marginTop: 8 }}>
      {item.settings.map(setting => <Field key={setting.id} label={setting.label}>
        <input className="sr-input" value={values[setting.id] ?? ''} title={setting.hint} placeholder={setting.hint}
          onChange={event => setValues(current => ({ ...current, [setting.id]: event.target.value }))} />
      </Field>)}
      {dirty && <button className="sr-btn sr-btn-primary" disabled={busy} onClick={() => run(() => api.saveSettings(item.id, values))}>保存设置</button>}
    </div>}
    {item.writable
      ? <div className="sr-row" style={{ marginTop: 8 }}>
          <input className="sr-input" type="password" autoComplete="off" placeholder={item.state === 'configured' ? '输入新 key 以替换' : '粘贴你的 API key'}
            value={value} onChange={event => setValue(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && value.trim()) void save() }} />
          <button className="sr-btn sr-btn-primary" disabled={busy || !value.trim()} onClick={save}>保存</button>
          {item.state === 'configured' && <button className="sr-btn" disabled={busy} onClick={() => run(() => api.clearKey(item.id))}>清除</button>}
        </div>
      : <div className="sr-muted">当前凭据存储不可写，请通过环境变量配置。</div>}
    <div className="sr-muted">还没有 key？<a href={item.signup} target="_blank" rel="noreferrer">去 {item.signupLabel} 申请</a>。key 只保存在本机的丝路凭据里，不会显示，也不会进入对话。</div>
    {error && <div className="sr-error">{error}</div>}
  </div>
}

function SourcesTab({ status }: { status: HubStatus }) {
  return <>
    <p className="sr-muted" style={{ marginTop: 0 }}>所有数据都用你自己的账号或 API key 获取。连上哪个，智能体就能用哪个；缺少某个数据源只影响依赖它的场景。</p>
    <h3 style={{ fontSize: 15, margin: '16px 0 8px' }}>账号登录</h3>
    {status.connectors.map(item => <ConnectorCard key={item.id} item={item} />)}
    {status.shop && <>
      <h3 style={{ fontSize: 15, margin: '16px 0 8px' }}>我的店铺</h3>
      <ShopCard item={status.shop} />
    </>}
    <h3 style={{ fontSize: 15, margin: '16px 0 8px' }}>API key</h3>
    {status.vendors.map(item => <VendorCard key={item.id} item={item} />)}
  </>
}

// ── 知识库 ─────────────────────────────────────────────────────────────

function KnowledgeTab({ status }: { status: HubStatus }) {
  const { busy, error, run } = useAction()
  const item = status.knowledge
  const uses = SCENARIOS.filter(scenario => scenario.needs.includes('knowledge'))
  return <>
    <div className="sr-card">
      <div className="sr-row">
        <span className="sr-title">本地知识库</span>
        <Badge {...item.files > 0 ? { label: `${item.files} 个文件`, color: OK } : { label: item.exists ? '还没有内容' : '未创建', color: IDLE }} />
        <span style={{ flex: 1 }} />
        <button className="sr-btn sr-btn-primary" disabled={busy} onClick={() => run(() => api.openKnowledge())}>{item.exists ? '打开文件夹' : '创建并打开'}</button>
      </div>
      <div className="sr-muted">位置：<code>{item.directory}</code></div>
      {error && <div className="sr-error">{error}</div>}
    </div>
    <div className="sr-card">
      <div className="sr-title" style={{ marginBottom: 4 }}>放什么</div>
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        <li><code>products/</code>：每个商品一个文件，写卖点、规格、材质、包装清单、常见问题和不能说的宣称。</li>
        <li><code>policies/</code>：退换货、物流、保修等售后规则，写清楚能承诺什么、什么情况转人工。</li>
        <li><code>replies/</code>：你认可的回复示例和固定话术（可选）。</li>
      </ul>
      <div className="sr-muted" style={{ marginTop: 6 }}>用 Markdown 或纯文本最好，表格可以用 CSV。智能体直接读这些文件，不需要额外导入。</div>
    </div>
    <div className="sr-muted">用到知识库的场景：{uses.map(scenario => scenario.title).join('、')}。</div>
  </>
}

// ── 角色团队 ───────────────────────────────────────────────────────────

const DIRECTOR = 'silkroad-ops-director'

function RolesTab({ status }: { status: HubStatus }) {
  const director = status.roles.find(role => role.id === DIRECTOR)
  const specialists = status.roles.filter(role => role.id !== DIRECTOR)
  const launch = SCENARIOS.find(scenario => scenario.id === 'launch-team')!
  const card = (role: RoleStatus, lead = false) => <div key={role.id} className="sr-card" style={lead ? { borderColor: 'var(--sr-accent)' } : undefined}>
    <div className="sr-row">
      <span className="sr-title">{role.name}</span><Badge {...ROLE_STATE[role.state]} />
      <span style={{ flex: 1 }} />
      <button className={lead ? 'sr-btn sr-btn-primary' : 'sr-btn'} disabled={role.state !== 'ready'} onClick={() => startRole(role.id)}>用这个角色新建会话</button>
    </div>
    <div className="sr-muted">{role.description}</div>
    {role.broken && <div className="sr-error">{role.broken}</div>}
  </div>
  return <>
    <p className="sr-muted" style={{ marginTop: 0 }}>「TikTok 新品上新」团队：运营总监负责统筹，把选品、定价、Listing 分给三位专家，最后汇总成一页上新方案。也可以单独找某位专家。新建会话后，输入框上方的模式菜单会显示当前角色，可以随时切换。</p>
    {director && card(director, true)}
    {director?.state === 'ready' && <div style={{ margin: '-4px 0 14px' }}>
      <button className="sr-link" onClick={() => startScenario(launch)}>直接开始「{launch.title}」→</button>
    </div>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>{specialists.map(role => card(role))}</div>
  </>
}

// ── 报表 ───────────────────────────────────────────────────────────────

function nextRun(iso?: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : `下次 ${date.toLocaleString(undefined, { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })}`
}

function ReportsTab() {
  const [schedules, setSchedules] = useState<ScheduleRecord[]>()
  useEffect(() => {
    let live = true
    listSchedules().then(records => { if (live) setSchedules(records.filter(record => record.status === 'active' && /tiktok-|silkroad|周报|报表|报告/i.test(`${record.title} ${record.prompt}`))) }, () => { if (live) setSchedules([]) })
    return () => { live = false }
  }, [])
  const weekly = SCENARIOS.find(scenario => scenario.id === 'weekly-report')!
  return <>
    <div className="sr-card">
      <div className="sr-row">
        <span className="sr-title">定时报表</span>
        <span style={{ flex: 1 }} />
        <button className="sr-btn" onClick={openSchedules}>管理全部定时任务</button>
        <button className="sr-btn sr-btn-primary" onClick={() => startScenario(weekly)}>设置每周报表</button>
      </div>
      {schedules === undefined && <div className="sr-muted">正在读取…</div>}
      {schedules?.length === 0 && <div className="sr-muted">还没有定时报表。设置后，每周会在创建它的会话里自动生成报告，并保存到下面的报告列表。DeepSeek Harness 需要在运行；错过的那次会在下次启动时补上。</div>}
      {schedules?.map(record => <div key={record.id} className="sr-row" style={{ marginTop: 4 }}>
        <span>{record.title}</span><span className="sr-muted">{nextRun(record.scheduledAt)}</span>
      </div>)}
    </div>
    <ReportsBrowser layout="wide" />
  </>
}

// ── 场景 ───────────────────────────────────────────────────────────────

function ScenariosTab({ status }: { status: HubStatus }) {
  const [query, setQuery] = useState('')
  return <>
    <div className="sr-row" style={{ marginBottom: 10 }}>
      <input className="sr-input" style={{ maxWidth: 320 }} placeholder="搜索场景，例如 达人、定价、差评" value={query} onChange={event => setQuery(event.target.value)} />
      <span className="sr-muted">点一个场景会新建会话、选好角色并填好提示词。把【】里的内容换成你的信息再发送。</span>
    </div>
    <ScenarioPicker status={status} query={query} />
    <p className="sr-muted" style={{ marginTop: 14 }}>标着「需 …」的场景缺少对应的数据源，仍然可以用，但结论会少一部分数据支撑。去「数据源」连接后就会变成绿色。SilkRoad 只出草稿，上架、发消息之前请自己再看一遍。</p>
  </>
}

// ── Panel ──────────────────────────────────────────────────────────────

export function Panel() {
  const { status, error } = useStatus()
  const [tab, setTab] = useState<PanelTab>(() => (takeRequestedTab() as PanelTab | undefined) ?? 'scenarios')
  useEffect(() => onPanelTabRequest(() => { const next = takeRequestedTab(); if (next) setTab(next as PanelTab) }), [])

  return <div className="sr-root" style={{ padding: '20px 24px', overflow: 'auto', height: '100%', boxSizing: 'border-box' }}>
    <div style={{ maxWidth: 1040, margin: '0 auto' }}>
      <div className="sr-row" style={{ gap: 10, marginBottom: 2 }}><BrandMark size={28} /><h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>丝路 SilkRoad</h1></div>
      <p className="sr-muted" style={{ margin: '0 0 14px' }}>跨境电商智能体：选品上新、内容素材、店铺运营、客服售后、达人营销。只读数据、只出草稿，不替你发消息、改价或花钱。</p>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {error && !status && <div className="sr-error">{error}</div>}
      {!status && !error && <div className="sr-muted">正在读取状态…</div>}
      {status && <>
        {tab === 'scenarios' && <ScenariosTab status={status} />}
        {tab === 'roles' && <RolesTab status={status} />}
        {tab === 'sources' && <SourcesTab status={status} />}
        {tab === 'knowledge' && <KnowledgeTab status={status} />}
        {tab === 'reports' && <ReportsTab />}
      </>}
    </div>
  </div>
}
