# 丝路 SilkRoad

[English](README.md) | 中文

丝路 SilkRoad 是开源的跨境电商 AI 智能体桌面应用，先做 TikTok Shop，之后扩展到亚马逊和独立站。它基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（MIT）构建，是其分支版本，并非 DeepSeek 官方产品。

**数据都由你自己授权**：用自己的账号在浏览器里登录数据平台，或者填写自己的 API Key。丝路不内置任何共享权限，不经过中转服务器，也不上报使用数据。

## 测试版

丝路处于测试阶段，功能、技能和数据源对接还会持续调整。丝路只读数据、只出草稿：不替你发消息或邮件、不改价、不处理退款、不调整广告预算。

运行前请阅读[安全说明](SAFETY.zh.md)。

<a id="features"></a>

## 能做什么

- **新会话首屏**：选品上新、内容素材、店铺运营、客服售后、达人营销五类场景，点一下就选好角色并填好提示词。
- **左侧栏「跨境电商」面板**：场景、角色团队、数据源、知识库、报表。
- **数据源**：FastMoss 官方 MCP（浏览器登录）、Kalodata Open API（自己的 Key，按 Kalodata 积分计费）、TikTok Shop 开放平台（只读，授权自己的店铺）、SerpApi、AnySearch、OpenAI Images 兼容的图片生成，以及本地知识库文件夹 `~/SilkRoad/knowledge`。
- **技能**：选品调研、市场机会、Listing、定价、主图详情图、短视频脚本、爆款视频拆解、买家消息回复、评论洞察、店铺诊断、单品诊断、竞品店铺、GMV Max 诊断、每周报表、达人发现、达人诊断、建联邮件、寄样简报。
- **报告**：技能生成的报告保存在 `~/SilkRoad/reports/`，可在右侧边栏预览。

插件源码和详细说明在 [plugins/silkroad](plugins/silkroad/README.zh.md)。

<a id="run"></a>

## 运行

### 从源码运行 Web 版

需要 Node.js 24 和 pnpm 11.28.5（`corepack enable`）。

```sh
pnpm install
pnpm run build:artifacts
pnpm run start:web
```

浏览器打开命令输出的地址。用户数据默认保存在 `~/.silkroad`，可用 `DSH_HOME` 指定其他目录。

### 打包 macOS 桌面版

需要 Xcode 命令行工具。

```sh
pnpm run package:desktop:mac:arm64:unsigned
```

产物是未签名、未公证的 DMG，首次打开时需要在「系统设置 → 隐私与安全性」里允许。目前没有自动更新，新版本需要重新安装。

<a id="differences"></a>

## 与 DeepSeek Harness 的区别

- 产品名称、标志、首屏和安装包换成丝路 SilkRoad；应用 ID 为 `com.corecode.silkroad`，数据目录为 `~/.silkroad`，终端命令为 `silkroad`，可以和官方 DeepSeek Harness 同时安装。
- 去掉了 DeepSeek 账号登录、使用数据上报和官方自动更新；模型通过你自己的 API Key 使用，DeepSeek 仍是可选的模型之一。
- 内置跨境电商插件 `plugins/silkroad`。
- 内部包名（`@deepseek-ai/dsh-*`）保持不变，方便合并上游更新。

<a id="license"></a>

## 许可证

[MIT](LICENSE)。本项目保留 DeepSeek Harness 的原始版权声明，分支来源和商标说明见 [NOTICE](NOTICE.md)。各数据源的账号、费用和使用条款由数据源自己规定。
