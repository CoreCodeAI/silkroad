/**
 * Scenario catalog behind the new-session cards and the panel's 场景 tab.
 * Each scenario names the skill it runs, the role preset it starts with,
 * the data sources that make it work well, and a prompt with 【…】 fields
 * for the user to fill in before sending.
 */

export type Need = 'market' | 'shop' | 'serpapi' | 'image' | 'knowledge'

export interface Scenario {
  id: string
  category: CategoryId
  title: string
  summary: string
  skill: string
  /** Role preset to start the session with; omitted keeps the session's current mode. */
  preset?: string
  /** Sources the scenario relies on; the first is the essential one. */
  needs: Need[]
  prompt: string
}

export type CategoryId = 'launch' | 'content' | 'operations' | 'service' | 'creators'

export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'launch', label: '选品上新' },
  { id: 'content', label: '内容素材' },
  { id: 'operations', label: '店铺运营' },
  { id: 'service', label: '客服售后' },
  { id: 'creators', label: '达人营销' },
]

export const NEED_LABEL: Record<Need, string> = {
  market: 'TikTok 数据',
  shop: '我的店铺',
  serpapi: 'SerpApi',
  image: '图片生成',
  knowledge: '知识库',
}

const RESEARCHER = 'silkroad-product-researcher'
const LISTING = 'silkroad-listing-optimizer'
const PRICING = 'silkroad-pricing-strategist'
const DIRECTOR = 'silkroad-ops-director'

export const SCENARIOS: Scenario[] = [
  {
    id: 'launch-team', category: 'launch', title: '新品上新全流程', skill: 'tiktok-launch-team', preset: DIRECTOR, needs: ['market', 'serpapi'],
    summary: '运营总监带选品、定价、Listing 三位专家，产出一页上新方案',
    prompt: '我准备在 TikTok Shop【站点，如 美国】上架【商品】。采购成本约【成本】，预算【预算】。请按新品上新流程，组织团队给我一份完整的上新方案。',
  },
  {
    id: 'product-research', category: 'launch', title: '选品调研', skill: 'tiktok-product-research', preset: RESEARCHER, needs: ['market', 'serpapi'],
    summary: '看需求、竞争、价格带和买家痛点，判断值不值得做',
    prompt: '帮我调研【商品或关键词】在 TikTok Shop【站点】的机会：需求趋势、竞品和价格带、内容打法、买家痛点，最后给出能不能做的结论。',
  },
  {
    id: 'market-opportunity', category: 'launch', title: '市场机会评估', skill: 'tiktok-market-opportunity', preset: RESEARCHER, needs: ['market'],
    summary: '比较一个类目在不同站点或细分方向的机会大小',
    prompt: '评估【类目】在 TikTok Shop【站点，可写多个】的市场机会：规模和增速、竞争集中度、新品机会、风险，并排个优先级。',
  },
  {
    id: 'pricing', category: 'launch', title: '定价与利润测算', skill: 'tiktok-pricing-strategy', preset: PRICING, needs: ['market'],
    summary: '参考竞品价格带，算出日常价、促销价和底价',
    prompt: '帮【商品】在 TikTok Shop【站点】定价。采购成本【成本】，头程【头程运费】，尾程【尾程运费】，达人佣金打算给【佣金率】。请给出日常价、上新促销价、底价和利润测算。',
  },
  {
    id: 'listing-seo', category: 'content', title: 'Listing 标题和描述', skill: 'tiktok-listing-seo', preset: LISTING, needs: ['market', 'knowledge'],
    summary: '用数据里的关键词写标题、卖点和详情描述',
    prompt: '为【商品】写 TikTok Shop【站点】的商品标题和详情描述。核心卖点：【卖点】。请先找出买家常搜的关键词，再给出标题（3 个备选）、五点卖点和描述。',
  },
  {
    id: 'product-images', category: 'content', title: '主图和详情图', skill: 'tiktok-product-images', preset: LISTING, needs: ['image', 'market'],
    summary: '先出图片方案和提示词，确认后再生成',
    prompt: '为【商品】设计 TikTok Shop 主图和详情图。我的商品图在【图片路径，可选】。先给我每张图的方案和提示词，我确认后再生成。',
  },
  {
    id: 'video-script', category: 'content', title: '短视频脚本', skill: 'tiktok-video-script', preset: LISTING, needs: ['market'],
    summary: '参考同类爆款的结构，写带货短视频脚本',
    prompt: '为【商品】写 3 条 TikTok 带货短视频脚本，目标站点【站点】，时长【15 秒/30 秒】。参考同类爆款视频的开头和结构，但不要照抄。',
  },
  {
    id: 'viral-video-breakdown', category: 'content', title: '爆款视频拆解', skill: 'tiktok-viral-video-breakdown', needs: ['market'],
    summary: '从卖得最好的带货视频里提炼能复用的打法',
    prompt: '拆解 TikTok【站点】【商品 ID、类目或竞品店铺】近 30 天卖得最好的带货视频：达人量级、时长、自然流量还是投放、转化效率和卖点角度，总结我能复用的打法。',
  },
  {
    id: 'shop-diagnosis', category: 'operations', title: '店铺经营诊断', skill: 'tiktok-shop-diagnosis', needs: ['shop', 'market'],
    summary: '核心指标环比、渠道和商品结构、问题清单和下周动作',
    prompt: '诊断我的 TikTok Shop 店铺【店铺名，或写"已授权的店铺"】最近 28 天的经营情况，对比前 28 天，找出主要问题并给出下周优先做的事。',
  },
  {
    id: 'product-diagnosis', category: 'operations', title: '单品诊断', skill: 'tiktok-product-diagnosis', preset: RESEARCHER, needs: ['market'],
    summary: '和同类同价位商品比，看这个商品差在哪、下一步试什么',
    prompt: '诊断 TikTok【站点】商品【商品 ID】：和同类目同价位的商品比，它处在什么位置、差在哪里（渠道、达人、内容、佣金），给出按优先级排序的改进建议。',
  },
  {
    id: 'competitor-shop', category: 'operations', title: '竞品店铺拆解', skill: 'tiktok-competitor-shop', needs: ['market'],
    summary: '拆它的商品、流量、达人和广告打法，找可学和可超越的点',
    prompt: '拆解 TikTok Shop 竞品店铺【店铺名或链接】：商品和价格带、流量渠道、达人矩阵、视频和直播打法、广告投入。最后告诉我能学什么、怎么做出差异。',
  },
  {
    id: 'gmv-max', category: 'operations', title: 'GMV Max 投放诊断', skill: 'tiktok-gmv-max-diagnosis', needs: ['market'],
    summary: '读你导出的报表，判断哪些商品该加预算、调目标或暂停',
    prompt: '诊断我的 GMV Max 投放。报表文件在【CSV 路径】，商品毛利率约【毛利率】。告诉我整体是否盈利，以及每个商品该加预算、维持、调 ROI 目标还是暂停。',
  },
  {
    id: 'weekly-report', category: 'operations', title: '每周自动报表', skill: 'tiktok-weekly-report', needs: ['shop', 'market'],
    summary: '每周一自动生成上周经营报告，保存到报告文件夹',
    prompt: '帮我设置每周经营报表：每周【一】早上【09:00】（时区【Asia/Shanghai】）生成上周报告，店铺【店铺】，关注竞品【竞品店铺，可选】。先跟我确认设置再创建定时任务。',
  },
  {
    id: 'buyer-reply', category: 'service', title: '买家消息回复', skill: 'tiktok-buyer-reply', needs: ['knowledge', 'shop'],
    summary: '按你的售后规则，用买家的语言起草回复',
    prompt: '帮我起草买家消息的回复。买家消息：【粘贴消息，或写"读取店铺里未回复的会话"】。按知识库里的售后规则回复，并附中文对照。',
  },
  {
    id: 'review-insights', category: 'service', title: '评论和差评洞察', skill: 'tiktok-review-insights', needs: ['market'],
    summary: '归纳好评卖点和差评原因，给出改品和改文案的建议',
    prompt: '分析【商品，或竞品商品链接】的买家评论：好评在夸什么、差评在抱怨什么、各占多少，并给出改进商品、Listing 和客服话术的建议。',
  },
  {
    id: 'creator-discovery', category: 'creators', title: '达人发现', skill: 'tiktok-creator-discovery', needs: ['market'],
    summary: '从竞品带货达人、类目和榜单里筛出合适的短名单',
    prompt: '帮【商品】在 TikTok【站点】找带货达人：粉丝量级【如 1 万-50 万】，预算【纯佣金/寄样/付费】，要【10】个。给我短名单和每个人的入选理由。',
  },
  {
    id: 'creator-diagnosis', category: 'creators', title: '达人诊断', skill: 'tiktok-creator-diagnosis', needs: ['market'],
    summary: '和同类同量级达人比，判断值不值得合作',
    prompt: '评估 TikTok【站点】达人【达人 handle 或 ID】：和同类目同粉丝量级的达人比，带货能力怎么样、视频和直播哪个强、适不适合我的商品【商品或类目，可选】。',
  },
  {
    id: 'creator-outreach', category: 'creators', title: '达人建联邮件', skill: 'tiktok-creator-outreach', needs: ['market'],
    summary: '个性化的首封邀请和跟进邮件，只出草稿',
    prompt: '给这些达人写合作邀请邮件：【达人名单】。商品【商品】，合作条件【佣金率、是否寄样、是否付费】。用达人的语言写首封和两封跟进，附中文对照。只出草稿，我自己发。',
  },
  {
    id: 'sample-brief', category: 'creators', title: '寄样简报', skill: 'tiktok-sample-brief', needs: ['knowledge', 'market'],
    summary: '给达人的一页内容简报：卖点、结构、必须做和不能做',
    prompt: '给达人【达人名或类型】写【商品】的寄样简报，站点【站点】，要求【发布时间、是否要广告授权码等】。用达人的语言写，并附中文版。',
  },
]

/** The prompt sent to the composer: the user's text plus which skill to use. */
export function scenarioPrompt(scenario: Scenario): string {
  return `${scenario.prompt}\n\n（请使用 ${scenario.skill} 技能。）`
}

/** Placeholder fields the user still has to replace, in order. */
export function placeholders(prompt: string): string[] {
  return [...prompt.matchAll(/【([^【】]+)】/g)].map(match => match[1]!)
}
