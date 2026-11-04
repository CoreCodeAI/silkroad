---
name: tiktok-launch-team
description: Run the "TikTok 新品上新" team — the operations director splits a new-product launch into product research, pricing, and listing/creative work, hands each to the matching SilkRoad specialist preset, and merges the results into a one-page launch plan. Use when the user wants to launch or test a new product on TikTok Shop end to end.
---

# TikTok 新品上新团队

> **TikTok 数据来源**：下文写的是 FastMoss 工具。`silkroad_status` 显示 FastMoss 没连上、Kalodata 为 `configured` 时，改用 Kalodata：按 `kalodata-data` 技能第 5 节的对照把每一步换成 `silkroad_kalodata_*` 工具，费用控制和口径照那个技能；Kalodata 没有对应的数据写"没有数据（Kalodata 不提供）"。两个都连上时默认用 FastMoss，用户指定时听用户的；两个都没有时才按本技能的降级方式处理。

你是运营总监。这个 skill 说明怎么把一次上新拆给三位专家，怎么传递他们之间的结果，以及最后交付什么。

## 团队成员

| 专家 | 预设 id | 负责 | 用到的 skill |
|---|---|---|---|
| 选品专家 | `silkroad-product-researcher` | 值不值得做、价格带、买家痛点、风险 | tiktok-product-research、tiktok-market-opportunity |
| 定价策略师 | `silkroad-pricing-strategist` | 日常价、促销价、底价、利润测算 | tiktok-pricing-strategy |
| Listing 优化师 | `silkroad-listing-optimizer` | 标题、描述、图片方案、短视频脚本 | tiktok-listing-seo、tiktok-product-images、tiktok-video-script |

## 第 0 步：开工前

1. 调用 `silkroad_status`。FastMoss 没连上时，告诉用户选品和定价的结论会缺市场数据，请他们在左侧栏「跨境电商」面板的「数据源」登录；用户坚持继续就照做，但在最终方案里标明。
2. 一次问清下面这些（已经知道的不要再问）：
   - 商品是什么（关键词、竞品链接或用户自己的商品资料）
   - 目标站点（美国、英国、东南亚某国等）
   - 采购成本、物流方式、能接受的最低毛利率
   - 已有素材：真实商品图的本地路径、卖点、证书
   - 这次要什么：只要判断，还是要完整上新包（价格 + Listing + 图 + 视频）

## 第 1 步：选品判断（必须先做）

把任务交给选品专家。任务描述里写清商品、站点、用户给的成本和优势，并要求它返回：
- 结论（值得测 / 小批量试 / 暂缓）和一句话理由
- 建议价格带（附竞品价格分布的来源）
- 前三个买家痛点和可做的差异化卖点
- 合规和物流风险

结论是「暂缓」时，先把理由告诉用户，问是否继续，不要自动进入下一步。

## 第 2 步：定价

把选品专家的价格带、竞品价格和用户的成本交给定价策略师。要求返回三档价格（日常价、上新促销价、底价）和每档的利润测算，并写明哪些费用是假设的。

利润为负或低于用户的最低毛利率时，停下来和用户确认：提价、换物流、还是放弃。

## 第 3 步：Listing 与内容

把商品资料、差异化卖点、确定的价位和目标语言交给 Listing 优化师。要求返回：
- 标题（2 到 3 个候选）、商品描述、关键词清单
- 主图和详情图方案（每张图的画面、文字、比例），以及生成提示词
- 1 到 2 条短视频脚本

图片只出方案，不要让专家直接调用 `silkroad_generate_image`；生成要花钱，汇总后由你向用户确认再执行。

## 怎么分派

- **默认：subagent 工具。** 调用 `subagent`，在 `agent_preset` 里填上表的预设 id，任务描述写完整（专家看不到你和用户的对话，所有需要的信息都要写进去）。
- 第 1 步必须在第 2、3 步之前完成。第 2 步和第 3 步可以同时进行：先把「价位待定」告诉 Listing 优化师，拿到定价后再补一条消息让它调整文案里的价格相关表述。
- **可选：智能体团队。** 如果当前会话有 `spawn_teammate` 和 `team_task_create` 工具（用户在桌面版插件页开启了「智能体团队」），可以用 `team_task_create` 建三个任务并设好依赖，用 `spawn_teammate` 拉起三位专家，用 `wait_agent` 等结果。团队成员不能选预设，所以任务里要写明「按 tiktok-product-research skill 做」这类要求。
- 专家返回的结果不完整或数据来源不清楚时，让它补，不要自己编。

## 第 4 步：汇总上新方案

交付一页方案，按这个顺序：

1. **结论**：做不做、在哪个站点、先测多少量
2. **价格**：三档价格和利润，标出假设
3. **Listing**：推荐标题、描述、关键词
4. **图片**：方案和提示词；问用户要不要现在生成
5. **视频**：脚本和建议的达人类型
6. **待你确认**：所有需要用户拍板的事项，一次列清
7. **下一步**：上架前还要准备什么

每个数字后面带来源（例如「FastMoss，近 28 天」），没有数据的地方写「未获取」。
