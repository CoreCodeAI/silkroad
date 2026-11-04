# SilkRoad 丝路

[English](README.md) | 中文

开源的跨境电商 AI 智能体，运行在 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 上。先做 TikTok Shop，之后扩展到亚马逊和独立站。

**所有数据都由你自己授权**：用自己的账号在浏览器里登录（OAuth），或者填写自己的 API key。SilkRoad 不内置任何共享权限，也不经过任何中转服务器。

## 现在能做什么

| 能力 | 数据源 | 授权方式 |
|---|---|---|
| TikTok Shop 市场数据（商品、店铺、达人、视频、直播、广告） | FastMoss 官方 MCP | 浏览器登录 FastMoss 账号 |
| TikTok Shop 商品、店铺、达人、视频、直播、类目的榜单和详情，商品卖点、评论洞察和原始评论 | Kalodata Open API | 填写自己的 Kalodata Key（在 Kalodata 开放中心「账户管理」生成，按积分计费） |
| Google 搜索 / Trends / Shopping、Amazon、YouTube 搜索结果 | SerpApi | 填写 API key |
| 通用网页搜索 | AnySearch | 可匿名，也可填 key |
| 商品图生成 | 任意 OpenAI Images 兼容服务 | 填写接口地址、模型和 key |
| 自己店铺的订单、商品、买家消息、退货（只读） | TikTok Shop 开放平台 | 自己的 Partner Center 应用 + 浏览器授权店铺 |
| 商品资料、售后规则 | 本地文件夹 `~/SilkRoad/knowledge` | 无需授权 |

key 只保存在本机的丝路凭据里，不会显示，也不会进入对话。

## 界面

**品牌**：丝路的名称、标志、首屏标语和安装包由丝路 SilkRoad 发行版本身提供（见仓库根目录的 README）；插件只提供面板里的丝路标志。首屏标语是「开辟你的跨境商路」和「选品、上新、运营、客服、达人营销，一路同行」，跟随语言设置，中文为默认，英文是 "SilkRoad / Open your own Silk Road"。

- **新会话首屏**：丝路标志和标语下面是五个分类（选品上新、内容素材、店铺运营、客服售后、达人营销）和该分类的场景按钮。点一下会选好角色、把提示词填进输入框，把【】里的内容换成你的信息再发送；鼠标停在按钮上能看到场景说明和还缺哪些数据源。「全部场景」打开面板里的完整列表。输入框上方一行是工作区、模式，右边是数据源状态（如「数据源 1/3」），点它去连接。
- **左侧栏「跨境电商」面板**：场景（可搜索）、角色团队（一键用某个角色新建会话）、数据源（登录、填 key、授权店铺）、知识库、报表（定时报表和报告预览）。
- **右侧边栏「丝路报告」**：在右侧边栏的新标签页里打开，或点会话标题栏的报告图标。列出 `~/SilkRoad/reports/` 里的报告，可以直接预览 Markdown 和 CSV。
- **对话里的工具结果**：SilkRoad 的工具（订单、商品、退货、知识库、搜索等）显示成一行摘要，点开是表格，再点可以看原始数据。
- 会话进行中如果 FastMoss 没登录、也没填 Kalodata Key，输入框上方会提醒一次，可以关掉。

## Skills 与角色

| 阶段 | Skill |
|---|---|
| 上新与内容 | `tiktok-product-research` 选品调研、`tiktok-market-opportunity` 市场机会、`tiktok-listing-seo` 标题描述、`tiktok-pricing-strategy` 定价、`tiktok-product-images` 主图详情图、`tiktok-video-script` 短视频脚本、`tiktok-viral-video-breakdown` 爆款视频拆解、`tiktok-launch-team` 新品上新团队 |
| 客服与售后 | `tiktok-buyer-reply` 买家消息多语言回复草稿、`tiktok-review-insights` 评论和差评洞察 |
| 运营与数据 | `tiktok-shop-diagnosis` 店铺诊断、`tiktok-product-diagnosis` 单品诊断、`tiktok-competitor-shop` 竞品店铺、`tiktok-gmv-max-diagnosis` GMV Max 诊断、`tiktok-weekly-report` 每周自动报表 |
| 数据源 | `silkroad-setup` 检查和连接数据源、`kalodata-data` Kalodata 工具、费用和口径（以及 FastMoss 步骤的对应做法） |
| 达人与营销 | `tiktok-creator-discovery` 达人发现、`tiktok-creator-diagnosis` 达人诊断、`tiktok-creator-outreach` 建联邮件草稿、`tiktok-sample-brief` 寄样简报 |

角色：**丝路 · 运营总监**（统筹「TikTok 新品上新」团队）、**选品专家**、**Listing 优化师**、**定价策略师**。点场景会自动选好角色；也可以在面板的「角色团队」里直接用某个角色新建会话，或在输入框上方的模式菜单里切换。

SilkRoad 只读数据、只出草稿：不替你发消息或邮件、不改价、不处理退款、不调整广告预算。花钱的操作（生成图片）先给方案，等你确认。

## 验证状态

| 部分 | 状态 |
|---|---|
| 内置进丝路 Desktop 安装包、面板、路由、角色预设注册 | 已验证（单元测试 + `scripts/smoke.sh` + 丝路 Desktop 实机） |
| 首屏场景按钮（填入提示词并切换角色）、面板五个标签、右侧边栏报告、报告预览 | 已验证（隔离的 Harness rc.5 Web 实例里实际点击） |
| 工具结果表格 | 单元测试已覆盖；还没在真实对话里看过（需要模型和数据源） |
| 本地知识库、TikTok Shop 签名算法 | 已验证（单元测试） |
| FastMoss 动态注册客户端和授权跳转 | 已验证（匿名，不登录） |
| FastMoss 登录后列工具、对话查询 | **未验证**，需要真实账号 |
| TikTok Shop 店铺授权和读取订单、商品、消息、退货 | **未验证**，需要自己的 Partner Center 应用 |
| SerpApi、AnySearch（带 key）、图片生成 | **未验证**，需要自己的 key |
| Kalodata | 按 [Kalodata 公开 API 文档](https://www.kalodata.com/open-center/docs) 实现了全部 20 个接口，请求格式有单元测试；**还没用真实 Key 调用过**。Kalodata 官方的 [kalodata-skill](https://github.com/sailtonight/kalodata-skill) 没有声明许可证，所以丝路没有复制它的代码或技能文字，只参考了 Kalodata 开放中心页面公开的能力列表 |
| 角色团队协作、每周定时报表 | **未验证**，需要在 Desktop 里配置模型后实际跑一次 |

## 安装

本插件内置在丝路 SilkRoad 里（`packages/bundle/web-app` 的 `silkroad` 一行），装好丝路就有，不需要单独安装。仓库根目录的 `pnpm run build:artifacts` 会一并构建它。

## 开发

- 在本目录运行 `pnpm check`：类型检查、单元测试、构建。
- `npx tsx scripts/probe-fastmoss.ts`：对真实的 FastMoss 做一次不需要账号的 OAuth 检查（动态注册客户端、PKCE、打开授权页），不会弹出浏览器。
- `scripts/smoke.sh`：把插件打包后装进一个**隔离的** npm 版 DSH（只用于单独验证插件），安装打包产物、启动同版本 Harness，并调用真实路由。不会碰你自己的 DSH 配置，也不会读写你的 `~/SilkRoad`（用 `SILKROAD_HOME` 指到临时目录）。加 `SILKROAD_SMOKE_KEEP=1` 会保持服务运行，方便在浏览器里看界面。

架构说明见 [docs/architecture.md](docs/architecture.md)，净室规则见 [docs/cleanroom.md](docs/cleanroom.md)。

## 许可证

[MIT](LICENSE)。各数据源的账号、费用和使用条款由数据源自己规定。
