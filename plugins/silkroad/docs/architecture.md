# 架构

SilkRoad 是一个 DeepSeek Harness 组合包（bundle），只插入自己的插件行，不修改 Harness 本身。

```text
dsh-silkroad
├── 宿主插件 (src/index.ts)
│   ├── Hub：所有数据源的状态与操作
│   ├── OAuth MCP 连接器 (src/connectors)：登录、刷新 token、挂载 DSH 原生 MCP 客户端
│   ├── API key 供应商工具 (src/vendors)：SerpApi、AnySearch、图片生成
│   ├── TikTok Shop 开放平台 (src/tiktok-shop)：用户自己的应用和店铺授权，只读工具 silkroad_tts_*
│   ├── 本地知识库 (src/knowledge.ts)：~/SilkRoad/knowledge，silkroad_knowledge 列出和搜索
│   ├── 角色预设 (src/presets.ts)：运营总监 + 三位专家，注册到 DSH 预设注册表
│   ├── 设置工具：silkroad_status、silkroad_connect
│   └── 内置 skills (skills/*/SKILL.md)
└── 客户端插件 (src/client)
    ├── 左侧栏「跨境电商」面板：场景 · 角色团队 · 数据源 · 知识库 · 报表
    ├── 输入框停靠条 (conversation.input.dock)：新会话显示分类和场景按钮
    ├── 首屏选项 (conversation.hero.options)：工作区一行右侧的数据源状态
    ├── 右侧边栏「丝路报告」标签 (sidebarRightTabs) 和会话标题栏按钮
    └── 工具结果行 (tool.call.toolview)：silkroad_* 工具的摘要和表格
```

## OAuth 数据源

DSH 0.2.1 的 MCP 客户端没有 OAuth 流程。SilkRoad 用 MCP 官方 SDK 的 `auth()`：

1. 动态注册客户端（公开客户端，无密钥）、PKCE S256、`state` 防伪造。
2. 回调地址是 DSH Web 服务器上的 `http://127.0.0.1:<port>/silkroad/oauth/callback/<id>`。端口每次启动都可能不同，换端口时会自动重新注册。
3. 授权记录（客户端注册信息、token、PKCE verifier）存成一条 DSH 凭据 grant 记录。
4. 拿到 token 后，以子插件方式挂载 `@deepseek-ai/dsh-mcp-client`，带 `Authorization: Bearer` 请求头。工具名为 `mcp__<server>__<tool>`。
5. 到期前自动刷新；刷新失败时状态变为「登录已过期」，等用户重新登录，不会自己弹出浏览器。

## TikTok Shop 开放平台

用户在 Partner Center 创建自己的应用，在面板填写 App Key、Service ID、授权地区，App Secret 存进 DSH 凭据。

1. 「授权店铺」打开 `services[.us].tiktokshop.com/open/authorize?service_id=…&state=…`。
2. TikTok 跳回应用配置的回调地址（在 Partner Center 里固定）。用户把跳转后的完整地址粘贴回面板；如果应用的回调地址设成了 SilkRoad 的本机回调，会自动完成。两种方式都校验 `state`。
3. 用授权码在 `auth.tiktok-shops.com/api/v2/token/get` 换 token，读取已授权店铺（含 `shop_cipher`），存成一条 grant 记录。
4. 每次请求用 HMAC-SHA256 签名（`secret + path + 排序后的参数 + body + secret`），access token 放在 `x-tts-access-token` 头；快过期时用 refresh token 续期。
5. 工具全部只读：订单、商品、买家会话、退货退款，外加一个只允许 GET 和 `/search` 的通用读取工具。SilkRoad 不发消息、不改价、不处理退款。

## 角色预设与团队

`src/presets.ts` 在 DSH 预设注册表里注册四个预设，插件行与 rc.5 的 `standard` 预设一致，只换了人设（`@deepseek-ai/dsh-persona`），行 id 加了前缀，避免和 `standard` 冲突。运营总监的 `subagent` 工具设置了 `allowedAgentPresets`，只能把任务交给三位专家预设，这就是「TikTok 新品上新」团队，不依赖实验性的智能体团队包。开启 Desktop 的「智能体团队」插件后，`tiktok-launch-team` skill 也会使用 `spawn_teammate` 等团队工具。

## 定时报表

使用 DSH 自带的 `schedule_create`（weekly 选项、IANA 时区）。提醒会作为后续消息投递到创建它的会话，由 `tiktok-weekly-report` skill 生成报告并保存到 `~/SilkRoad/reports/`。Harness 需要在运行中；错过的一次会在下次启动时补发。

## HTTP 路由

- 面板管理接口挂在 DSH 已认证的 `/api` 通道上（`ctx.connection.fetch.register`），只有本机所有者能访问。Desktop 与 Web 都适用。
- OAuth 回调来自用户的系统浏览器，没有 DSH Cookie，所以是 Web 服务器上的公开路由，靠 `state` 绑定到发起的那次登录。

## 界面挂载点

都是 DSH 0.2.1-rc.5 客户端公开的扩展位，在 Desktop 和 Web 里一样：

| 挂载点 | 用途 |
|---|---|
| `sidebar.panellist` + `main` | 左侧栏入口和主面板 |
| `conversation.input.dock` | 输入框上方。会话是空白的（首屏）时显示分类和场景按钮；会话进行中只在 FastMoss 未登录时提醒 |
| `conversation.hero.options` | 首屏工作区一行的右侧：「数据源 n/m」，点击打开面板的数据源标签 |
| 首屏排版 CSS | 只在丝路场景存在时生效：把 DSH 的工作区一行挪到场景下面、输入框正上方（flex `order`），DSH 改了类名也只是退回默认顺序 |
| `uiWorkspace.startSession(…, { agentPreset, prompt, whenDraftExists: 'replace' })` | 场景按钮和卡片：复用空白会话、切换角色、填入提示词 |
| `sidebarRightTabs.register` + `sidebar.right.pane.tab(.title)` | 右侧边栏报告标签，带新标签页里的入口 |
| `conversation.session.header.utilities` | 会话标题栏的报告按钮 |
| `tool.call.toolview`（按工具名） | SilkRoad 工具调用的显示 |
| `remote.schedule.catalog()` | 面板「报表」里列出定时报表 |
| `sidebar.brand.mark` / `sidebar.brand.name`（priority -10） | 左上角换成丝路的标志和名称，压过官方品牌 |
| `conversation.hero.brand.mark`（priority -10） | 首屏标志、标语。DSH 没有给标题文字留扩展位，所以在标志下面画自己的标题，再用只在丝路标志存在时才生效的 CSS 隐藏 DSH 的标题 |
| `document.title` | DSH 把 "DeepSeek Harness" 写死在标题里，`MutationObserver` 把它换成丝路的名称 |

需要 `uiWorkspace`、`sidebarRight`、`remote.schedule` 的部分各自放在子插件里，某个服务缺失只会让对应的界面不出现，不影响其他部分。场景目录在 `src/client/scenarios.ts`，每个场景对应一个 skill 和一个角色预设。

报告是 skill 用 Write 工具保存到 `~/SilkRoad/reports/` 的 Markdown 或 CSV。服务端只读这个目录（`src/reports.ts`），拒绝绝对路径、`..` 和其他扩展名。`SILKROAD_HOME` 可以把 `~/SilkRoad` 换到别的目录（测试和冒烟测试用）。

## 版本

锁定官方 Desktop 0.2.1-rc.5 内置的 Harness 包版本（`peerDependencies`）。升级 Harness 时先跑 `scripts/smoke.sh`。
