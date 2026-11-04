---
name: tiktok-weekly-report
description: Sets up and runs a recurring weekly TikTok Shop report as a DSH scheduled task (last week versus the week before, watched competitors, pending buyer messages and returns, three actions), saved as Markdown under ~/SilkRoad/reports, after confirming time, time zone and content with the user.
---

# 每周自动报表（TikTok Shop）

> **TikTok 数据来源**：下文写的是 FastMoss 工具。`silkroad_status` 显示 FastMoss 没连上、Kalodata 为 `configured` 时，改用 Kalodata：按 `kalodata-data` 技能第 5 节的对照把每一步换成 `silkroad_kalodata_*` 工具，费用控制和口径照那个技能；Kalodata 没有对应的数据写"没有数据（Kalodata 不提供）"。两个都连上时默认用 FastMoss，用户指定时听用户的；两个都没有时才按本技能的降级方式处理。

目标：让卖家每周一早上拿到一份上周经营报告，不用每次手动提问。本 skill 有两部分：设置定时任务，以及每次触发时生成报告。

## 第一部分：设置定时任务

### 1. 收集设置并确认

逐项问清楚，并一次性向用户确认：

| 项目 | 默认值 | 说明 |
|---|---|---|
| 店铺 | 无，必需 | 用 `silkroad_tts_shops` 列出，多店时让用户选 |
| 时区 | Asia/Shanghai | 按店铺站点或用户所在地确认 |
| 时间 | 周一 09:00 | 本地时间 |
| 报告内容 | 经营诊断摘要、竞品动态、待处理客服和退货 | 用户可增减 |
| 关注的竞品 | 可选 | 最多 3 个，给名称或 seller_id |

在创建之前，明确告诉用户以下内容并请其确认：
- 每周几、几点、哪个时区运行。
- 报告包含哪几部分。
- 报告保存到 `~/SilkRoad/reports/`。
- 运行限制：DeepSeek Harness 需要在运行（Desktop 打开）时才能按时生成。错过的运行会在下次启动时补做一次。

### 2. 创建任务

调用 `schedule_create`：
- `title`：不超过 120 个字符，例如"每周 TikTok 店铺报告"。
- `prompt`：写清楚"按 tiktok-weekly-report skill 生成上周报告"，并写明店铺（名称和 ID）、竞品列表、时区和保存位置。
- 选择器：只能用一个。周报使用：
  `{"weekly":{"time":"09:00:00","time_zone":"Asia/Shanghai","weekdays":[1]}}`
  其中 `weekdays` 用 ISO 编号，周一为 1，周日为 7。按用户设定替换 `time` 和 `time_zone`。

### 3. 确认和管理

- 创建后调用 `schedule_list`，确认任务已存在，并把任务 ID 和下次运行时间告诉用户。
- 修改用 `schedule_update`（传任务 ID 和要改的字段）。
- 取消用 `schedule_delete`（传任务 ID），取消前先让用户确认。

## 第二部分：每次触发时生成报告

提醒会作为一条后续消息进入同一个会话。收到后按下面步骤做。

### 1. 检查数据源

调用 `silkroad_status`。如果有数据源掉线，在报告开头写明是哪一个，并提示用户在左侧栏「跨境电商」面板的「数据源」重新登录。掉线的部分写"没有数据"，其他部分照常生成。

### 2. 确定周期

- 周期为上周一至上周日，按设定时区计算。
- 文件名中的日期使用**上周一**的日期，例如 `weekly-2026-10-26.md`（当天为 2026-11-02 周一时）。
- 对比对象为上上周一至上上周日。

### 3. 经营摘要

- 调用 `silkroad_tts_orders`，按 `create_time_ge` 和 `create_time_lt` 分页取两周订单（`page_size` 100，用 `next_page_token` 翻页）。计算 GMV、订单数、件数、客单价、动销商品数，排除 UNPAID 和 CANCELLED。
- 退款率用 `silkroad_tts_returns` 同一窗口的退货数据计算，写明口径。
- 只给关键变化和前 3 个变化最大的商品，细节放在完整诊断里。每个数字都标注来源和时间范围。

### 4. 竞品动态（如果有设定）

对每个关注的竞品：
- `mcp__fastmoss__shop_data_trends`：近一周 GMV 相对前一周的变化。
- `mcp__fastmoss__shop_product_analysis`：本周是否出现新的爆品。
- `mcp__fastmoss__shop_investment_analysis` 或 `mcp__fastmoss__ad_search`：广告投入或新素材的明显变化。
- `mcp__fastmoss__shop_creator_analysis`：新合作达人的数量变化。

只写"变化"，不写完整画像。FastMoss 未连接时，这一节写明"没有数据"。

### 5. 待处理事项（有店铺授权时）

- `silkroad_tts_messages`：列出最近会话，统计未回复的买家会话数（写明统计的时间范围）。这是只读工具，本 skill 不回复买家。
- `silkroad_tts_returns`，`return_status` 取待处理的状态（例如 RETURN_OR_REFUND_REQUEST_PENDING）：待处理退货数量和金额。

### 6. 本周建议的 3 个动作

按影响排序，每条写明证据（来自上面哪一节）、负责角色（选品、Listing、定价、投放、达人、客服）和建议动作。涉及改价、下架、加预算的，写成建议，由用户决定。

### 7. 保存报告

使用 Write 工具保存到 `~/SilkRoad/reports/weekly-<上周一日期>.md`。`~` 请替换为用户主目录的绝对路径。如果目录不存在，先创建。

Markdown 结构：

```
# TikTok 店铺周报（YYYY-MM-DD 至 YYYY-MM-DD，时区 ...）

## 结论
一句话。

## 数据源状态
（掉线的数据源，或"全部正常"）

## 1. 经营摘要
| 指标 | 上周 | 前一周 | 变化 | 来源 |
|---|---|---|---|---|

## 2. 竞品动态
## 3. 待处理事项
## 4. 本周 3 个动作
| 序号 | 动作 | 证据 | 负责角色 | 需要用户决定 |
|---|---|---|---|---|
```

### 8. 会话内回复

在会话里给出一段摘要（结论和 3 个动作），并附上文件的绝对路径。

## 人工确认点

- 创建或修改定时任务之前，必须确认时间、时区和报告内容。
- 报告只读数据，不执行任何操作：不回复买家，不改商品、价格或广告。
- 任何改价、下架、加预算的建议，都由用户自己决定。

## 失败与降级

- 任务已创建但某天没有运行：先检查 Desktop 是否在运行，并调用 `schedule_list` 查看状态。
- 订单接口失败：报告中写明失败的时间段和店铺，不用估算替代。
- 保存失败：在会话里直接给出完整报告内容，并说明保存失败的原因。
