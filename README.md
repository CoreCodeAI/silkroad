# 丝路 SilkRoad

English | [中文](README.zh.md)

丝路 SilkRoad is an open-source desktop AI agent for cross-border e-commerce, starting with TikTok Shop and extending to Amazon and independent stores later. It is built on [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (MIT) as a fork, and is not an official DeepSeek product.

**You authorize all data yourself**: sign in to data platforms with your own account in the browser, or enter your own API keys. SilkRoad ships no shared credentials, uses no relay server, and reports no usage data.

## Beta

SilkRoad is in beta; features, skills and data-source connections will keep changing. SilkRoad only reads data and drafts results: it does not send messages or emails, change prices, issue refunds or adjust ad budgets for you.

Read the [safety notes](SAFETY.md) before running it.

<a id="features"></a>

## What it does

- **New-session screen**: five scenario groups (sourcing and listing, content, shop operations, customer service, creator marketing). One click selects the role and fills in the prompt.
- **跨境电商 sidebar panel**: scenarios, role team, data sources, knowledge base and reports.
- **Data sources**: the official FastMoss MCP (browser sign-in), the Kalodata Open API (your own key, billed in Kalodata credits), the TikTok Shop Open Platform (read-only, for your own shops), SerpApi, AnySearch, OpenAI Images-compatible image generation, and the local knowledge folder `~/SilkRoad/knowledge`.
- **Skills**: product research, market opportunity, listings, pricing, product images, short-video scripts, viral-video breakdowns, buyer replies, review insights, shop diagnosis, single-product diagnosis, competitor shops, GMV Max diagnosis, weekly reports, creator discovery, creator diagnosis, outreach emails and sample briefs.
- **Reports**: skills save reports under `~/SilkRoad/reports/`, previewable in the right sidebar.

The plugin source and its details are in [plugins/silkroad](plugins/silkroad/README.md).

<a id="run"></a>

## Run

### Run the Web version from source

Requires Node.js 24 and pnpm 11.28.5 (`corepack enable`).

```sh
pnpm install
pnpm run build:artifacts
pnpm run start:web
```

Open the printed address in a browser. User data lives in `~/.silkroad` by default; set `DSH_HOME` to use another directory.

### Package the macOS desktop app

Requires the Xcode command line tools.

```sh
pnpm run package:desktop:mac:arm64:unsigned
```

The result is an unsigned, unnotarized DMG; allow it under System Settings → Privacy & Security on first launch. There is no auto-update yet; install new versions manually.

<a id="differences"></a>

## Differences from DeepSeek Harness

- The product name, mark, new-session screen and installers are SilkRoad's. The app id is `com.corecode.silkroad`, the data directory is `~/.silkroad` and the terminal command is `silkroad`, so SilkRoad installs side by side with the official DeepSeek Harness.
- DeepSeek account sign-in, usage analytics and the official auto-update feed are removed; models use your own API keys, and DeepSeek remains one of the available models.
- The cross-border e-commerce plugin `plugins/silkroad` is built in.
- Internal package names (`@deepseek-ai/dsh-*`) are unchanged so upstream updates can be merged.

<a id="license"></a>

## License

[MIT](LICENSE). The original DeepSeek Harness copyright notice is retained; see [NOTICE](NOTICE.md) for the fork's origin and trademark notes. Each data source's accounts, fees and terms are set by that data source.
