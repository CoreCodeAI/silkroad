---
name: tiktok-viral-video-breakdown
description: Finds the best-converting TikTok Shop videos for a product, category or competitor and turns them into reusable patterns covering creator tier, length, posting age, organic versus paid, revenue per view and the selling angle, so the user can brief their own videos. Uses Kalodata (or FastMoss) data. Use when the user asks what kind of videos sell in a category or wants to copy what works without copying content.
---

# 爆款视频拆解（TikTok Shop）

目标：从高转化的带货视频里找出能复用的做法，给用户拍自己的视频用。只提炼结构和打法，不照搬别人的内容。

## 0. 先确认输入

必需：
- 范围：一个商品 ID、一个类目，或一个竞品店铺。类目名先按 `kalodata-data` 第 4 节换成类目 ID。
- 站点。没说就问。

可选：用户自己的商品、内容形式（真人出镜、无人出镜、AI 视频）、预算（自然流量还是投广告）。

## 1. 检查数据源

1. 调用 `silkroad_status`。
2. Kalodata 为 `configured`：按下文步骤做（见 `kalodata-data` 技能）。
3. 只有 FastMoss 连上：按 `kalodata-data` 第 5 节对照表换成 FastMoss 的视频工具；FastMoss 的 `mcp__fastmoss__video_script_info` 能取视频文案，有它时第 4 节的"卖点角度"可以基于文案来写。
4. 两个都没有：说明需要数据源，请用户在「数据源」连接。不要凭印象总结"爆款套路"。

开始前说明花费：第 2–3 节约 2–4 次调用、0.4 积分左右。

## 2. 拉视频样本（1–2 次调用）

`silkroad_kalodata_rank` entity=video，`date_range=last30Day`，`page_size=100`：
- 商品范围：`filters.product_id`。
- 类目范围：`filters.category_ids`。
- 店铺范围：`filters.shop_id`。
- 默认按 `revenue` 排序；想看投放效果时再按 `ads_roas` 排一次。
- 用户只做自然流量时，可以只看 `filters.ads_roas` 为空或很低的视频，并说明这样筛的含义。
- 用户问 AI 视频时，用 `filters.is_ai_video`（1 只看 AI 视频，0 排除）。

## 3. 读头部视频详情（约 0.1 积分一条）

对成交前 5–10 名调用 `silkroad_kalodata_detail` entity=video，取时长、曝光、点赞、分享、评论、挂车商品数、成交额、销量、GPM、成交趋势，以及广告播放、ROAS、投放天数、CPA、广告曝光占比。条数超过 5 条时先问用户。

## 4. 怎么提炼

- **集中度**：前 10 条视频占样本总成交的比例。很高说明靠少数爆款，复制难度大。
- **达人量级**：头部视频的达人粉丝段分布（用视频榜单里的达人信息，或用 `filters.followers_range` 分段再取一次）。看小达人能不能出单。
- **时长**：头部视频的时长分布，给出中位数和区间。
- **发布时间**：用 `filters.publish_date_range`（如 `"<7"`、`"<30"`）对比新视频和老视频的占比，判断是长尾持续出单还是短期爆发。
- **自然流量还是投放**：广告曝光占比和投放天数。广告占比高的视频，复制时要准备投放预算。
- **转化效率**：GPM、每次播放成交额。高播放低成交和低播放高成交分开看。
- **卖点角度**：根据视频标题、挂车商品和成交数据归纳（如开箱、对比、痛点演示、价格优惠、使用场景）。这一项属于【推断】，要写明依据；Kalodata 不提供视频文案，没有文案时不要编口播内容。
- 需要看画面时，可以用 `silkroad_kalodata_media` kind=video_url 取视频文件链接（0.5 积分一条，约 5 分钟过期），先问用户。

## 5. 输出模板

```
## 结论
这个范围里卖得好的视频大多是……（2–3 条可复用的规律，每条带数字）

## 1. 样本
范围、站点、时间、样本数、总成交、集中度。

## 2. 头部视频
表格：视频 ID、达人、时长、播放、成交、GPM、广告占比、卖点角度（推断）。

## 3. 可复用的打法
每条写：规律、证据、怎么用到你的商品上。

## 4. 不建议照做的
依赖大达人、依赖投放、内容不适合你的形式等。

## 5. 下一步
写脚本交给 tiktok-video-script，给达人的简报交给 tiktok-sample-brief，找合适的达人交给 tiktok-creator-discovery。
```

## 6. 边界

- 只提炼结构和打法，不复制别人的视频、文案、音乐或画面。
- 视频链接只临时使用，不写进报告当长期链接。
- 推断标注"【推断】"；没有数据写"没有数据"。
