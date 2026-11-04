---
name: tiktok-product-diagnosis
description: Diagnoses how one TikTok Shop product is doing against products in the same category and price band, covering revenue, sales trend, channel mix, creator and content coverage and commission, then explains the gaps and suggests what to try next. Uses Kalodata (or FastMoss) data. Use when the user asks how a product (theirs or a competitor's) is performing or how to lift its sales.
---

# 单品诊断（TikTok Shop）

目标：回答"这个商品在同类同价位里处在什么位置、差在哪、下一步试什么"。结论放最前，证据放后面。

## 0. 先确认输入

必需：
- 商品 ID（TikTok 商品 ID）。用户只给了链接时，请用户给出商品 ID 或店铺名＋商品名；不要从链接里猜 ID。
- 站点（如 US、GB、ID、TH）。没说就问。

可选：是不是用户自己的商品、主推渠道（视频、直播、商品卡）、诊断关注点（销量下滑、转化、达人合作等）。

## 1. 检查数据源

1. 调用 `silkroad_status`。
2. Kalodata 为 `configured`：按下文步骤做（工具用法和费用见 `kalodata-data` 技能）。
3. 只有 FastMoss 连上：用 `kalodata-data` 第 5 节对照表反过来找 FastMoss 工具（商品详情用 `mcp__fastmoss__product_detail_info` 和 `mcp__fastmoss__product_overview`，同类榜单用 `mcp__fastmoss__product_rank_top_selling`），参数以工具 schema 为准。
4. 两个都没有：说明这个诊断依赖商品销售数据，请用户在左侧栏「跨境电商」面板的「数据源」登录 FastMoss 或填写 Kalodata Key。不要估算数字。

开始前先说明大概要花多少：Kalodata 做完第 2–3 节约 5 次调用、0.5 积分左右，加做评论洞察再加 1 积分。用 `silkroad_kalodata_credit` 查余额。

## 2. 读取商品本身（约 2 次调用）

| 序号 | 调用 | 取什么 |
|---|---|---|
| 1 | `silkroad_kalodata_detail` entity=product，`date_range=last30Day` | 价格区间、收入、销量、渠道收入、达人数、视频数、直播数、佣金率、上架日期、评价数、`revenue_trend`、类目 ID |
| 2 | 同上，`date_range=last90Day` | 和近 30 天对比看趋势 |

单价取 `unit_price`；没有时用 `min_price`～`max_price`。

## 3. 找对标组（约 1–2 次调用）

- 用商品的三级类目 ID（`ter_cate_id`；没有就用二级）做 `silkroad_kalodata_rank` entity=product，`filters.category_ids`，`filters.unit_price_range` 取商品单价的 ±30%，`date_range=last30Day`，`page_size=100`，按 `revenue` 排序。
- 对标组少于 20 个商品时，把价格范围放宽到 ±50% 再取一次；仍不足就用整个类目，并在报告里写明"对标组不限价格带"。
- 对标组里去掉被诊断的商品本身。

## 4. 指标怎么算

- **相对位置**：收入、销量在对标组中的分位（例如"高于 72% 的同类商品"）和名次。
- **增长**：近 30 天日均收入 ÷ 近 90 天日均收入 − 1。`revenue_trend` 可按日计算时，再给出近 7 天对比前 7 天。
- **渠道结构**：视频、直播、商品卡（或橱窗、商城）收入各占多少；和对标组前 10 名的平均结构对比。
- **内容覆盖**：每 1 万美元收入对应的达人数、视频数；和对标组前 10 名对比。覆盖明显偏低说明主要靠少数达人或自然流量。
- **佣金**：商品佣金率和对标组中位数对比。
- 所有对比都写清对标组的条件和样本数。

## 5. 可选深挖（先问用户）

- `silkroad_kalodata_product_insight` kind=review_insight：差评痛点和好评卖点（1 积分）。
- `silkroad_kalodata_rank` entity=creator，`filters.product_id`：谁在卖这个商品，量级分布。
- `silkroad_kalodata_rank` entity=video，`filters.product_id`：带货视频的播放和成交集中在哪几条。
- 对标组前 3 名做同样的详情读取，逐项对比。

## 6. 输出模板

```
## 结论
一句话：在【类目】【价格带】里排第 N / 样本 M，主要差距是……

## 1. 基本面
价格、近 30/90 天收入和销量、增长，带来源。

## 2. 在同类中的位置
分位、名次、和对标组前 10 平均值的对比表。

## 3. 差距和原因
渠道结构、内容覆盖、佣金、评价。每条写事实，再写【推断】的原因。

## 4. 建议试什么
按预期影响排序，每条写要动什么、怎么验证、要看哪个数字。改价交给 tiktok-pricing-strategy，改文案交给 tiktok-listing-seo，找达人交给 tiktok-creator-discovery。

## 5. 数据说明
对标组条件、样本数、时间范围、调用次数和花费积分、没有数据的部分。
```

## 7. 边界

- 只读数据和给建议；不改价、不改 Listing、不联系达人。
- 推断标注"【推断】"；没有数据写"没有数据"。
- 诊断竞品时只用公开的市场数据，不推测对方的成本和利润。
