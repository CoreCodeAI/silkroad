---
name: tiktok-creator-discovery
description: Finds and scores TikTok Shop creators for a product from FastMoss (or Kalodata) data (competitor sellers, keyword search and rankings), then tiers them into a shortlist with reasons and risks. Use when the user needs creators to promote a product or asks for a creator shortlist.
---

# TikTok Shop 达人发现

> **TikTok 数据来源**：下文写的是 FastMoss 工具。`silkroad_status` 显示 FastMoss 没连上、Kalodata 为 `configured` 时，改用 Kalodata：按 `kalodata-data` 技能第 5 节的对照把每一步换成 `silkroad_kalodata_*` 工具，费用控制和口径照那个技能；Kalodata 没有对应的数据写"没有数据（Kalodata 不提供）"。两个都连上时默认用 FastMoss，用户指定时听用户的；两个都没有时才按本技能的降级方式处理。

为一个商品找合适的带货达人，输出有数据依据的短名单。不以粉丝数为唯一标准，粉丝多但带货弱、粉丝画像不符的达人要排在后面。

## 0. 确认输入

- **必需**：商品（自己的商品 ID，或用户描述）；目标站点。站点没说就问，不要默认。
- **可选**：粉丝量级偏好；预算（佣金率、是否接受坑位费）；内容形式（短视频 / 直播）；目标人数（默认 15 人）。
- 自己的商品可用 `silkroad_tts_products`（传 `product_id`）读取标题、价格和类目。

## 1. 检查数据源

调用 `silkroad_status`。FastMoss 未 connected 时：

- 告诉用户：达人数据来自 FastMoss，请打开左侧栏「跨境电商」面板的「数据源」，登录 FastMoss 后再回来。
- 不索要账号密码或 API key，也不让用户把任何凭证粘贴到对话里。
- 仍可做的部分：根据商品描述和知识库列出目标达人画像（类型、粉丝段、内容形式），明确标注"未经数据验证"。不要列出具体达人名字。

## 2. 三路找候选

每一路先取一页（约 20 条），控制额度。

1. **竞品带货达人**：用 `mcp__fastmoss__product_search` 找 2–4 个同类在售商品（用户给了竞品 ID 则跳过），再对每个调用 `mcp__fastmoss__product_creator_analysis`。
2. **关键词和类目**：`mcp__fastmoss__creator_search`（关键词、类目、地区）。类目名先用 `mcp__fastmoss__search_category_by_words` 换成类目 ID。
3. **榜单**：`mcp__fastmoss__creator_rank_top_ecommerce`（带货榜）、`creator_rank_top_growth`（涨粉榜）、`creator_rank_top_potential`（潜力榜）。

去重以达人 ID 为准。同一人在多路命中，记下"命中路径"，作为参考信号，不单独决定入选。

## 3. 粗筛，再深查

**粗筛**：对所有候选调用 `mcp__fastmoss__creator_profile_overview`，看粉丝、互动和基本表现。地区明显不符、没有任何带货记录的直接剔除，并在结果里列出剔除原因。

**深查前先问用户**（深查会消耗额度），同意后对剩余前 10–15 人调用：

- `mcp__fastmoss__creator_cargo_summary`：视频与直播带货占比、主带品类。
- `mcp__fastmoss__creator_product_list`：橱窗商品，看有没有带过同类品。
- `mcp__fastmoss__creator_fans_distribution`：粉丝地区、性别、年龄，对比目标买家。
- `mcp__fastmoss__creator_data_trends`：粉丝和互动趋势，识别异常涨粉或断崖下跌。
- `mcp__fastmoss__creator_video_analysis`：内容风格，判断是否贴合该商品的使用场景。

## 4. 打分（100 分）

| 维度 | 分值 | 看什么 |
|---|---|---|
| 带货能力 | 35 | 近期 GMV、带货视频和直播数、同类品带货记录 |
| 粉丝匹配 | 25 | 地区、性别、年龄与目标买家的重合度 |
| 数据健康 | 15 | 互动稳定；没有明显异常涨粉或断崖下跌 |
| 内容风格 | 15 | 视频风格与商品展示方式是否贴合 |
| 合作性价比 | 10 | 佣金率、是否要坑位费（数据或用户给出时才评） |

- 某维度没有数据：写"没有数据"，该维度按一半分计，并在风险栏注明。不估算填空。
- 合作性价比没有数据：不参与排序，表格里留空。
- 分数只用来排序，不代表预测销量。

## 5. 分层

粉丝量只做粗分。默认阈值如下，可按站点和用户偏好调整，调整后要写明采用的阈值。

- **头部**（默认粉丝 50 万以上）：背书和爆发。建议 1–2 人。
- **腰部**（默认 5 万至 50 万）：主力，带货稳定。建议占名单一半左右。
- **尾部和素人**（默认 5 万以下）：铺量和素材。建议用剩余名额，可配小额佣金或寄样。

## 6. 合作方式建议

- **纯佣金**：适合有稳定带货记录的腰部和尾部。
- **寄样加佣金**：适合素人和尾部，用来积累素材。
- **付费（坑位费或固定费）**：只建议给有同类带货数据的头部或腰部，并提醒用户核对投入产出。

## 7. 联系方式

- 只用 FastMoss 返回的公开商务邮箱，或达人主页上公开的商务入口。
- 没有返回公开商务联系方式，就写"没有公开商务联系方式"。不猜邮箱，不用非公开渠道。

## 8. 输出模板

```
## 结论
推荐合作 N 人，首批联系 X 人（头部 a / 腰部 b / 尾部 c）。依据：……（一句话）

## 短名单
| 达人 | 粉丝 | 地区 | 主带品类 | 近期带货 | 粉丝匹配 | 内容风格 | 得分 | 推荐理由 | 风险 | 公开商务联系 |
|---|---|---|---|---|---|---|---|---|---|---|

## 分层与合作方式
（每层人数、粉丝阈值、合作方式）

## 评分说明
（权重、阈值、数据来源和时间范围；缺数据的维度）

## 已剔除
（候选名、剔除原因）

## 待确认
- 最终联系哪些达人
- 佣金和费用条件

## 建议下一步
- 选定达人后，用 tiktok-creator-outreach 写建联草稿
- 寄样后，用 tiktok-sample-brief 写内容简报
```

## 9. 人工确认点

1. 深查 FastMoss 前，确认是否继续（说明会消耗额度）。
2. 最终联系谁由用户决定。
3. 评分权重和分层阈值可由用户调整。

## 10. 合规

- 达人数据来自第三方统计，不是官方结论。写明数据来源和时间范围。
- 发现疑似刷量、买粉或数据异常的达人，只写"数据异常，需人工核查"，不下指控性结论。
- 建议合作时，要求达人按 TikTok 当前规则披露广告合作。

## 11. 异常处理

- 搜索结果为空：换关键词，或改用上一级类目重搜一次。仍为空就写"没有数据"，不要编造达人。
- 调用失败或额度不足：保留已经拿到的结果，说明缺口和已完成的步骤。
- 数据不完整：只列出有的指标，缺的写"没有数据"。
- 工具参数名以连接后实际返回的 schema 为准。
