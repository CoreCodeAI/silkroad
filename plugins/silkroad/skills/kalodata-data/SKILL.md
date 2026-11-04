---
name: kalodata-data
description: How to get TikTok Shop market data from Kalodata with SilkRoad's silkroad_kalodata_* tools, what each call costs, and which Kalodata call stands in for each FastMoss step in the other SilkRoad skills. Use whenever a task needs TikTok product, shop, creator, video, livestream or category data and Kalodata is configured, especially when FastMoss is not connected.
---

# Kalodata 数据速查

Kalodata 是丝路的 TikTok Shop 数据源之一，和 FastMoss 二选一或一起用。用户在左侧栏「跨境电商」面板的「数据源」里填自己的 Kalodata Key（在 Kalodata 开放中心「账户管理」生成），按 Kalodata 积分计费。

## 1. 什么时候用 Kalodata

1. 先调用 `silkroad_status`，看 `connectors` 里的 FastMoss 和 `vendors` 里的 Kalodata。
2. 用户点名用哪个就用哪个。
3. 只有 Kalodata 为 `configured`：用 Kalodata。
4. 两个都能用：沿用当前技能写的 FastMoss 步骤；FastMoss 缺某项数据（或额度不足）时，用 Kalodata 补，并在来源里写明。
5. 两个都没有：按当前技能的降级方式处理，并告诉用户可以登录 FastMoss 或填写 Kalodata Key。不要在对话里向用户要 Key。

## 2. 工具

| 工具 | 用途 | 费用（积分，1 积分约 0.1 美元，以 Kalodata 为准） |
|---|---|---|
| `silkroad_kalodata_rank` | 商品、店铺、达人、视频、直播、类目榜单，可筛选和排序 | 每返回 100 行 0.1 |
| `silkroad_kalodata_detail` | 单个商品、店铺、达人、视频、直播、类目的完整指标，含收入趋势和渠道构成 | 每次 0.1 |
| `silkroad_kalodata_product_insight` | `selling_points` 卖点和属性；`review_insight` 评论洞察；`reviews` 原始评论 | 0.1 / 1 / 免费 |
| `silkroad_kalodata_media` | 商品图片、达人头像、视频文件的签名链接，约 5 分钟过期 | 0.01 / 0.1 / 0.5 |
| `silkroad_kalodata_credit` | 积分余额、消耗记录 | 免费 |

参数名以工具 schema 为准；筛选项和排序字段写错时工具会直接报错并列出允许的名字，照着改，不要换着名字猜。

## 3. 控制费用

- 多次调用的分析开始前，先用 `silkroad_kalodata_credit`（`kind=balance`）查余额，告诉用户大概要调用几次、花多少积分。
- 榜单的 `page_size` 只取需要的行数：初筛 20 行通常够了，按 100 行计费，取 20 行和取 100 行一样贵，需要更多样本时直接取 100 行，不要连翻 5 页 20 行。
- 同一个对话里已经拿到的数据直接复用，不要重复调用。
- `review_insight` 每次 1 积分（洞察两周左右更新一次，没更新时再取不扣费），只对重点商品用。
- 调用失败（`success:false`）不扣费；同一个调用最多重试一次。

## 4. 口径

- **站点**：`region` 必填，用户没说就问，不要默认 US。
- **时间**：榜单只支持 `lastDay`、`last7Day`、`last30Day`、自然月 `yyyy-MM` 或不超过 30 天的 `yyyy-MM-dd~yyyy-MM-dd`；详情还支持 `last60Day` 到 `last365Day`。类目榜单和类目详情只支持 `last7Day`、`last30Day`、`last90Day`、`last180Day`、`last365Day`。报告里写清实际用的时间范围。
- **金额**：`currency` 默认取面板设置（一般是 USD）。不同货币的数字不能放在一起比。
- **字段名**：销量字段是 `sales_volumn`（Kalodata 的拼写）。收入是 `revenue`，渠道收入有 `video_revenue`、`live_revenue`、`showcase_revenue`（橱窗）或 `shopping_mall_revenue`（商城）。佣金率是百分点，`15` 表示 15%。
- **趋势**：详情里的 `revenue_trend` 是所选时间段的收入序列。长度和天数一致时按日序列算增长；对不上时只描述走势，并说明"序列粒度未确认"。
- **类目 ID**：Kalodata 没有按关键词搜类目的接口。用 `silkroad_kalodata_rank`（`entity=category`，`filters.category_level` 取 1、2 或 3，`page_size=100`）拉类目列表，按 `category_name` 匹配；有多个候选时列出来让用户选。类目 ID 只在 Kalodata 内部通用，不能拿去 FastMoss 用，反过来也一样。
- **链接**：`silkroad_kalodata_media` 的链接几分钟就失效，只能马上用，不要写进报告当长期链接。

## 5. FastMoss 步骤怎么换成 Kalodata

其他技能写的是 FastMoss 工具。用 Kalodata 时按下表替换；表里写"没有对应"的，就在报告里写"没有数据（Kalodata 不提供）"，不要估算。

| 技能里的 FastMoss 步骤 | Kalodata 做法 |
|---|---|
| `search_category_by_words` 类目名换 ID | 第 4 节"类目 ID"的做法 |
| `market_category_analysis` basic_metrics | `silkroad_kalodata_detail` entity=category |
| `market_category_analysis` sales_trends | 同上，用 `revenue_trend`；增长率用 `last30Day` 和更长窗口对比，或看 `revenue_growth_rate` |
| `market_category_analysis` price_distribution | 没有现成分布：用 `silkroad_kalodata_rank` entity=product 取类目前 100 名，按 `unit_price` 自己分价格带，标注"前 100 样本内估算" |
| `market_category_ranking` | `silkroad_kalodata_rank` entity=category |
| `product_rank_top_selling` | `silkroad_kalodata_rank` entity=product，`filters.category_ids`，按 `revenue` 或 `sales_volumn` 排序 |
| `product_rank_new_listed` | 同上，加 `filters.launch_date`（如 `"<30"` 表示 30 天内上架） |
| `product_search` | `silkroad_kalodata_rank` entity=product，`filters.keyword` |
| `product_detail_info`、`product_overview`、`product_sales_trend` | `silkroad_kalodata_detail` entity=product（含价格区间、渠道收入、达人数、视频数、直播数、`revenue_trend`） |
| `product_sku` | 没有对应；只有详情里的 `min_price`、`max_price` |
| `product_creator_analysis` | `silkroad_kalodata_rank` entity=creator，`filters.product_id` |
| `product_video_list` | `silkroad_kalodata_rank` entity=video，`filters.product_id` |
| `product_review_list` | `silkroad_kalodata_product_insight` kind=reviews（仅 US、SG、ID、TH、VN、PH、MY）；要归纳时先看 kind=review_insight |
| `shop_search`、`shop_rank_top_selling` | `silkroad_kalodata_rank` entity=shop（`filters.keyword`、`category_ids`、`shop_type`） |
| `shop_base_info`、`shop_data_trends`、`shop_sale_analysis` | `silkroad_kalodata_detail` entity=shop |
| `shop_product_analysis` | `silkroad_kalodata_rank` entity=product，`filters.shop_id` |
| `shop_creator_analysis` | `silkroad_kalodata_rank` entity=creator，`filters.shop_id` |
| `shop_video_analysis` | `silkroad_kalodata_rank` entity=video，`filters.shop_id` |
| `shop_live_analysis` | `silkroad_kalodata_rank` entity=livestream，`filters.shop_id` |
| `creator_search`、`creator_rank_top_ecommerce` | `silkroad_kalodata_rank` entity=creator（`keyword`、`category_ids`、`followers_range`、`engagement_rate`、`creator_type`） |
| `creator_profile_overview`、`creator_data_trends`、`creator_cargo_summary` | `silkroad_kalodata_detail` entity=creator |
| `creator_product_list` | `silkroad_kalodata_rank` entity=product，`filters.creator_id` |
| `creator_video_analysis` | `silkroad_kalodata_rank` entity=video，`filters.creator_id` |
| `creator_fans_distribution` | 没有对应 |
| `market_category_author_sales_matrix` | 没有现成矩阵：按粉丝段（如 `<10000`、`10000-100000`、`100000-1000000`、`>1000000`）分别调用 entity=creator 榜单并求和，标注"榜单样本内估算"，先告诉用户要调用几次 |
| `video_search`、`video_detail_analysis`、`video_data_trends` | `silkroad_kalodata_rank` entity=video / `silkroad_kalodata_detail` entity=video（含互动、成交和广告指标） |
| `video_script_info` | 没有对应；Kalodata 不提供视频文案。可以用标题、时长、互动和成交数据分析，口播结构写"没有数据" |
| `ad_search`、`ad_data_overview` | 部分对应：视频榜单可按 `ads_roas` 筛选和排序，视频详情有广告播放、ROAS、投放天数、CPA |
| `credit_usage_summary` | `silkroad_kalodata_credit` |
| `search_fastmoss_documents` | 没有对应；Kalodata 口径以它的开放中心文档为准 |

## 6. 报告里怎么写来源

每个数字后面写：`Kalodata <工具> <entity 或 kind>，<region>，<date_range>`，例如"Kalodata 商品榜单，US，last30Day"。估算和推断照所在技能的规则标注。
