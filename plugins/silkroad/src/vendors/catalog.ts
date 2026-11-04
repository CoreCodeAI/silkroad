/**
 * Data sources reached with an API key the user supplies. Keys are stored in
 * DSH credentials under the ref named here and never travel through chat.
 */
export interface ApiKeyVendorSpec {
  id: string
  title: string
  summary: string
  /** DSH credential ref; also read from the environment when unset. */
  credential: string
  /** True when the vendor also works without a key (with a lower free quota). */
  keyOptional: boolean
  signup: string
  /** Who issues the key, when it differs from the title. */
  signupLabel?: string
  /** Non-secret settings the user can edit next to the key, stored in a credential record. */
  settings?: readonly VendorSettingSpec[]
}

export interface VendorSettingSpec {
  id: string
  label: string
  default: string
  hint?: string
}

export const API_KEY_VENDORS: readonly ApiKeyVendorSpec[] = [
  {
    id: 'serpapi',
    title: 'SerpApi',
    summary: 'Google 搜索、Google Trends、Google Shopping、Amazon、YouTube 等搜索结果',
    credential: 'SILKROAD_SERPAPI_API_KEY',
    keyOptional: false,
    signup: 'https://serpapi.com/manage-api-key',
  },
  {
    id: 'anysearch',
    title: 'AnySearch',
    summary: '通用网页搜索；不填密钥也可匿名使用（每日免费额度）',
    credential: 'SILKROAD_ANYSEARCH_API_KEY',
    keyOptional: true,
    signup: 'https://anysearch.com/console/api-keys',
  },
  {
    id: 'image',
    title: '图片生成',
    summary: '商品主图、详情图生成；任何兼容 OpenAI Images 接口的服务都可以（OpenAI 或你自己的网关）',
    credential: 'SILKROAD_IMAGE_API_KEY',
    keyOptional: false,
    signup: 'https://platform.openai.com/api-keys',
    signupLabel: 'OpenAI（或你使用的图片服务）',
    settings: [
      { id: 'baseUrl', label: '接口地址', default: 'https://api.openai.com/v1', hint: '兼容 OpenAI Images 接口的服务地址，以 /v1 结尾' },
      { id: 'model', label: '模型', default: 'gpt-image-1', hint: '该服务上的图片模型名' },
    ],
  },
  {
    id: 'kalodata',
    title: 'Kalodata',
    summary: 'TikTok Shop 商品、店铺、达人、视频、直播、类目的榜单和详情，以及商品卖点和评论洞察（Kalodata Open API，按积分计费：详情每次 0.1 积分，榜单每 100 行 0.1 积分）',
    credential: 'SILKROAD_KALODATA_API_KEY',
    keyOptional: false,
    signup: 'https://www.kalodata.com/open-center/account',
    signupLabel: 'Kalodata 开放中心 → 账户管理（生成 Key）',
    settings: [
      { id: 'language', label: '数据语言', default: 'zh-CN', hint: '商品名、类目名等文字字段的语言，如 zh-CN、en-US' },
      { id: 'currency', label: '货币', default: 'USD', hint: '销售额和价格的货币，如 USD、CNY、GBP' },
      { id: 'baseUrl', label: '接口地址', default: 'https://www.kalodata.com', hint: '一般不用改' },
    ],
  },
]

export function vendorById(id: string): ApiKeyVendorSpec | undefined {
  return API_KEY_VENDORS.find(vendor => vendor.id === id)
}
