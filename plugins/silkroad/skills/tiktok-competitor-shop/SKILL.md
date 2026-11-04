---
name: tiktok-competitor-shop
description: Profiles a competing TikTok Shop store (scale, growth stage, products and price bands, traffic channels, creators, video and live tactics, ads), compares it with the user's own store when available, and turns it into what to learn, what to avoid and where to differentiate, with evidence for each point.
---

# 竞品店铺分析（TikTok Shop）

> **TikTok 数据来源**：下文写的是 FastMoss 工具。`silkroad_status` 显示 FastMoss 没连上、Kalodata 为 `configured` 时，改用 Kalodata：按 `kalodata-data` 技能第 5 节的对照把每一步换成 `silkroad_kalodata_*` 工具，费用控制和口径照那个技能；Kalodata 没有对应的数据写"没有数据（Kalodata 不提供）"。两个都连上时默认用 FastMoss，用户指定时听用户的；两个都没有时才按本技能的降级方式处理。

目标：拆解一个做得好的同类店铺，弄清它卖什么、怎么卖、靠什么起量，哪些可以学，哪些地方能超过它。结论放最前，竞品画像紧随其后。

## 0. 先确认输入

- 竞品店铺：名称、链接或 seller_id。
- 如果用户只给了类目，先用 `mcp__fastmoss__shop_rank_top_selling` 或 `mcp__fastmoss__shop_search` 找 3 到 5 个候选，列出名称、规模和类目，让用户选定，再开始分析。
- 站点。用户没说就问。
- 自己的店铺（可选）：用于并排对比。有授权时可用 `silkroad_tts_shops` 确认店铺 ID。
- 时间范围：默认最近 28 天。

## 1. 检查数据源

1. 调用 `silkroad_status`。
2. FastMoss 未连接：告诉用户在左侧栏「跨境电商」面板的「数据源」连接 FastMoss。本 skill 几乎全部依赖它，没有连接时只能停在这里，或请用户自己提供公开信息。
3. 自己店铺未授权：跳过第 4 节的对比，报告里写明未对比的原因。

## 2. 基本盘

1. `mcp__fastmoss__shop_base_info`（需要 seller_id）：店铺规模和基本信息。
2. `mcp__fastmoss__shop_data_trends`：近 28 天（或用户指定的范围）每日 GMV、件数、达人、直播趋势。
3. 判断成长阶段：快速上升、稳定、下滑、起量初期，并写明判断依据（趋势斜率或同比变化）。
4. 规模只用 FastMoss 的估算值，标注"估算"。不要把估算的 GMV 当成对方的实际营收。
5. 如果竞品的数据只覆盖部分时间，先说明覆盖范围，再做趋势判断。

## 3. 打法拆解

### 3.1 商品策略

- `mcp__fastmoss__shop_product_analysis`：类目构成、价格带、商品清单。
- `mcp__fastmoss__product_overview`：对爆品看渠道归因、生命周期、广告和自然流量的比例。
- 找出爆品（销量或 GMV 前 3 到 5 个），记录它们的上架时间和销量曲线，看上新节奏。
- 价格带按 GMV 占比排列，而不是按商品数量排列，避免被低价长尾商品误导。
- 爆品的生命周期分为起量、峰值、衰退三段。写出每个爆品目前处在哪一段，依据是销量曲线。

### 3.2 流量策略

- `mcp__fastmoss__shop_sale_analysis`：视频、直播、商品卡、达人各占多少。
- `mcp__fastmoss__shop_creator_analysis`：合作达人数量、层级结构、头部达人占比。
- `mcp__fastmoss__shop_video_analysis`：带货视频和广告状态。选出播放和销量最高的几条。
- `mcp__fastmoss__shop_live_analysis`：直播场次、单场表现和节奏。
- `mcp__fastmoss__video_script_info`：只对上面选出的爆款视频取口播和字幕，归纳它的钩子、结构和卖点表达方式。不要整段照搬。

### 3.3 广告投入

- `mcp__fastmoss__shop_investment_analysis`：店铺广告投入和 ROAS。
- `mcp__fastmoss__ad_search`：它的在投广告素材，看数量、形式和主推商品。

## 4. 与自己店铺并排对比（有授权时）

用同样的指标并排：GMV、订单数、客单价、动销商品数、渠道占比、达人数量、广告投入和 ROAS。自己店铺的数字来自 `silkroad_tts_orders`（注明时间范围），竞品来自 FastMoss（注明是估算）。两边口径不同时，在表下写明。

## 5. 成功要素与弱点

- 成功要素：从第 2 到 3 节的数据里归纳 3 条，每条写明证据。
- 弱点：可以从它爆品的差评切入。对前 3 个爆品调用 `mcp__fastmoss__product_review_list`，找出反复出现的抱怨。如果已安装 `tiktok-review-insights` skill，交给它做深入分析。
- 弱点结论标注"推断"，除非是差评里的原话。

## 6. 输出模板

```
## 结论
一句话：这家店靠 ... 起量，最值得学的是 ...，最有机会超过它的地方是 ...

## 1. 竞品画像
| 维度 | 内容 | 来源 / 时间范围 |
|---|---|---|
| 规模（GMV、订单估算） | | FastMoss / ... |
| 成长阶段 | | 推断，依据 ... |
| 核心商品（前 3） | | |
| 价格带 | | |
| 主要渠道占比 | | |
| 达人结构 | | |
| 内容打法 | | |
| 广告力度 | | |

## 2. 成功要素与弱点
| 类别 | 要点 | 证据 |
|---|---|---|

## 3. 对自己的建议
| 类型 | 建议 | 证据 | 风险 |
|---|---|---|---|
（类型只能是：学什么、避开什么、差异化方向）
```

### 保存报告

在会话里给出完整报告后，再用 Write 工具把同样的 Markdown 保存到 `~/SilkRoad/reports/competitor-<竞品店铺名>-<今天日期>.md`（`~` 换成用户主目录的绝对路径，日期用 YYYY-MM-DD，文件名里的空格和斜杠换成 `-`，目录不存在就先创建）。保存后告诉用户文件路径；用户可以在 SilkRoad 面板的「报表」或右侧边栏的「SilkRoad 报告」里查看。用户说不需要保存时就不保存。

## 7. 人工确认点

- 竞品由用户选定，不要自行替换。
- 不替竞品下结论式的判断（如"它一定在亏钱"）。只描述数据能支持的内容。
- 分析仅用于学习。不建议抄袭对方的图片、视频或文案；建议要落在"思路"和"差异化"上。
- 深挖（逐条视频、逐个商品）前先告诉用户会消耗额度，并用 `mcp__fastmoss__credit_usage_summary` 查剩余额度。

## 8. 失败与降级

- 找不到竞品 seller_id：让用户提供店铺链接或准确名称。
- 某个接口没有数据：写"没有数据"，不用 0 代替。
- 只有类目没有竞品：先给候选列表，等用户选择。
- 返回的时间范围与要求不一致：以实际返回的范围为准，并在报告中写明。

## 9. 边界

- 只读。不联系竞品，不替用户决定上新或定价。
- 不把 FastMoss 估算当成对方的真实经营数据。
