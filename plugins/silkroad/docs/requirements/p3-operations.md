# P3 运营与数据：功能需求

净室说明同 P2：只写场景、行为、数据和人工确认点。

## 可用的数据和工具

| 来源 | 工具 | 说明 |
|---|---|---|
| 用户自己的 TikTok Shop | `silkroad_tts_orders`、`silkroad_tts_products`、`silkroad_tts_returns`、`silkroad_tts_api` | 自己店铺的订单、商品、退货（只读）。订单可按时间窗口分页汇总出 GMV、单量、客单价、退款率 |
| FastMoss 店铺 | `shop_search`、`shop_base_info`、`shop_data_trends`、`shop_sale_analysis`、`shop_product_analysis`、`shop_creator_analysis`、`shop_video_analysis`、`shop_live_analysis`、`shop_investment_analysis`、`shop_rank_top_selling` | 任意店铺（自己的或竞品）的市场侧数据：GMV 趋势、渠道结构、商品结构、达人、视频、直播、广告投入 |
| FastMoss 商品与广告 | `product_overview`、`product_sales_trend`、`product_investment`、`ad_search`、`ad_data_overview` | 商品渠道归因、广告与自然流量、广告素材和投放效果 |
| FastMoss 市场 | `market_category_analysis`、`market_category_ranking` | 类目大盘，用于判断是自己的问题还是大盘的问题 |
| 用户导出 | 文件 | Seller Center / TikTok Ads Manager 导出的 GMV Max 报表（CSV），放在 `~/SilkRoad/reports/input/` 或直接给路径 |
| DSH | `schedule_create`、`schedule_list`、`schedule_update`、`schedule_delete` | 定时任务：在当前会话里按周触发 |

说明：GMV Max 是 TikTok 的全托管广告，自己账户的投放明细在 TikTok Ads Manager / Seller Center 里。P3 先用**用户导出的报表**加 FastMoss 的市场侧广告数据；以后如果接 TikTok API for Business（需要用户自己的开发者应用和授权），再改成自动拉取。

---

## S9 店铺经营诊断 `tiktok-shop-diagnosis`

**场景**：卖家想知道店铺最近经营得怎么样、哪里出了问题、下周该做什么。

**输入**
- 必需：店铺（已授权的自己店铺，或 FastMoss 里的店铺 ID/名称）、时间范围（默认最近 28 天，对比前 28 天）。
- 可选：关注点（销量下滑、利润、退款、某个商品）。

**行为**
1. 核心指标及环比：GMV、订单数、件数、客单价、动销商品数、退款/退货率；有自己店铺授权时用订单数据算，同时可用 FastMoss `shop_data_trends` 对照。
2. 结构拆解：
   - 渠道：短视频、直播、商品卡、达人带货各占多少，哪个渠道在变（`shop_sale_analysis`）。
   - 商品：头部商品集中度，增长和下滑最大的商品（订单或 `shop_product_analysis`）。
   - 达人：合作达人数量和产出变化（`shop_creator_analysis`）。
   - 广告：投入和 ROAS 变化（`shop_investment_analysis`）。
3. 判断原因：把店铺变化和类目大盘（`market_category_analysis`）对比，区分大盘因素和自身因素；退款上升时用 `silkroad_tts_returns` 看原因。
4. 结论按影响排序，每条带证据和建议动作。

**输出**
- 一句话结论 + 核心指标表（本期、上期、变化）。
- 问题清单（按影响排序）：现象、证据、可能原因、建议动作、负责角色（选品/Listing/定价/投放/达人）。
- 下周 3 到 5 个优先动作。

**人工确认**
- 涉及改价、下架、加大投放预算的建议由用户决定。
- 数据缺口（比如没有授权店铺、只有 FastMoss 估算）在报告开头写明。

---

## S10 竞品店铺分析 `tiktok-competitor-shop`

**场景**：卖家想拆解一个做得好的同类店铺：它卖什么、怎么卖、靠什么起量，我能学什么、能在哪里超过它。

**输入**
- 必需：竞品店铺（名称、链接或 seller_id；只给类目时先用 `shop_rank_top_selling` / `shop_search` 找候选并让用户选）。
- 可选：自己的店铺（用于对比）、时间范围。

**行为**
1. 基本盘：店铺规模、GMV 趋势、成长阶段（`shop_base_info`、`shop_data_trends`）。
2. 商品策略：类目和价格带结构、爆品及其生命周期、上新节奏（`shop_product_analysis`、`product_overview`）。
3. 流量策略：渠道结构（`shop_sale_analysis`）、达人矩阵和层级（`shop_creator_analysis`）、视频和直播打法（`shop_video_analysis`、`shop_live_analysis`、`video_script_info` 看爆款视频话术）、广告投入（`shop_investment_analysis`、`ad_search`）。
4. 和自己店铺对比（有的话）：同样指标并排。
5. 总结它的成功要素、弱点（可以从它爆品的差评切入，交给 `tiktok-review-insights`），以及可借鉴和可超越的点。

**输出**
- 竞品画像一页：规模、阶段、核心商品、价格带、主要渠道、达人结构、内容打法、广告力度。
- 成功要素和弱点。
- 对自己的建议：学什么、避开什么、差异化方向，每条附证据。

**人工确认**
- 只用于分析学习；不建议抄袭对方的图片、视频或文案。

---

## S11 GMV Max 投放诊断 `tiktok-gmv-max-diagnosis`

**场景**：卖家在跑 GMV Max，想知道钱花得值不值、哪些商品该加预算或停掉、ROI 目标设得合不合理。

**输入**
- 必需：GMV Max 报表（用户从 Seller Center / Ads Manager 导出的 CSV，按天或按商品；字段因导出版本不同而不同，读文件后先识别列）。
- 可选：目标 ROI、毛利率（没有时请定价策略相关数据或问用户）、诊断时间范围、关注的商品。

**行为**
1. 读报表，识别字段（花费、GMV、订单、ROI、展示、点击、转化等），说明识别结果和缺失字段。
2. 整体：花费、广告 GMV、ROI 趋势；ROI 和盈亏平衡 ROI（= 1 / 毛利率）对比。
3. 按商品：哪些商品 ROI 高且有量（可加预算）、哪些花钱多 ROI 低（降目标或暂停）、哪些量太小（素材不足）。
4. 素材和外部参照：用 FastMoss `product_investment`、`ad_search`、`ad_data_overview` 看同类商品的投放强度和高效素材，作为素材方向参考。
5. 建议：每个商品的动作（加预算 / 维持 / 调 ROI 目标 / 补素材 / 暂停），并说明理由和预期影响。

**输出**
- 整体投放表现和是否盈利的结论。
- 商品分层表：商品、花费、GMV、ROI、盈亏平衡 ROI、建议动作、理由。
- 素材建议：缺什么素材、可参考的同类高效素材。

**人工确认**
- 所有预算和 ROI 目标调整由用户在 Ads Manager 里自己操作。
- 报表字段识别不确定时先请用户确认。

---

## S12 每周自动报表 `tiktok-weekly-report`

**场景**：卖家希望每周一早上自动收到一份上周经营报告，不用每次手动问。

**输入**
- 设置时：店铺、时区（默认 Asia/Shanghai）、时间（默认周一 09:00）、报告内容（默认：经营诊断摘要 + 竞品动态 + 待处理客服/退货）、关注的竞品店铺（可选）。

**行为**
- 设置：用 `schedule_create` 的 `weekly` 选项创建一个任务，prompt 里写清楚「按 tiktok-weekly-report skill 生成上周报告」以及店铺、竞品、保存位置；建好后用 `schedule_list` 确认并告诉用户下次运行时间。修改或取消用 `schedule_update` / `schedule_delete`。
- 每次触发：
  1. 先 `silkroad_status`，数据源掉线时在报告开头写明，并提示用户在面板重新登录。
  2. 上周（周一到周日，按设定时区）对比前一周：按 S9 的核心指标和结构拆解，压缩成摘要。
  3. 关注的竞品：GMV 变化、新爆品、新的广告或达人动作（S10 的精简版）。
  4. 待处理：未回复的买家会话数、待处理退货（有店铺授权时）。
  5. 本周建议的 3 个动作。
  6. 保存为 `~/SilkRoad/reports/weekly-<周一日期>.md`，并在会话里给出摘要和文件路径。

**输出**
- 一份 Markdown 周报文件 + 会话内摘要。

**人工确认**
- 创建定时任务前，先向用户确认时间、时区和内容。
- 报告只读数据，不执行任何操作。
- 说明限制：DeepSeek Harness 需要在运行（Desktop 打开）时才能按时生成；错过的会在下次启动时补一次。
