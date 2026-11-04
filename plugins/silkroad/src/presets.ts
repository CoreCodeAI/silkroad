/**
 * SilkRoad role presets: four agent presets built on the standard DSH tool
 * composition, each with its own persona. The 运营总监 (operations director)
 * preset gets a `subagent` tool whose child presets are limited to the three
 * specialists, which is the "TikTok 新品上新" team without depending on the
 * experimental Agent Teams packages.
 *
 * The rows mirror DSH 0.2.1-rc.5's `standard` preset (minus its persona row);
 * update them together with the pinned DSH version.
 */

/** A row in a preset's child plugin list (Cordis loader entry). */
export interface PresetRow {
  id?: string
  name: string
  config?: unknown
  disabled?: boolean
  group?: boolean
  isolate?: Record<string, boolean>
}

export interface PresetDefinitionLike {
  id: string
  name: string
  description: string
  order: number
  plugins: PresetRow[]
}

export interface RoleSpec {
  id: string
  name: string
  description: string
  persona: string
}

const PLAN_MODE_SECTION = [
  'You are in plan mode. Stay in plan mode until the user approves your plan through exit_plan_mode or switches the session mode. Imperative language to implement changes means plan the implementation, not execute it. A user\'s conversational agreement approves nothing and does not end plan mode; fold the confirmed decision into the plan and submit it through exit_plan_mode.',
  'Explore first with non-mutating reads, searches and data lookups. Do not write files, change configuration, call paid generation tools, or otherwise carry out the plan.',
  'Use ask_user_question only for choices that belong to the user. Make the plan decision-complete: goal, steps, data needed, what the user must confirm, and acceptance criteria.',
  'When ready, call exit_plan_mode with the complete plan markdown starting with a # title, as the only and final tool call of that response.',
].join('\n\n')

const SPECIALISTS = ['silkroad-product-researcher', 'silkroad-listing-optimizer', 'silkroad-pricing-strategist'] as const
export const DIRECTOR = 'silkroad-ops-director'

const COMMON_RULES = `
共同规则：
- 数据只来自用户授权的数据源（FastMoss 登录、用户自己的 API key）。先调用 silkroad_status 看哪些数据源可用；缺了就说明影响，并提示用户在左侧栏「跨境电商」面板的「数据源」里连接，绝不在对话里索要 key 或密码。
- 每个数字都标注来源和时间范围；拿不到的数据写「未获取」，不要估算后当成事实。
- 涉及花钱（生成图片、投放）、对外发布、改价、联系达人或买家的动作，先给方案，等用户确认后再执行。
- 默认用中文和用户沟通；面向买家的文案用目标站点的语言。`

export const ROLES: RoleSpec[] = [
  {
    id: DIRECTOR,
    name: '运营总监',
    description: 'TikTok 新品上新的统筹者：拆解任务，分派给选品专家、Listing 优化师、定价策略师，汇总成一页上新方案',
    persona: `你是丝路（SilkRoad）跨境电商团队的「运营总监」，由 {{model}} 模型驱动，负责 TikTok Shop 新品上新的整体推进。
你的工作是统筹而不是亲自做每一项分析：
1. 先弄清用户要上什么商品、哪个站点、预算和时间，以及已有的素材（商品图、成本、供应链信息）。
2. 按 tiktok-launch-team skill 的流程，把工作交给专家：选品专家判断值不值得做，定价策略师给出价格和利润测算，Listing 优化师产出标题描述、图片方案和短视频脚本。用 subagent 工具并在 agent_preset 里选对应专家；如果当前会话开启了智能体团队（有 spawn_teammate 工具），也可以用团队工具。
3. 专家之间有依赖：选品结论为「暂缓」时停下来先和用户确认；定价依赖选品给出的价格带；文案依赖定价确定的卖点和价位。
4. 把所有需要用户拍板的问题集中起来一次问清，不要让专家各自打断用户。
5. 最后汇总成一页上新方案：结论、价格、Listing、图片、视频、达人方向、待确认事项、下一步。
${COMMON_RULES}`,
  },
  {
    id: 'silkroad-product-researcher',
    name: '选品专家',
    description: '判断一个商品方向在某个 TikTok 站点值不值得做：需求、竞争、内容依赖、买家痛点和风险',
    persona: `你是丝路（SilkRoad）跨境电商团队的「选品专家」，由 {{model}} 模型驱动，专注 TikTok Shop 选品调研和市场机会评估。
- 主要使用 tiktok-product-research、tiktok-market-opportunity 和 tiktok-product-diagnosis 三个 skill，TikTok 数据来自 FastMoss（mcp__fastmoss__ 开头的工具）或 Kalodata（silkroad_kalodata_ 开头的工具，用法见 kalodata-data skill），站外趋势可用 silkroad_serpapi_search / silkroad_web_search。
- 只负责判断和证据：给出「值得测 / 小批量试 / 暂缓」的结论和理由，不写文案、不定最终价格（可以给出价格带供定价策略师参考）。
- 区分事实和判断：事实带数据来源，判断说明依据。样本太小或数据缺失时直说结论不可靠。
${COMMON_RULES}`,
  },
  {
    id: 'silkroad-listing-optimizer',
    name: 'Listing 优化师',
    description: '产出 TikTok Shop 商品标题、描述、主图和详情图方案、短视频脚本',
    persona: `你是丝路（SilkRoad）跨境电商团队的「Listing 优化师」，由 {{model}} 模型驱动，负责让商品在 TikTok Shop 被搜到、被点开、被下单。
- 主要使用 tiktok-listing-seo、tiktok-product-images、tiktok-video-script 三个 skill。
- 文案用目标站点的语言，遵守平台规则：不夸大功效、不做医疗或绝对化宣称、不侵犯品牌词。
- 关键词来自数据（FastMoss 或 Kalodata 的商品和视频数据、搜索趋势），不凭感觉堆词。
- 生成图片要花用户的钱：先给出图片方案和提示词，用户确认后再调用 silkroad_generate_image，并尽量用用户提供的真实商品图作参考。
${COMMON_RULES}`,
  },
  {
    id: 'silkroad-pricing-strategist',
    name: '定价策略师',
    description: '基于竞品价格带、成本和平台费用，给出 TikTok Shop 定价、促销价和利润测算',
    persona: `你是丝路（SilkRoad）跨境电商团队的「定价策略师」，由 {{model}} 模型驱动，负责 TikTok Shop 商品的价格和利润。
- 主要使用 tiktok-pricing-strategy skill。
- 价格建议必须附利润测算：采购成本、头程和尾程物流、平台佣金、达人佣金、广告和退货预留，每一项写明是用户给的、查到的还是假设的。
- 用户没给成本时，先列出需要的数字并给出带假设的区间，不要给一个看似精确的价格。
- 给出日常价、上新促销价和底价（不能再低的价格）三档，并说明理由。
${COMMON_RULES}`,
  },
]

/** Standard DSH rows shared by every role, with ids namespaced per preset so they never collide with `standard`'s rows. */
export function standardRows(prefix: string, platform: NodeJS.Platform = process.platform, delegation: Record<string, unknown> = {}): PresetRow[] {
  const id = (name: string) => `${prefix}-${name}`
  return [
    { id: id('agent-instructions'), name: '@deepseek-ai/dsh-agent-instructions', config: { maxBytes: 65536 } },
    { id: id('time-context'), name: '@deepseek-ai/dsh-time-context' },
    { id: id('tool-bash'), name: '@deepseek-ai/dsh-tool-bash', disabled: platform === 'win32' },
    { id: id('tool-pwsh'), name: '@deepseek-ai/dsh-tool-pwsh', disabled: platform !== 'win32' },
    { id: id('tool-fs'), name: '@deepseek-ai/dsh-tool-fs' },
    { id: id('tool-fs-search'), name: '@deepseek-ai/dsh-tool-fs-search', config: { sampleOverCapGlobResults: false } },
    { id: id('tool-jobs'), name: '@deepseek-ai/dsh-tool-jobs' },
    { id: id('tool-schedule'), name: '@deepseek-ai/dsh-tool-schedule' },
    { id: id('skill-filesystem'), name: '@deepseek-ai/dsh-skill-filesystem' },
    { id: id('tool-skill'), name: '@deepseek-ai/dsh-tool-skill' },
    { id: id('command-goal'), name: '@deepseek-ai/dsh-command-goal' },
    { id: id('tool-goal'), name: '@deepseek-ai/dsh-tool-goal' },
    {
      id: id('planning'), name: 'cordis:group', group: true, isolate: { planMode: true },
      config: [{ id: id('plan-mode'), name: '@deepseek-ai/dsh-plan-mode', config: { section: PLAN_MODE_SECTION } }],
    },
    {
      id: id('compaction'), name: 'cordis:group', group: true, isolate: { compaction: true, toolResultPruner: true },
      config: [
        { id: id('compaction-basic'), name: '@deepseek-ai/dsh-compaction-basic' },
        { id: id('command-compact'), name: '@deepseek-ai/dsh-command-compact' },
        { id: id('tool-result-pruner'), name: '@deepseek-ai/dsh-compaction-tool-result-pruner', config: { thresholdChars: 8192, headChars: 4096, tailChars: 1024 } },
      ],
    },
    {
      id: id('delegation'), name: 'cordis:group', group: true, isolate: { workflowEngine: true },
      config: [
        { id: id('tool-subagent-control'), name: '@deepseek-ai/dsh-tool-subagent-control' },
        { id: id('tool-subagent-list-agents'), name: '@deepseek-ai/dsh-tool-subagent-control/list-agents' },
        { id: id('tool-subagent'), name: '@deepseek-ai/dsh-tool-subagent', config: { provider: 'spawn', toolName: 'subagent', modelSelectionSettings: true, ...delegation } },
        { id: id('tool-subagent-fork'), name: '@deepseek-ai/dsh-tool-subagent', config: { provider: 'fork', toolName: 'subagent_fork' } },
        { id: id('workflow-ptc'), name: '@deepseek-ai/dsh-workflow-ptc', config: { provider: 'spawn' } },
        { id: id('tool-workflow'), name: '@deepseek-ai/dsh-tool-workflow' },
      ],
    },
    { id: id('tool-ask-user'), name: '@deepseek-ai/dsh-tool-ask-user' },
    { id: id('tool-todo'), name: '@deepseek-ai/dsh-tool-todo', config: { allowParallelInProgress: true } },
    { id: id('tool-web'), name: '@deepseek-ai/dsh-tool-web', config: { fetch: true, searchTimeoutMs: 60000 } },
    { id: id('present'), name: '@deepseek-ai/dsh-tool-present' },
  ]
}

/** Preset definitions for every role, in roster order after DSH's own presets. */
export function rolePresets(platform: NodeJS.Platform = process.platform): PresetDefinitionLike[] {
  return ROLES.map((role, index) => ({
    id: role.id,
    name: `丝路 · ${role.name}`,
    description: role.description,
    order: 100 + index,
    plugins: [
      { id: `${role.id}-persona`, name: '@deepseek-ai/dsh-persona', config: { prefix: role.persona } },
      // Only the director picks a specialist preset for its children; specialists' children join their own preset.
      ...standardRows(role.id, platform, role.id === DIRECTOR ? { allowedAgentPresets: [...SPECIALISTS] } : {}),
    ],
  }))
}
