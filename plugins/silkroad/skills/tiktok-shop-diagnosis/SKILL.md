---
name: tiktok-shop-diagnosis
description: Diagnoses how a TikTok Shop store performed over a period versus the previous period, covering GMV, orders, refunds, channels, products, creators and ads, separating store-specific causes from category-wide trends, and ends with ranked fixes and next-week actions.
---

# 店铺经营诊断（TikTok Shop）

> **TikTok 数据来源**：下文写的是 FastMoss 工具。`silkroad_status` 显示 FastMoss 没连上、Kalodata 为 `configured` 时，改用 Kalodata：按 `kalodata-data` 技能第 5 节的对照把每一步换成 `silkroad_kalodata_*` 工具，费用控制和口径照那个技能；Kalodata 没有对应的数据写"没有数据（Kalodata 不提供）"。两个都连上时默认用 FastMoss，用户指定时听用户的；两个都没有时才按本技能的降级方式处理。

目标：说清店铺最近经营得怎样、问题出在哪、下周先做什么。结论放最前，指标表和证据紧随其后。

## 0. 先确认输入

- 店铺：自己已授权的店铺（先调用 `silkroad_tts_shops` 列出，多店时让用户选），或 FastMoss 里的店铺（用 `mcp__fastmoss__shop_search` 按名称查，拿到 seller_id）。
- 站点。用户没说就问，不要默认。
- 时间范围：默认最近 28 天，对比前 28 天。
- 关注点（可选）：销量下滑、利润、退款、某个商品。

## 1. 检查数据源

1. 调用 `silkroad_status`，不要凭印象判断连接状态。
2. 自己店铺未授权：订单和退货数据不可用。报告开头写明，只用 FastMoss 做市场侧诊断，并注明所有数字是估算。
3. FastMoss 未连接：告诉用户在左侧栏「跨境电商」面板的「数据源」连接 FastMoss。没有它时，无法做渠道、达人、广告和大盘对比。
4. 缺哪个数据源，只影响依赖它的部分，其他部分照常做。不要在对话里索要任何密钥。

## 2. 取数

### 2.1 自己店铺的订单和退货（分页汇总）

1. 调用 `silkroad_tts_orders`，本期和上期各跑一遍。时间用 `create_time_ge`（含）和 `create_time_lt`（不含）。日期按店铺站点时区换算成 Unix 秒后传入，避免边界错位，并在报告里写明时区。
2. `page_size` 用 100。返回里有 `next_page_token` 就带上 `page_token` 继续取，直到没有为止。不能只看第一页就下结论。
3. 第一页返回后先看一次结构，确认金额、状态、商品明细的字段名，再开始统计。
4. 汇总口径（写进报告）：
   - GMV：排除未付款（UNPAID）和已取消（CANCELLED）订单。
   - 订单数：计入订单的数量。
   - 件数：计入订单的商品件数之和。
   - 客单价：GMV ÷ 订单数。
   - 动销商品数：至少有一单的不同商品数。
5. 退款率：`silkroad_tts_returns` 在同一时间窗口内的退货申请数 ÷ 订单数，或退款金额 ÷ GMV。二选一，写明用的是哪个。
6. 退款率上升时，再用 `silkroad_tts_returns` 的记录看集中在哪些商品和哪类原因。

### 2.2 市场侧数据（FastMoss，按需调用）

先用 `mcp__fastmoss__shop_data_trends` 拿店铺每日 GMV、件数、达人和直播趋势，与订单数据对照（两者口径不同，要标注差异）。然后按问题选工具：

| 要看什么 | 工具 |
|---|---|
| 渠道结构（视频、直播、商品卡、达人） | `mcp__fastmoss__shop_sale_analysis` |
| 商品结构、价格带、增长和下滑的商品 | `mcp__fastmoss__shop_product_analysis` |
| 合作达人数量和层级 | `mcp__fastmoss__shop_creator_analysis` |
| 广告投入和 ROAS | `mcp__fastmoss__shop_investment_analysis` |
| 类目大盘（判断是不是大盘因素） | `mcp__fastmoss__market_category_analysis` |

参数名以连接后实际返回的工具 schema 为准。每次调用都记下时间范围。

## 3. 核心指标表

| 指标 | 本期 | 上期 | 变化 | 来源 / 时间范围 |
|---|---|---|---|---|
| GMV | | | | 订单 / 日期 |
| 订单数 | | | | 订单 / 日期 |
| 件数 | | | | 订单 / 日期 |
| 客单价 | | | | 订单 / 日期 |
| 动销商品数 | | | | 订单 / 日期 |
| 退款率 | | | | 退货 / 日期 |

拿不到的写"没有数据"，不要估算填空。

## 4. 结构拆解与原因判断

1. 渠道：哪个渠道占比变化最大（FastMoss `shop_sale_analysis`）。
2. 商品：头部商品占 GMV 的比例（集中度）；增长最多和下滑最多的各 3 个。
3. 达人：合作达人数和它们的产出变化。
4. 广告：投入和 ROAS 的变化。
5. 大盘对比：如果类目整体同比也下降，先归为大盘因素。只有店铺跌幅明显大于大盘，才归为自身因素。
6. 判断只能基于上面的数字。凡是推测的原因，都要写"推断"。

## 5. 输出模板

```
## 结论
一句话：本期 GMV ... ，较上期 ...，主要问题是 ...

## 核心指标
（第 3 节表格）
数据范围：订单 YYYY-MM-DD 至 YYYY-MM-DD（时区 ...）；FastMoss 数据 ...
数据缺口：...

## 问题清单（按影响排序）
| 序号 | 现象 | 证据（来源） | 可能原因（推断） | 建议动作 | 负责角色 |
|---|---|---|---|---|---|

## 下周 3 到 5 个优先动作
1. ...
```

负责角色只能从这五个里选：选品、Listing、定价、投放、达人。

### 保存报告

在会话里给出完整报告后，再用 Write 工具把同样的 Markdown 保存到 `~/SilkRoad/reports/shop-diagnosis-<店铺名>-<今天日期>.md`（`~` 换成用户主目录的绝对路径，日期用 YYYY-MM-DD，文件名里的空格和斜杠换成 `-`，目录不存在就先创建）。保存后告诉用户文件路径；用户可以在 SilkRoad 面板的「报表」或右侧边栏的「SilkRoad 报告」里查看。用户说不需要保存时就不保存。

## 6. 人工确认点

- 涉及改价、下架、加预算、停投的建议：只给建议，由用户决定并自己操作。本 skill 不改任何店铺数据。
- 数据缺口（没有授权、只有 FastMoss 估算）必须写在报告开头。
- 深挖（逐个商品、逐条视频）前先告诉用户会消耗额度，可用 `mcp__fastmoss__credit_usage_summary` 查剩余额度，由用户决定是否继续。

## 7. 失败与降级

- 订单接口报错或返回为空：说明是哪一段时间、哪一个店铺没有取到，不要用 FastMoss 估算替代订单数据。
- FastMoss 的店铺 ID 找不到：让用户给出店铺的准确名称或 seller_id。
- 大盘数据缺失：结论里不做"大盘因素"判断，写明原因未能区分。

## 8. 边界

- 只读。不回复买家，不改商品，不改价格。
- 不把 FastMoss 的估算当作店铺真实经营数据。
- 不替用户决定预算和价格。
