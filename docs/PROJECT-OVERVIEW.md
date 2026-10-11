# UniEarn 项目总览

> 本文是 `dialling/uniearn` 的架构与业务规则归纳，面向接手代码的人。
> 文中所有结论来自仓库内实际代码；无法从代码确认的部分会明确标注。
> 生成时间：2026-10-11 · 对应版本 `0.9.20`

---

## 1. 一句话定位

XJTLU 校园内的「顺路帮拿」平台：同学发布 **代取快递 / 代拿外卖 / 其他任务**，校园帮手（Runner）顺路接单、取件、送达并拍照留证，双方确认后结算。中英双语，微信小程序 + 微信云开发。

当前只开放 **XJTLU SIP 校区**；云函数里对 `universityId === 'xjtlu' && campusId === 'sip'` 做了硬校验，太仓校区只记录意向、不开放下单接单。

---

## 2. 技术架构

```
微信小程序（原生 WXML/WXSS/JS）
   │  app.js → utils/cloud（wx.cloud.init）+ utils/store（本地状态）+ utils/orders（轮询）
   ▼
云函数（wx-server-sdk）
   ├── orderService            订单/行程/奖励的单一写入口（事务 + 幂等）
   ├── studentAccount          账户、学生认证、邮箱验证码、微信手机号
   ├── parseParcelScreenshot   快递截图 → 包裹字段（腾讯云 OCR）
   └── parseSmsScreenshot      短信截图 → 取件码候选（腾讯云 OCR）
   ▼
云数据库 / 云存储
   ├── uniearn_order_state     单文档 team-test，全局订单与行程状态
   ├── uniearn_accounts        每账户一文档
   ├── uniearn_ocr_limits      OCR 频控计数
   └── 云存储 order-photos/ · ocr-temp/ · sms-temp/
```

关键设计：**客户端不直接写数据库**。所有状态变更都走 `orderService` 一个云函数，在 `db.runTransaction` 里读取 `uniearn_order_state/team-test` 这一份文档、执行动作、再整体写回，并用 `revision` 递增做版本标记。这样并发接单、拆分订单、幂等重试都是原子的。

---

## 3. 目录职责

| 路径 | 职责 |
| --- | --- |
| `app.js` / `app.json` / `app.wxss` | 小程序入口、页面注册与全局样式；`app.json` 声明 26 个页面和 3 个全局组件 |
| `sitemap.json` | 微信搜索索引配置 |
| `project.config.json` | 微信开发者工具项目配置。`miniprogramRoot: "./"`、`cloudfunctionRoot: "cloudfunctions/"`、AppID `wxf6d43df037493a8c`、基础库 3.7.0 |
| `assets/` | 52 个图标与插画（SVG 为主，少数 PNG） |
| `components/nav/` | 底部导航栏 |
| `components/yuni/` | 「云宝」轻提示 |
| `components/yuni-assistant/` | 「云宝」助手浮层 |
| `cloudfunctions/orderService/` | 核心业务：订单、行程、奖励、聊天、支持工单 |
| `cloudfunctions/studentAccount/` | 账户与学生认证 |
| `cloudfunctions/parseParcelScreenshot/` | 快递截图 OCR |
| `cloudfunctions/parseSmsScreenshot/` | 短信截图 OCR |
| `scripts/check.js` | 全仓 JS/JSON 语法检查，然后依次执行 `tests/*.test.js` |
| `tests/` | 回归测试，无测试框架，`node` 直跑 |
| `docs/` | 本文档、版本更新说明、自检原始输出 |
| `pages/` | ⚠️ **仓库缺失** —— `app.json` 声明的 26 个页面 |
| `utils/` | ⚠️ **仓库缺失** —— 客户端共享模块 |

> 小程序根目录就是仓库根目录，因此 `app.*`、`assets/`、`components/`、`pages/`、`utils/` 必须在顶层，不能收进 `src/`。`project.config.json` 的 `packOptions.ignore` 已把 `tests/`、`scripts/` 及所有 `.md` / `.txt` 排除出小程序包。

### orderService 内部模块

| 文件 | 职责 |
| --- | --- |
| `index.js` | 云函数入口。取 `OPENID` → 算 `actor` → 跑事务 → 补照片临时链接 |
| `engine.js` | 动作分发（`execute`）与可见性投影（`snapshot`） |
| `domain.js` | 订单/行程的数据操作：创建、指派、取件、送达、确认、取消、部分接单 |
| `workflow.js` | 业务规则与展示层：费用、时限、路线匹配、状态文案、时间格式化（中国时区） |
| `catalog.js` | 包裹尺寸目录与分类/规格文案 |
| `rewards.js` | 优惠券、周奖金、高峰加价、邀请奖励、结算 |
| `promotions.js` | **运营配置**：活动、优惠券、周奖、高峰、公告（改这里后重新部署） |
| `runner-level.js` | Runner 等级、额度与暂停判定 |
| `initial-state.json` | 数据库初始文档，部署时导入 |

---

## 4. 云函数接口

### 4.1 orderService

入口签名：`exports.main(event)`。`event.action` 缺省为 `sync`（只读）。

**公共前置校验**（`index.js` + `engine.js`）

- 必须在微信内调用（有 `OPENID`），否则 `Open this mini program in WeChat to continue.`
- 请求体 JSON ≤ 18000 字符
- 数据库必须已存在 `uniearn_order_state/team-test`，否则提示先按部署说明创建
- 除 `sync` / `prepareUpload` 外的动作必须带 `operationId`（`^[a-zA-Z0-9_-]{12,100}$`）
- 除 `sync` / `prepareUpload` 外的动作要求账户已保存资料且未登出

**幂等**：`receipts` 以 `actor + '_' + operationId` 为键，存 `{value, signature, at}`，`signature` 是去掉 `operationId` 后整份事件的 sha256。同一 `operationId` 重复提交且内容一致 → 直接返回上次结果；内容不一致 → `Operation ID was reused.`。回执 **24 小时**后清理。

**动作清单**

| 分类 | action | 说明 |
| --- | --- | --- |
| 读 | `sync` | 只读，返回投影后的快照 |
| 上传 | `prepareUpload` | 返回 `order-photos/<actorHash>/<32hex>.jpg` 上传路径 |
| 发布 | `create` | 发布快递 / 外卖 / 任务；带 `tripId` 时同时加入该行程 |
| 接单 | `accept` | 整单接取（同路线多单） |
| 接单 | `acceptBoxes` | 按件接取，可拆分订单 |
| 行程 | `startTrip` | 开一条行程并按路线自动拼单；`selfRequestId` 表示自己去取 |
| 行程 | `leave` / `endEmpty` | 开始配送 / 空手结束 |
| 履约 | `pickup` | 取件（快递可带 `index` 逐件取） |
| 履约 | `deliver` | 送达 + 必传照片（外卖还需 `sealChecked`） |
| 履约 | `taskDone` | 任务完成：照片 + 3~500 字说明 |
| 履约 | `sealBroken` | 取件时发现外卖封签已破 |
| 履约 | `runnerCancel` | 帮手取消，带原因，影响信用 |
| 顾客 | `raise` | 加价 ¥1 或 ¥2 |
| 顾客 | `cancel` | 取消未接单订单（模拟退款） |
| 顾客 | `confirm` | 确认收货 |
| 顾客 | `report` | 报问题（照片/说明按原因必填） |
| 顾客 | `riderPhoto` | 标记「餐已到」并上传照片 |
| 顾客 | `foodLate` | 外卖晚到，改一次 ETA（≤30 分钟） |
| 奖励 | `collectCoupon` / `rewardsInit` / `invite` | 领券 / 初始化 / 填邀请码 |
| 其他 | `preferences` | 通知偏好、考试周免打扰（7 天） |
| 其他 | `message` / `readMessages` | 订单内聊天 |
| 其他 | `supportRequest` | 支持工单（order/payment/other/deletion） |
| 审核 | `resolveDispute` | 仅审核人（`REVIEWER_OPENIDS`）可调用 |

**Runner 动作门禁**（`accept` `acceptBoxes` `startTrip` `pickup` `deliver` `runnerCancel` `leave` `endEmpty` `taskDone` `sealBroken`）

1. 学生认证通过（`verification.status === 'verified'`）
2. 已接受帮手规则（`runnerRulesAcceptedAt`）
3. 姓名 ≥ 2 字且手机号为中国大陆号码
4. 未被信用暂停

**容量上限**：订单 ≤ 200 条、行程 ≤ 200 条、单文档 ≤ 850 KB。照片通过 `cloud.getTempFileURL` 下发的临时链接有效 **600 秒**，只下发当前快照中真正可见的照片。

### 4.2 studentAccount

| action | 说明 |
| --- | --- |
| `wechatLogin` | 用微信手机号授权码换手机号；仅接受中国大陆号；写入 `profile`、`loggedOut: false`、`authRevision+1` |
| `sendEmailCode` / `checkEmailCode` / `agreeRules` | 邮箱验证码与规则同意（转 `email.js`） |
| 其余 | 转 `handler.js` 的学生卡扫描流程 |

- 集合 `uniearn_accounts`，文档 ID = `sha256(openid)`
- 字段：`profile`、`verification`、`authRevision`、`scanLock`、`loggedOut`
- 并发控制：`authRevision` 乐观锁；`claimScan` / `releaseScan` 用 **65 秒**租约防同一账户并发扫描；写 `scanLock` 时整体 `set` 而不做子字段更新（代码里有注释说明原因）
- `config.json` 声明了 `phonenumber.getPhoneNumber` 权限
- 依赖：`wx-server-sdk`、`tencentcloud-sdk-nodejs-ocr`、`nodemailer`

### 4.3 parseParcelScreenshot / parseSmsScreenshot

两个 OCR 云函数结构几乎相同，用 `parseSmsScreenshot` 举例：

1. `action === 'prepareUpload'` → 返回 `sms-temp/<actorHash>/<32hex>.jpg`
2. 否则要求 `fileID` 落在 **调用者自己的目录前缀**下且文件名是 32 位 hex + `.jpg`，否则 `Invalid screenshot location.`
3. 频控：同一账户 **5 秒一次**、**每天 100 次**，记在 `uniearn_ocr_limits`
4. 下载文件，大小上限 **6 MB**
5. 调腾讯云 `GeneralBasicOCR`（`LanguageType: 'zh'`，区域默认 `ap-shanghai`）
6. `parseSmsScreenshot` 会合并 SMS 解析与包裹解析的候选取件码，随后在 `finally` 里删除临时文件

> `parseParcelScreenshot/pickup-point.js` 与 `parseSmsScreenshot/pickup-point.js`、以及两边的 `parser.js` / `parcel-parser.js` 是**逐字节相同**的副本。微信云函数各自独立部署、不能互相 require，所以这是有意的重复，不是 bug；改动时记得两处同步。

---

## 5. 订单状态机

```
                    ┌──────────── cancel（顾客，仅未接单）──────────► cancelled
                    │
waiting ──accept──► taken ──pickup──► collected ──deliver──► delivered ──confirm──► confirmed
   │                  │                                          │
   │                  └──runnerCancel / 行程取消──► waiting      └──report──► disputed
   │                                                              （结算暂停）
   └──closesAt 到期、无人接──► refunded（模拟退款）
```

- `taken → collected`：所有取件码都取完（`collect`）才转 `collected`
- `collected → delivered`：必须带送达照片；外卖必须确认封签
- `delivered → confirmed`：顾客手动确认，或超时自动确认——
  **快递 48 小时 / 外卖 1 小时 / 任务 24 小时**
- `disputed` 由审核人用 `resolveDispute` 裁决：`release` 转 `confirmed`，`refund` 退款并可记 Runner 扣款（`adjustments`）

行程（Trip）另有自己的相位：`collect → deliver → done`，取消时置 `cancelled`。

---

## 6. 业务规则速查

### 价格与费用

包裹尺寸目录（`catalog.js`）：

| 尺寸 | 价格 | 重量 | 单次上限 |
| --- | --- | --- | --- |
| Small | ¥3 | < 1 kg | 3 |
| Medium | ¥4 | 1 ~ <3 kg | 3 |
| Large | ¥5 | 3 ~ <10 kg | 1 |
| Extra large | ¥10 | 10–20 kg | 1 |

- **服务费**：快递 ¥0.5/件；外卖固定 ¥0.5
- **合计** = 悬赏 + 服务费 − 优惠券抵扣
- 快递可按件计价（最多 5 件，每件一个取件码），悬赏 = 各件价格之和 + 小费（小费 0~3 元，按件均摊）
- 不按件时：每件单价下限快递 ¥2、外卖 ¥3；快递 ≤3 件且大件只能 1 件；外卖 ≤5 袋
- 任务：单个任务，价格即悬赏，服务费 ¥0.5

### 时限

| 场景 | 规则 |
| --- | --- |
| 外卖到达 | 送达时间 = 到达后 30 分钟；截止与关闭同步 |
| 外卖改 ETA | 只能改一次、最多推后 30 分钟，且须在原 ETA+10 分钟内操作 |
| 无人接单 | `closesAt` 到期自动转退款 |
| 自动确认 | 快递 48h / 外卖 1h / 任务 24h |
| 外卖报问题 | 送达后 30 分钟内 |
| 订单聊天 | 送达后 24 小时关闭，最多 100 条、单条 ≤500 字 |
| 支持工单 | 每天最多 10 条，保留最近 50 条 |

### 行程（Trip）

- 类型 `parcel` / `takeout`；出发「现在」或「稍后」
- 稍后出发：可选 5 / 10 / 15 分钟时长，或指定时间（须晚于当前 10 分钟以上）
- 容量 1~12（外卖行程最多 5 袋）
- 加入截止 = 出发前 10 分钟；提醒 = 出发前 15 分钟
- 外卖拼单要求所有到达时间**相差不超过 15 分钟**
- 拼单按 站点 + 楼栋 + 分类 + 目的地 匹配，且受 Runner 额度限制
- 帮手取消仅限**未取件**的订单；取消原因 `missing` / `quantity` / `personal` / `mismatch`
  - 外卖「没拿到餐」须等到达后 10 分钟
  - 外卖「个人原因」在 ETA 被改过之后不允许；且须在到达前 15 分钟以上
  - 任务单只有 `mismatch` 不算信用标记

### Runner 等级与信用

依据：近 **14 天**内的标记数、累计完成单数、准时率。

| 等级 | 条件 | 额度 |
| --- | --- | --- |
| Top | ≥40 单、准时率 ≥95%、无标记 | 不限 |
| Trusted | ≥10 单、≤1 个标记 | ¥25 |
| New | 其他 | ¥10 |

**暂停**：14 天内 ≥5 个标记 → 从最后一个标记起暂停 **7 天**。额度同时限制单条订单与整条行程的悬赏总额。

### 优惠券与奖金

运营配置集中在 `promotions.js`（**改完要重新部署 orderService**）：

- `golden2026`：国庆 1–7 日 18:00–20:00 免配送费（上限 ¥8），每晚前 30 单
- `welcome-free`：新用户免配送费（上限 ¥8，7 天，自动发放）
- `welcome-two`：¥2 无门槛券（30 天，自动发放）
- `return2026`：上月下过单的老用户 ¥1 × 3 张

其他奖励：

- **周奖**：每周（周一起算，中国时区）完成 5 单 → ¥5
- **高峰加价**：北门 11:30–13:00 接的外卖单 +¥1
- **邀请**：邀请码 = 账户 ID 前 12 位；被邀请人须尚未下过单；首单确认后双方各得一张免配送费券
- 抵扣金额 = `min(券上限, 券类型为配送费 ? 悬赏 : 悬赏 + 服务费)`

---

## 7. 数据模型

**`uniearn_order_state/team-test`**（单文档，全局状态）

```jsonc
{
  "nextId": 1,          // 自增 ID，订单 r*、行程 t*、消息 m*、工单 support-*、扣款 a*
  "requests": [],       // 订单
  "trips": [],          // 行程
  "members": {},        // 按 actor 的优惠券、标记、偏好、工单、周奖记录
  "receipts": {},       // 幂等回执，24h 过期
  "revision": 0,        // 每次写入 +1
  "threads": {},        // 订单聊天线程
  "adjustments": []     // 审核扣款记录
}
```

初始化用 `cloudfunctions/orderService/initial-state.json`。

**`uniearn_accounts/<sha256(openid)>`** —— `profile`、`verification`、`authRevision`、`scanLock`、`loggedOut`

**`uniearn_ocr_limits/<sha256(openid)>`** —— `lastAt`、`day`、`count`

**云存储**：`order-photos/<actorHash>/`、`ocr-temp/<actorHash>/`、`sms-temp/<actorHash>/`

> 身份口径：`actor = sha256(openid)`。数据库里不存明文 `openid`。

---

## 8. 部署与配置

### 云函数环境变量

| 变量 | 用途 |
| --- | --- |
| `TENCENT_SECRET_ID` / `TENCENT_SECRET_KEY` | 腾讯云 OCR 密钥（缺失时 OCR 直接报未配置） |
| `TENCENT_OCR_REGION` | OCR 区域，默认 `ap-shanghai` |
| `REVIEWER_OPENIDS` | 逗号分隔的审核人 `openid`，拥有 `resolveDispute` 权限 |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | 学生邮箱验证码发信 |

### 步骤

1. 微信开发者工具导入本项目，填自己的 AppID，开通云开发环境
2. 建三个集合：`uniearn_order_state`、`uniearn_accounts`、`uniearn_ocr_limits`
3. 在 `uniearn_order_state` 里新建文档 `team-test`，内容用 `cloudfunctions/orderService/initial-state.json`
4. 部署 4 个云函数，选「上传并部署：云端安装依赖」
   - `wx-server-sdk ~3.0.1`
   - `tencentcloud-sdk-nodejs-ocr ^4.0.345`（三个函数）
   - `nodemailer ^7.0.0`（studentAccount）
5. 给需要 OCR / 发信的云函数配上表里的环境变量
6. 确认 `studentAccount` 的 `config.json` 权限已随部署生效（微信手机号）

---

## 9. 测试现状

`npm test` → `node scripts/check.js`：先遍历全仓做 JS 语法检查与 JSON 解析，再按文件名顺序 `node` 执行每个 `tests/*.test.js`。

仓库现有 **10 个** 测试文件：

| 文件 | 覆盖 |
| --- | --- |
| `dorm-profile.test.js` | 宿舍资料同步、认证与手机号来源、登出与不完整保存 |
| `bilingual-hall.test.js` | 中英切换、动态姓名、单复数、空/筛选空状态、引导返回高亮 |
| `categories.test.js` | 分类与规格 |
| `cloud.test.js` | 云初始化顺序、OCR 与账户调用 |
| `domain.test.js` | 领域流程 |
| `final-english.test.js` | 英文规则总检（证明与 24h 结算、隐私、等级、拼单、中国时区） |
| `guide-replay.test.js` | 新手引导回放 |
| `help-template.test.js` | 帮助页模板绑定 |
| `jobs-navigation.test.js` | 任务大厅归属/新鲜度、导航与订单状态 |
| `jobs-selection.test.js` | 大厅展开选择、金额统计、自己发布的单不可接 |

**当前只有 `dorm-profile.test.js` 能加载**（它只依赖已存在的 `cloudfunctions/studentAccount/handler.js`）。另外 9 个都因为 `utils/`、`pages/` 缺失而在 `require` 阶段就 `MODULE_NOT_FOUND`。

`docs/SELF-CHECK.txt` 是一次完整自检的原始输出，记录了 **114 个 JS / 40 个 JSON** 和更多测试（例如 `tests/read-coupons.test.js`），说明原始工程比本仓库大不少。

---

## 10. 当前缺口与补齐步骤

### 缺口 A：`pages/`（26 个页面）

`app.json` 声明但仓库中不存在：

```
welcome  campus  jobs  requests  create  earnings  profile  request  trip  join
job  student-check  sms-scan  takeaway  trip-start  rewards  posted  chat  info
task-post  task  public-job  routes  guide  help  route-edit
```

每个页面应为 `pages/<名字>/index.{js,json,wxml,wxss}`。

### 缺口 B：`utils/`（11 个客户端共享模块）

被 `app.js` 和测试引用但仓库中不存在：

```
store  cloud  account  orders  domain  catalog  ocr  workflow  runner-level
help-copy  onboarding
```

注意 `utils/domain.js`、`utils/catalog.js`、`utils/workflow.js`、`utils/runner-level.js` 与 `cloudfunctions/orderService/` 下的同名文件是**两份不同的代码**（客户端版 + 云端版），不能互相替代。

### 补齐方式

用 GitHub 网页上传时，务必**把整个文件夹拖进去**（分次上传单个文件最容易漏目录）。更稳的方式是在原始工程目录里：

```sh
git add pages utils
git commit -m "补传 pages/ 与 utils/"
git push
```

补齐后 `npm test` 应打印 `Syntax checked: 114 JS files, 40 JSON files`（或更多）并跑完所有测试。若数字对不上，说明仍有遗漏。

### 本次整理顺带处理的事

- 新增 `docs/`，把原先散在根目录的 `UPDATE-CN.md`、`SELF-CHECK.txt` 移入（用 `git mv`，保留历史）
- 重写根 `README.md`：原文写的是「仓库尚无内容」的占位说明，已替换为真实的项目说明 + 当前状态
- 从版本控制中移除 `project.private.config.json`：它已在 `.gitignore` 里，是微信开发者工具的本地配置，不该提交（本地文件保留）

### 已知小问题（未改）

- `project.config.json` 声明基础库 `3.7.0`，本地 `project.private.config.json` 是 `3.17.3`，不一致
- `parseParcelScreenshot` 与 `parseSmsScreenshot` 存在逐字节相同的副本文件（见 4.3，属有意重复）
- 代码中的「退款」「扣款」均为演示逻辑（`demo refund`、`simulated refund`），未接入真实支付；也未接入微信订阅消息
