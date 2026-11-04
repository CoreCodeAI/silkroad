# SilkRoad 丝路

English | [中文](README.zh.md)

An open-source cross-border e-commerce AI agent that runs on [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It starts with TikTok Shop and will extend to Amazon and independent stores later.

**You authorize all data yourself**: sign in with your own account in the browser (OAuth), or enter your own API keys. SilkRoad ships no shared credentials and uses no relay server.

## What it does

| Capability | Data source | Authorization |
|---|---|---|
| TikTok Shop market data (products, shops, creators, videos, livestreams, ads) | The official FastMoss MCP | Sign in to your FastMoss account in the browser |
| TikTok Shop rankings and details for products, shops, creators, videos, livestreams and categories, plus product selling points, review insight and original reviews | Kalodata Open API | Enter your own Kalodata key (generate it under 账户管理 in the Kalodata Open Center; billed in credits) |
| Google search / Trends / Shopping, Amazon and YouTube results | SerpApi | Enter an API key |
| General web search | AnySearch | Anonymous, or with a key |
| Product image generation | Any OpenAI Images-compatible service | Enter the base URL, model and key |
| Your own shop's orders, products, buyer messages and returns (read-only) | TikTok Shop Open Platform | Your own Partner Center app, then authorize the shop in the browser |
| Product facts and after-sales policies | Local folder `~/SilkRoad/knowledge` | None |

Keys are stored only in SilkRoad's credentials on your machine; they are never displayed and never enter the conversation.

## Interface

**Branding**: the SilkRoad distribution itself provides the 丝路 SilkRoad name, mark, new-session tagline and installers (see the repository README); the plugin provides only the SilkRoad mark in its panel. The tagline is 「开辟你的跨境商路」 and 「选品、上新、运营、客服、达人营销，一路同行」, following the language setting: Chinese by default, "SilkRoad / Open your own Silk Road" in English.

- **New-session screen**: below the SilkRoad mark and tagline are five categories (选品上新 sourcing and listing, 内容素材 content, 店铺运营 shop operations, 客服售后 customer service, 达人营销 creator marketing) and the scenario buttons of the selected category. One click selects the role and fills the prompt into the input; replace the 【】 fields with your details and send. Hovering a button shows what the scenario does and which data sources it still needs. 「全部场景」 opens the full list in the panel. The row above the input holds the workspace and mode, with the data-source status (such as 「数据源 1/3」) on the right; click it to connect.
- **跨境电商 panel in the left sidebar**: scenarios (searchable), the role team (start a session with a role in one click), data sources (sign in, enter keys, authorize shops), knowledge base, and reports (scheduled reports and report previews).
- **丝路报告 in the right sidebar**: open it in a new right-sidebar tab, or click the report icon in the session title bar. It lists the reports in `~/SilkRoad/reports/` and previews Markdown and CSV.
- **Tool results in the conversation**: SilkRoad's tools (orders, products, returns, knowledge base, search and so on) show a one-line summary that expands to a table, with the raw data one click further.
- During a session, if FastMoss is not signed in and no Kalodata key is saved, a reminder appears once above the input; it can be dismissed.

## Skills and roles

| Stage | Skills |
|---|---|
| Listing and content | `tiktok-product-research` product research, `tiktok-market-opportunity` market opportunity, `tiktok-listing-seo` titles and descriptions, `tiktok-pricing-strategy` pricing, `tiktok-product-images` product images, `tiktok-video-script` short-video scripts, `tiktok-viral-video-breakdown` viral-video breakdown, `tiktok-launch-team` product launch team |
| Customer service | `tiktok-buyer-reply` multilingual buyer-reply drafts, `tiktok-review-insights` review and complaint insight |
| Operations and data | `tiktok-shop-diagnosis` shop diagnosis, `tiktok-product-diagnosis` single-product diagnosis, `tiktok-competitor-shop` competitor shops, `tiktok-gmv-max-diagnosis` GMV Max diagnosis, `tiktok-weekly-report` weekly reports |
| Data sources | `silkroad-setup` check and connect data sources, `kalodata-data` Kalodata tools, costs and definitions (and the Kalodata equivalent of each FastMoss step) |
| Creator marketing | `tiktok-creator-discovery` creator discovery, `tiktok-creator-diagnosis` creator diagnosis, `tiktok-creator-outreach` outreach email drafts, `tiktok-sample-brief` sample briefs |

Roles: **丝路 · 运营总监** (operations director, coordinating the TikTok product launch team), **选品专家** (product researcher), **Listing 优化师** (listing optimizer) and **定价策略师** (pricing strategist). A scenario selects its role automatically; you can also start a session with a role from 「角色团队」 in the panel, or switch in the mode menu above the input.

SilkRoad only reads data and drafts results: it does not send messages or emails, change prices, issue refunds or adjust ad budgets for you. Actions that cost money (image generation) show a plan first and wait for your confirmation.

## Verification status

| Part | Status |
|---|---|
| Built into the SilkRoad Desktop installer, panel, routes, role preset registration | Verified (unit tests + `scripts/smoke.sh` + SilkRoad Desktop on a real machine) |
| New-session scenario buttons (fill the prompt and switch the role), the panel's five tabs, the right-sidebar reports and report preview | Verified (clicked through in an isolated Harness rc.5 Web instance) |
| Tool result tables | Covered by unit tests; not yet seen in a real conversation (needs a model and data sources) |
| Local knowledge base, TikTok Shop request signing | Verified (unit tests) |
| FastMoss dynamic client registration and authorization redirect | Verified (anonymous, without signing in) |
| FastMoss tool listing and queries after sign-in | **Not verified**; needs a real account |
| TikTok Shop authorization and reading orders, products, messages and returns | **Not verified**; needs your own Partner Center app |
| SerpApi, AnySearch (with a key), image generation | **Not verified**; needs your own keys |
| Kalodata | All 20 endpoints implemented from the [public Kalodata API docs](https://www.kalodata.com/open-center/docs), with unit tests for the request format; **not yet called with a real key**. Kalodata's official [kalodata-skill](https://github.com/sailtonight/kalodata-skill) declares no license, so SilkRoad copies none of its code or skill text and only follows the capability list on Kalodata's public Open Center pages |
| Role team collaboration, weekly scheduled reports | **Not verified**; needs one real run in Desktop with a configured model |

## Installation

The plugin is built in to 丝路 SilkRoad (the `silkroad` row in `packages/bundle/web-app`), so installing SilkRoad installs it; there is nothing separate to install. `pnpm run build:artifacts` at the repository root builds it as well.

## Development

- Run `pnpm check` in this directory: typecheck, unit tests and build.
- `npx tsx scripts/probe-fastmoss.ts`: an account-free OAuth check against the real FastMoss (dynamic client registration, PKCE, opening the authorization page) that does not open a browser.
- `scripts/smoke.sh`: packs the plugin and installs it into an **isolated** npm DSH (only for verifying the plugin on its own), installs the packed artifact, starts the same Harness version and calls the real routes. It does not touch your own DSH configuration or read or write your `~/SilkRoad` (`SILKROAD_HOME` points to a temporary directory). Set `SILKROAD_SMOKE_KEEP=1` to keep the server running so you can look at the interface in a browser.

The architecture is described in [docs/architecture.md](docs/architecture.md) and the clean-room rules in [docs/cleanroom.md](docs/cleanroom.md) (both in Chinese).

## License

[MIT](LICENSE). Each data source's accounts, fees and terms are set by that data source.
