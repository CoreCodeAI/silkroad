---
name: silkroad-setup
description: Check and connect SilkRoad's cross-border e-commerce data sources (FastMoss or Kalodata for TikTok Shop data, SerpApi, AnySearch). Use when the user starts using SilkRoad, asks what data is available, or a task fails because a data source is not connected.
---

# SilkRoad 数据源配置

SilkRoad 不内置任何数据权限。每个数据源都由用户用自己的账号登录，或者填写自己的 API key。你的任务是帮用户看清现在连上了什么、缺什么，并引导他们完成连接。

## 先查状态

调用 `silkroad_status`。不要凭印象回答"连上了没有"。

返回里有两类数据源：

- `connectors`：要在浏览器里登录的数据源（OAuth），比如 FastMoss。
  - `connected`：可以用了。它的工具名都以 `toolPrefix` 开头，例如 `mcp__fastmoss__`。
  - `disconnected`：还没登录过。
  - `awaiting-browser`：已经打开登录页，在等用户登录完。
  - `expired`：登录过期，需要重新登录。
  - `error`：上次登录失败，看 `error` 字段里的原因。
- `vendors`：填 API key 的数据源，比如 SerpApi、AnySearch、Kalodata。Kalodata 的 Key 在 Kalodata 开放中心「账户管理」里自助生成，按积分计费；它和 FastMoss 都能提供 TikTok 数据，有一个就能做大部分场景，用法见 `kalodata-data` 技能。
  - `configured`：已经有 key。
  - `missing`：缺 key，这个数据源的工具会报错。
  - `anonymous`：没填 key，但可以用免费额度匿名使用。

## 用大白话告诉用户

按下面的格式说明，不要直接贴 JSON：

1. 已经能用的数据源，以及它们能提供什么数据（看 `summary`）。
2. 还没连上的数据源，以及缺了它会影响哪些事情。
3. 下一步怎么做。

缺少某个数据源只影响依赖它的功能，其他功能照常可用。不要因为缺一个数据源就说整个工具不能用。

## 连接 OAuth 数据源（例如 FastMoss）

1. 先问用户是否现在连接，说明会打开浏览器，在数据源自己的网站上登录。
2. 用户同意后调用 `silkroad_connect`，`source` 填数据源 id。
3. 告诉用户在打开的浏览器页面里登录并同意授权，完成后回到这里。
4. 用户说完成了，再调用一次 `silkroad_status` 确认状态是 `connected`。

费用和套餐由数据源自己决定，用户需要有对应平台的账号。不知道某个数据源的价格时，直接说不知道，并建议用户去它的官网查看。

## 配置 API key 数据源

**不要在对话里向用户索要 API key，也不要让用户把 key 粘贴到对话里。**

让用户打开左侧栏的 SilkRoad 面板，在对应数据源下面填写并保存 key。申请 key 的地址在 `signup` 字段里，可以告诉用户。保存之后再调用 `silkroad_status` 确认。

如果用户已经把 key 发在了对话里，提醒他们这个 key 已经出现在聊天记录里，建议去数据源后台作废这个 key，再生成一个新的，然后填到面板里。
