---
name: tiktok-gmv-max-diagnosis
description: Diagnoses a TikTok GMV Max campaign from the user's exported CSV report by detecting and confirming columns first, then checking ROI against break-even ROI (1 / gross margin), ranking products into scale, hold, adjust, or pause actions, and comparing creative direction with FastMoss (or Kalodata) peer ad data.
---

# GMV Max 投放诊断

> **TikTok 数据来源**：下文写的是 FastMoss 工具。`silkroad_status` 显示 FastMoss 没连上、Kalodata 为 `configured` 时，改用 Kalodata：按 `kalodata-data` 技能第 5 节的对照把每一步换成 `silkroad_kalodata_*` 工具，费用控制和口径照那个技能；Kalodata 没有对应的数据写"没有数据（Kalodata 不提供）"。两个都连上时默认用 FastMoss，用户指定时听用户的；两个都没有时才按本技能的降级方式处理。

目标：判断钱花得值不值，哪些商品该加预算、维持、调目标或暂停，ROI 目标设得合不合理。结论放最前，商品分层表紧随其后。

所有预算和 ROI 目标的调整都由用户在 TikTok Ads Manager 里自己操作。本 skill 只给建议。

## 0. 先确认输入

- 报表：用户从 Seller Center 或 Ads Manager 导出的 CSV，按天或按商品。如果用户没给路径，先看 `~/SilkRoad/reports/input/` 下有哪些文件，让用户选。
- 站点和币种。用户没说就问。
- 毛利率（必需，用于盈亏平衡）：用户给出，或从定价测算里沿用。没有就问，不要猜。
- 目标 ROI、诊断时间范围、关注的商品（都可选）。

## 1. 读取报表并识别列

1. 用 Read 工具读取 CSV 的表头和前几行。不要整文件加载到对话里。
2. 按下表找对应列。列名可能是中文、英文或两者混合，导出版本不同，名字也会变。

| 含义 | 常见列名（示例） |
|---|---|
| 日期 | 日期、Date、Stat time day |
| 商品 | 商品名称、Product name、商品 ID、Product ID |
| 花费 | 花费、Cost、Spend、广告花费 |
| 广告 GMV | GMV、Gross revenue、成交金额、销售额 |
| 订单 | 订单数、Orders、SKU orders |
| ROI | ROI、ROAS、投资回报率 |
| 展示 / 点击 / 转化 | Impressions、Clicks、CTR、CVR |

3. 输出一张"列映射表"：标准字段、报表原列名、置信度（确定 / 不确定）、备注。
4. 下列情况属于不确定，必须先请用户确认，确认之前不做结论：
   - 有多个 GMV 类列（总 GMV、直播 GMV、视频 GMV），不知道用哪个。
   - 花费是否含税、是否为本地币种，或币种不明确。
   - ROI 列与 GMV ÷ 花费 对不上。
   - 日期格式或时区不明确。
5. 报表里没有 ROI 列时，用 GMV ÷ 花费 计算，并标注为"计算得出"。

## 2. 核心公式

- ROI = 广告 GMV ÷ 花费（除非报表另有定义，按列映射表的口径）。
- 盈亏平衡 ROI = 1 ÷ 毛利率（毛利率用小数）。例如毛利率 35%，盈亏平衡 ROI ≈ 2.86。
- 公式前提：毛利率是按同一口径（售价、商品成本、退款之后）算出的。如果还想扣掉平台佣金、达人佣金、履约费，把这些比例从毛利率里一起扣掉后再算：盈亏平衡 ROI = 1 ÷ (毛利率 − 其他费率合计)，并标注"扣费后口径"。

## 3. 整体表现

1. 总花费、广告 GMV、ROI、订单数，按周或按时间段看趋势。
2. ROI 与盈亏平衡 ROI 对比，写明是高于、接近还是低于。
3. 结论只回答两个问题：整体是否盈利；ROI 目标是否合理（目标低于盈亏平衡，说明目标会亏钱）。

## 4. 按商品分层

对每个商品计算花费、GMV、ROI、订单数，然后分层。以下阈值是启发式，用户可改：

| 层级 | 条件（默认） | 建议动作 |
|---|---|---|
| 加预算 | ROI 明显高于盈亏平衡，且近期订单数足够（默认 ≥ 10 单） | 加预算 |
| 维持 | ROI 高于盈亏平衡，但量不大或波动大 | 维持，观察 |
| 调 ROI 目标 | 有量但 ROI 低于盈亏平衡，或 ROI 目标偏离实际 | 调目标 |
| 补素材 | 花费少、展示或点击低，样本不足 | 补素材 |
| 暂停 | 花费高、ROI 长期低于盈亏平衡，且素材已尝试过 | 暂停 |

样本不足的商品，不要按 ROI 直接判断，写明"样本不足，不作结论"。

## 5. 外部参照（FastMoss，用于素材方向）

只为素材方向提供参考，不用于判断自己的 ROI。

1. `mcp__fastmoss__product_investment`：同类或同款竞品的广告投入和 ROAS，看投放强度。
2. `mcp__fastmoss__ad_search`：按商品或类目找在投素材，看形式、时长和卖点表达。
3. `mcp__fastmoss__ad_data_overview`：对具体视频看花费、ROAS 和播放的走势。
4. 参照结果只写"同类做法"。不建议照搬对方的画面、文案或视频。

如果 FastMoss 未连接，告诉用户在左侧栏「跨境电商」面板的「数据源」连接。第 1 到 4 节仍然可以做，第 5 节写明缺失。

## 6. 输出模板

```
## 结论
一句话：整体 ROI x.xx，盈亏平衡 ROI y.yy，目前 [盈利 / 亏损 / 接近盈亏平衡]；ROI 目标 [合理 / 偏低 / 偏高]。

## 报表信息
文件名、时间范围、列映射表（标注不确定项和用户确认结果）。

## 整体表现
| 指标 | 数值 | 来源 / 时间范围 |
|---|---|---|
| 花费 | | 报表 / ... |
| 广告 GMV | | |
| ROI | | 报表或计算得出 |
| 盈亏平衡 ROI | | 1 ÷ 毛利率（毛利率由用户提供） |

## 商品分层
| 商品 | 花费 | GMV | ROI | 盈亏平衡 ROI | 建议动作 | 理由 |
|---|---|---|---|---|---|---|

## 素材建议
- 缺什么素材：...
- 可参考的同类做法（FastMoss，标注时间）：...
```

### 保存报告

在会话里给出完整报告后，再用 Write 工具把同样的 Markdown 保存到 `~/SilkRoad/reports/gmv-max-<今天日期>.md`（`~` 换成用户主目录的绝对路径，日期用 YYYY-MM-DD，文件名里的空格和斜杠换成 `-`，目录不存在就先创建）。保存后告诉用户文件路径；用户可以在 SilkRoad 面板的「报表」或右侧边栏的「SilkRoad 报告」里查看。用户说不需要保存时就不保存。

## 7. 人工确认点

- 开始前确认：报表路径、币种、毛利率、ROI 口径。
- 列映射有不确定项时，先展示列映射表，等用户确认。
- 所有预算和 ROI 目标调整，由用户在 Ads Manager 里自己操作。本 skill 不做任何修改。
- 分层阈值由用户决定是否修改。

## 8. 失败与降级

- 报表打不开或表头不完整：说明缺哪些字段，请用户重新导出。
- 没有毛利率：只做 ROI 趋势和商品排序，不给盈亏结论。
- 没有 FastMoss：只做第 1 到 4 节，素材建议改为"需要用户补充"。

## 9. 边界

- 只读报表，不连接 Ads Manager，不改投放。
- 不用估算的花费或 GMV 替代报表原始数据。
- 不替用户定毛利率或目标 ROI。
