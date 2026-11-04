---
name: tiktok-creator-diagnosis
description: Evaluates one TikTok creator against creators in the same category and follower tier, covering GMV, GPM, video versus live mix, engagement, partner shops and products, so the user can decide whether to work with them or how an existing partnership is doing. Uses Kalodata (or FastMoss) data. Use when the user asks whether a creator is worth partnering with or how a creator is performing.
---

# 达人诊断（TikTok Shop）

目标：回答"这个达人带货能力在同类同量级里怎么样，适不适合我的商品"。结论放最前，证据放后面。

## 0. 先确认输入

必需：
- 达人 ID，或达人的 handle（@ 后面的名字）。只有 handle 时，用 `silkroad_kalodata_rank` entity=creator，`filters.keyword` 填 handle 查 ID；多个候选时列出来让用户确认。
- 站点。没说就问。

可选：用户要推的商品（ID 或类目）、合作方式（纯佣金、寄样、付费）、是否已经合作过。

## 1. 检查数据源

1. 调用 `silkroad_status`。
2. Kalodata 为 `configured`：按下文步骤做（见 `kalodata-data` 技能）。
3. 只有 FastMoss 连上：按 `kalodata-data` 第 5 节对照表换成 FastMoss 的达人工具（`mcp__fastmoss__creator_profile_overview`、`mcp__fastmoss__creator_data_trends`、`mcp__fastmoss__creator_search` 等），参数以 schema 为准。
4. 两个都没有：说明需要数据源，请用户在「数据源」连接。不要凭印象评价达人。

开始前说明花费：第 2–3 节约 3–4 次调用、0.4 积分左右。

## 2. 读取达人本身（约 2 次调用）

| 序号 | 调用 | 取什么 |
|---|---|---|
| 1 | `silkroad_kalodata_detail` entity=creator，`date_range=last30Day` | 成交额、销量、视频和直播收入、视频数和总播放、直播场次和观看、GPM、合作店铺数、合作商品数、粉丝数和新增粉丝、收入趋势 |
| 2 | `silkroad_kalodata_rank` entity=product，`filters.creator_id`，`page_size=20` | 近期主要带哪些商品、在哪些类目 |

用户给了自己的商品类目时，可以在第 1 步的 `options.category_ids` 里限定类目，看达人在这个类目里的成交。

## 3. 找对标组（约 1 次调用）

- 粉丝段：按达人粉丝数取同一量级，例如 1 万–10 万、10 万–50 万、50 万–100 万、100 万以上，写成 `filters.followers_range`（如 `"100000-500000"`）。
- 类目：用达人成交最多的类目，或用户商品的类目，写进 `filters.category_ids`。
- 调用 `silkroad_kalodata_rank` entity=creator，`date_range=last30Day`，`page_size=100`，按 `revenue` 排序。

## 4. 指标怎么算

- **成交位置**：成交额、销量在对标组里的分位。
- **GPM**：每千次播放带来的成交额。工具返回了 GPM 字段就用它；没有时用"视频收入 ÷ 视频总播放 × 1000"自己算，并注明。视频和直播分开算。
- **渠道结构**：视频收入和直播收入的占比。和用户的合作方式对照：用户只做短视频时，直播为主的达人匹配度低。
- **稳定性**：收入趋势是平稳、增长还是靠一两次爆发；新增粉丝是正是负。
- **专注度**：合作店铺数、合作商品数。商品很多而单品成交低，说明带货分散。
- **互动**：对标时可以用 `filters.engagement_rate`（LOW、MEDIUM、HIGH）看同量级达人的分布。
- 所有对比都写清对标组条件和样本数。

## 5. 可选深挖（先问用户）

- `silkroad_kalodata_rank` entity=video，`filters.creator_id`：近期带货视频，看哪几条贡献了大部分成交。
- `silkroad_kalodata_rank` entity=livestream，`filters.creator_id`：直播场次和每场成交。
- 用户的商品已经在被这个达人推广时：`silkroad_kalodata_rank` entity=creator，`filters.product_id`，看这个达人在该商品的所有达人里排第几。

## 6. 输出模板

```
## 结论：推荐合作 / 可以小范围试 / 不建议
一句话理由，引用 1–2 个关键数字和来源。

## 1. 达人概况
粉丝、近 30 天成交、视频/直播、合作店铺和商品数。

## 2. 同类同量级对比
对标组条件和样本数；成交、GPM、渠道结构的分位对比表。

## 3. 和你的商品匹配吗
类目、价格带、内容形式、合作方式是否对得上；写事实和【推断】。

## 4. 风险
成交集中在一两条内容、带货品类分散、粉丝下滑、合作店铺过多等，每条写依据。

## 5. 下一步
要不要建联（交给 tiktok-creator-outreach）、寄样简报（tiktok-sample-brief）、建议的合作方式和要盯的数字。
```

## 7. 边界

- 只做评估，不替用户联系达人，不承诺合作效果。
- 不收集或推测达人的私人信息；联系方式只用数据源公开返回的。
- 推断标注"【推断】"；没有数据写"没有数据"。
