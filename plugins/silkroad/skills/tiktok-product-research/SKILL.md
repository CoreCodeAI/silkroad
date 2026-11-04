---
name: tiktok-product-research
description: Judges whether a TikTok Shop product idea or competitor product is worth testing in one chosen market, covering demand trend, concentration, price bands, content dependence, buyer pain points and compliance risk. Uses FastMoss (or Kalodata) tools in cost-aware stages. Use for product selection questions.
---

# 选品调研（TikTok Shop）

> **TikTok 数据来源**：下文写的是 FastMoss 工具。`silkroad_status` 显示 FastMoss 没连上、Kalodata 为 `configured` 时，改用 Kalodata：按 `kalodata-data` 技能第 5 节的对照把每一步换成 `silkroad_kalodata_*` 工具，费用控制和口径照那个技能；Kalodata 没有对应的数据写"没有数据（Kalodata 不提供）"。两个都连上时默认用 FastMoss，用户指定时听用户的；两个都没有时才按本技能的降级方式处理。

目标：用数据回答"这个商品方向值不值得在某个站点测试"。结论放最前，证据放后面。

## 0. 先确认输入

必需：
- 站点（如 US、GB、ID、TH、MY、VN、PH、SG、MX）。用户没说就问，不要默认。
- 商品方向：关键词、类目名，或竞品商品 ID。

可选（缺了不阻塞，但会影响结论）：目标售价区间、采购成本、自身优势（货源、品牌、内容能力）。

只问缺的部分，合成一句话问完，例如："请告诉我目标站点（如 US/ID/TH），以及商品方向是关键词、类目还是竞品 ID；如果有售价区间和采购成本也一并给我。"

## 1. 检查数据源

1. 调用 `silkroad_status`。不要凭印象说 FastMoss 连没连上。
2. FastMoss 为 `connected`：继续。
3. 为 `disconnected`、`expired` 或 `error`：说明本场景的需求、销量、竞争数据都依赖 FastMoss。先问用户要不要现在连接；同意后按 silkroad-setup 的流程调用 `silkroad_connect`，`source` 用 status 返回的 id，不要自己猜。连上之前，只做第 5 节的降级模式。
4. 为 `awaiting-browser`：请用户在浏览器里完成登录，然后再调用一次 `silkroad_status`。

## 2. 把输入换成工具参数

- 类目名：调用 `mcp__fastmoss__search_category_by_words` 换成类目 ID。返回多个候选时列出来让用户选，不要自己挑。
- 竞品 ID：调用 `mcp__fastmoss__product_detail_info` 取类目、价格、店铺、评分。用户只给了链接、拿不到 ID 时，请用户提供 ID，或改用关键词搜索；不要从 URL 猜 ID。
- 所有工具的参数名以连接后实际返回的工具 schema 为准。本文和 FastMoss 速查表只用来选工具，不要照抄参数名。

## 3. 第一阶段：初筛（约 7 次调用）

目的是用最少的调用给出初步结论。时间窗口默认截止到昨天（T-1）。例如今天是 2026-11-04，"近 28 天"指 2026-10-07 至 2026-11-03。以工具实际返回的日期为准，并把起止日期写进结果。

| 序号 | 工具 | 参数要点 | 用来算什么 |
|---|---|---|---|
| 1 | `mcp__fastmoss__market_category_analysis` | analysis_type=basic_metrics，近 28 天 | 类目 GMV、销量、商品数 |
| 2 | `mcp__fastmoss__market_category_analysis` | analysis_type=sales_trends，近 90 天 | 7/28/90 天增长率 |
| 3 | `mcp__fastmoss__market_category_analysis` | analysis_type=price_distribution，近 28 天 | 价格带 |
| 4 | `mcp__fastmoss__market_category_ranking` | 类目排名、增长、集中度 | 与第 5 步交叉核对集中度 |
| 5 | `mcp__fastmoss__product_rank_top_selling` | 类目内前 20 | 集中度、价格、店铺 |
| 6 | `mcp__fastmoss__product_rank_new_listed` | 类目内新品榜，前 20 | 新品能不能冲上来 |
| 7 | `silkroad_serpapi_search` | engine=google_trends，关键词，站点对应地区，近 90 天 | 站外搜索热度（代理指标） |

- 第 1–7 步之间没有依赖，可以并行发起。
- 第 7 步只在 SerpApi 为 `configured` 时执行；为 `missing` 时跳过并说明。Google Trends 反映的是全网搜索，不是 TikTok Shop 内的搜索，结论里要写明它是代理指标。
- 分页参数（`page`、`pagesize`）按 schema 设置，初筛只取第一页。

## 4. 指标怎么算

- **增长率**：G_n = 近 n 天 GMV 合计 ÷ 紧邻的前 n 天 GMV 合计 − 1，n 取 7、28、90。用 `sales_trends` 的每日序列自己算，再和工具返回的增长字段对一下；两者不一致时以序列计算为准，并说明。若只看销量，要写"销量增长"。
- **类目集中度**：CR10 = 前 10 名商品 GMV 之和 ÷ 类目总 GMV。类目总 GMV 取自 `basic_metrics`。拿不到总量时，用前 20 样本内求和，并标注"样本内估算，会高估集中度"。
- **店铺集中度**：把前 20 商品按店铺合并，取前 5 店铺的 GMV 占比（CR5）。
- **价格带**：以 `price_distribution` 返回的分段为准。没有分段时，用前 20 商品的 GMV 加权，按 P25、P75 切成低、中、高三带，分别给出 GMV 份额和商品数。价格用站点本币，不同站点之间不直接比较。
- **新品表现**：近 90 天上架的商品在前 20 销量榜中的数量，以及它们的 GMV 份额。工具不返回上架时间时，只能给出新品榜的数量，并注明"无法确认上架时间"。
- **内容依赖**（深挖阶段）：前 10 商品的 `mcp__fastmoss__product_overview` 渠道占比（视频、直播、商品卡），按 GMV 加权。
- **达人量级**（深挖阶段）：`mcp__fastmoss__market_category_author_sales_matrix` 中各粉丝层级的 GMV 占比。占比最高的层级即"主要带货量级"。
- **买家痛点**（深挖阶段）：`mcp__fastmoss__product_review_list` 取前 3–5 个商品的 1–3 星评价，归到主题（如尺寸、做工、说明书、异味、续航、包装破损），每个主题写条数和占比。主题归类属于推断，要标注"推断"。评价不足 30 条时直接说样本少。

**默认结论规则**（启发式阈值，不是行业标准，用户可以改，改了要重新算结论）：
- 值得测：G28 ≥ +10%，CR10 ≤ 40%，前 20 销量榜中至少 2 个近 90 天新品，至少一个价格带有非垄断份额，主要内容渠道是用户能做的。
- 暂缓：G28 ≤ −10%，或 CR10 ≥ 60%，或命中高风险合规项。
- 其余为"小批量试"。

## 5. 降级模式（FastMoss 不可用或数据不足）

- 不给销量、GMV、集中度等数字。
- 能做的：`silkroad_serpapi_search` 的站外搜索趋势（已配置时）、`silkroad_web_search` 的合规检查、用户自己提供的成本和价格判断。
- 结论只能写"信息不足，暂不判断"，或基于用户信息的定性判断，并写明"未使用销售数据"。
- 告诉用户：连上 FastMoss 后可以补全，并说明会消耗额度。

工具返回空结果：写"没有数据"。可以放宽一次（上一级类目、同义关键词），仍为空就停止，不估算填空。

工具报错或限额：说明是哪一次调用失败，同一个调用最多重试一次。

工具不在可用列表里：说明缺哪个工具、影响哪一节，其他节照常做。

## 6. 初步结论后先停下，问用户要不要深挖

输出第一阶段报告后，先调用 `mcp__fastmoss__credit_usage_summary` 查剩余额度，再列出深挖项和大致调用次数，问用户是否继续。未经同意不做深挖。

深挖项（第二阶段）：
- `mcp__fastmoss__product_sales_trend`：前 3–5 个商品，看销量是否在涨。
- `mcp__fastmoss__product_overview`：前 10 个商品，算渠道占比。
- `mcp__fastmoss__product_creator_analysis`：前 3 个商品，看谁在卖、佣金若有字段则取范围。
- `mcp__fastmoss__market_category_author_sales_matrix`：类目达人量级。
- `mcp__fastmoss__product_review_list`：前 3–5 个商品的低分评价。

合规检查不消耗 FastMoss 额度，可以在第一阶段用 `silkroad_web_search` 完成。重点核对：含锂电池、液体或膏状（运输限制）、儿童用品（需认证）、医疗或功效宣称、食品和保健品、化妆品、带磁、疑似侵权品牌。`mcp__fastmoss__search_fastmoss_documents` 只能查 FastMoss 自己的数据口径说明，不能当作平台规则。平台规则以 TikTok Shop 官方为准。你只能指出风险类别，不能下合规结论，要请用户到卖家中心核对。

## 7. 输出模板

```
## 结论：值得测 / 小批量试 / 暂缓
一句话理由，引用 1–2 个关键数字，并写来源。

## 1. 需求
| 指标 | 数值 | 来源 |
|---|---|---|
| 近 28 天 GMV | … | mcp__fastmoss__market_category_analysis basic_metrics，2026-10-07~2026-11-03 |
| 7/28/90 天增长 | … | sales_trends，同上窗口 |
| 站外搜索趋势 | … | silkroad_serpapi_search google_trends，近 90 天（代理指标） |

## 2. 竞争
集中度（CR10、CR5）、头部商品与店铺、新品进入情况、价格带分布。

## 3. 内容依赖
销量主要来自视频、直播还是商品卡；需要的达人量级。

## 4. 买家痛点
差评主题、条数、占比、样本量。标注"推断归类"。

## 5. 风险
季节性、合规项（逐条写依据和待核对事项）、物流（体积、重量、液体、电池）。

## 6. 建议下一步
- 测什么价格：交给定价策略师（tiktok-pricing-strategy）。
- 找什么量级的达人。
- 准备什么内容：交给 Listing 环节。
- 还缺哪些数据，以及补齐它要花多少次调用。
```

写作要求：
- 每个数字后面都要有来源（工具名、分析类型、时间窗口）。
- 推断必须标注"【推断】"，不能混在事实里。
- 没有数据的地方写"没有数据"，不要估算。

## 8. 人工确认点

- 开始前：确认站点和类目范围。
- 初步结论后：是否深挖（先报额度再问）。
- 最终是否测品、测什么价格：由用户决定。
- 用户调整阈值后，重新计算结论并说明变化。

## 9. 边界

- 只做选品判断和证据，不写商品标题、描述或脚本。
- 不替用户决定测不测。
- 不编造商品参数、认证、材质、功效或用户评价。
