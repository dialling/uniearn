# UniEarn 项目总览

> 本文是 `uniEarn` 的架构与业务规则归纳，面向接手代码的人。
> 文中结论均来自仓库内实际代码；无法从代码确认的部分会明确标注。
> 对应版本 `0.9.20` · 全仓 114 JS / 40 JSON · `npm test` 退出码 0

---

## 1. 一句话定位

XJTLU 校园内的「顺路帮拿」平台：同学发布 **代取快递 / 代拿外卖 / 其他任务**，跑手（Runner）顺路接单、取件、送达并拍照留证，双方确认后结算。中英双语，微信小程序 + 微信云开发。

当前只开放 **XJTLU SIP 校区**；云函数对 `universityId === 'xjtlu' && campusId === 'sip'` 做了硬校验，太仓校区只记录意向、不开放下单接单。

---

## 2. 技术架构

```
微信小程序（原生 WXML/WXSS/JS）
   app.js ─ onLaunch: ensureCloud() + store.get()
          ├ onShow:  account.call('status') + orders.start()   ← 前台每 10s 轮询 sync
          └ onHide:  orders.stop()
   │
   │  utils/orders.js 是唯一的订单出入口：
   │    call() → 云函数 → apply(snapshot) → store 本地缓存 → 通知页面刷新
   ▼
云函数（wx-server-sdk）
   ├── orderService            订单/行程/奖励的单一写入口（事务 + 幂等）
   ├── studentAccount          账户、跑手申请与管理员审核、管理后台、微信手机号
   ├── parseParcelScreenshot   快递截图 → 包裹字段（腾讯云 OCR）
   └── parseSmsScreenshot      短信截图 → 取件码候选（腾讯云 OCR）
   ▼
云数据库 / 云存储
   ├── uniearn_order_state     单文档 team-test，全局订单与行程状态
   ├── uniearn_accounts        每账户一文档
   ├── uniearn_order_archive   完成 8 天后移出主文档的订单
   ├── uniearn_ocr_limits      OCR 频控计数
   └── 云存储 order-photos/ · ocr-temp/ · sms-temp/
```

两个关键设计：

1. **客户端不直接写数据库。** 所有状态变更都走 `orderService`，在 `db.runTransaction` 里读取 `uniearn_order_state/team-test` 一份文档、执行动作、整体写回，并用 `revision` 递增标记版本。并发接单、拆分订单、幂等重试因此都是原子的。
2. **客户端有一份本地缓存，只读不权威。** `utils/store.js` 把快照存进 `wx` 本地存储（键 `uniearn_cloud_cache_v1`），页面全部从缓存渲染；服务端快照到达后覆盖。缓存里的 `cloudRevision` 用来丢弃过期快照。

---

## 3. 目录职责

| 路径 | 职责 |
| --- | --- |
| `app.js` / `app.json` / `app.wxss` | 入口、页面注册（27 个页面 + 3 个全局组件）、全局样式 |
| `sitemap.json` | 微信搜索索引配置 |
| `project.config.json` | 微信开发者工具配置。`miniprogramRoot: "./"`、`cloudfunctionRoot: "cloudfunctions/"`、AppID `wxf6d43df037493a8c`、基础库 3.7.0 |
| `assets/` | 图标、插画与「云宝」吉祥物（`yuni-*.png`，按姿势名动态引用） |
| `components/nav/` | 底部导航栏 |
| `components/yuni/` | 「云宝」轻提示 |
| `components/yuni-assistant/` | 「云宝」助手浮层 |
| `components/lang-switch/` | 每页钩子（不渲染 UI）：显示时设置双语导航标题并应用深浅色；语言切换入口在「我的 → 语言」和欢迎页右上角 |
| `pages/` | 27 个页面，见下表 |
| `utils/` | 38 个客户端共享模块，见第 4 节 |
| `cloudfunctions/orderService/` | 核心业务：订单、行程、奖励、聊天、支持工单 |
| `cloudfunctions/studentAccount/` | 账户、跑手申请与管理员审核、管理后台 |
| `cloudfunctions/parseParcelScreenshot/` | 快递截图 OCR |
| `cloudfunctions/parseSmsScreenshot/` | 短信截图 OCR |
| `scripts/check.js` | 全仓 JS/JSON 语法检查，然后依次执行 `tests/*.test.js` |
| `tests/` | 35 个回归测试 + `helpers/order-cloud.js`，无框架，`node` 直跑 |
| `docs/` | 本文档、版本更新说明、自检原始输出 |

> 小程序根目录就是仓库根目录，因此 `app.*`、`assets/`、`components/`、`pages/`、`utils/` 必须在顶层，不能收进 `src/`。

### 页面清单

| 页面 | 标题 | 主要依赖的 utils | 作用 |
| --- | --- | --- | --- |
| `welcome` | — | account, store, onboarding, orders | 欢迎、微信登录/注册、用户协议与隐私入口 |
| `campus` | — | account, store, onboarding, orders | 学校/校区选择（SIP 开放，太仓记录意向） |
| `guide` | — | app-guide | 新手引导（有单/无单两套内容） |
| `jobs` | — | orders, domain, workflow, ui, runner-level, hall-copy, app-guide, onboarding, saved-routes | 接单大厅：筛选、展开选择、接单入口 |
| `job` | Choose parcels | orders, domain, catalog, account | 按件挑选包裹接单 |
| `requests` / `request` | — | orders, workflow, domain, ui | 我的订单列表 / 订单详情（顾客侧） |
| `posted` | — | store, orders, workflow | 我发布的订单 |
| `public-job` | — | orders, workflow | 公开任务/行程详情 |
| `create` | Post a pick-up | saved-routes, pickup-point, rewards, orders, domain, ocr, catalog, account, image-input, workflow | 发布代取（快递） |
| `takeaway` | Post a pick-up | rewards, saved-routes, account, orders, workflow, ui | 发布外卖代取 |
| `task-post` | — | store, orders, ui, workflow | 发布其他校园任务 |
| `task` | — | orders, workflow, ui | 任务详情与完成 |
| `trip-start` | Start a trip | orders, workflow, ui, account | 开一条行程（站点/楼栋/容量/出发时间） |
| `trip` | Pick up & deliver | orders, domain, workflow, ui, runner-level | 取件与送达主流程 |
| `join` | Join a trip | orders, domain, workflow | 加入别人的行程 |
| `sms-scan` | Read pickup SMS | cloud, pickup-point, ocr | 读短信/截图取件码（另含 `parser.js`） |
| `student-check` | — | store, account, runner-level, china-time | 跑手申请（真实姓名 + 手机号 + 学号），等待管理员审核 |
| `admin` | — | account, china-time | 管理员登录后的后台：订单统计、用户/跑手数、申请审核 |
| `earnings` | — | orders, workflow, domain, catalog, earnings, runner-level | 收益汇总（周收入、单量、等级进度） |
| `rewards` | — | orders, store, ui | 优惠券与活动 |
| `routes` / `route-edit` | Route details | saved-routes, store, account, ui | 已保存路线列表 / 路线编辑 |
| `chat` | — | orders, store, workflow | 订单内聊天（送达后 24h 关闭） |
| `info` | — | store, rules-data | 规则与信息页 |
| `help` | Help | store, orders, help-copy, help-faq | 帮助与支持工单 |
| `profile` | — | store, domain, account, me-copy, orders, runner-level, earnings, yuni | 「我的」：资料、语言切换、认证状态、跑手等级 |

`job` 与 `posted` 没有自己的 `.wxss`，复用 `utils/` 里的共享样式。

---

## 4. 客户端架构（`utils/`）

### 数据流与同步

| 模块 | 职责 |
| --- | --- |
| `cloud.js` | `ensureCloud()`：从 `ocr-config.js` 取 `envId`，调 `wx.cloud.init`。缺 `envId` 或 `wx.cloud` 不可用会**直接抛错**，不做静默降级 |
| `ocr-config.js` | 只放公开的云环境 ID（`cloud1-d1g757cev03375e35`），注释明确写着**绝不放密钥** |
| `store.js` | 本地缓存：内存 + `wx` 存储，`get` / `update` / `reset`；缓存键 `uniearn_cloud_cache_v1`；无 profile 时重建为空态 |
| `orders.js` | **核心同步层**，见下 |
| `account.js` | `call()` 调 `studentAccount`（附带 `lang`）；`requireRunner()` 接单前门禁 |
| `nav.js` | `navigateTo()`：目标页已在栈中就返回过去，栈满（≥9 层）改用 `redirectTo`，避免页面栈循环与溢出 |
| `china-time.js` | 所有显示时间统一按中国时区（UTC+8）格式化，不受设备时区影响 |

`orders.js` 的几个要点：

- `sync()`：`sync` 动作只读拉取快照，同一时刻只允许一个在飞请求（`syncing` 去重），错误消息去重后只提示一次。
- `start()` / `stop()`：`app.js` 的 `onShow`/`onHide` 控制；前台每 **10 秒**轮询一次。
- `act(action, payload)`：
  - `mutating` 单飞锁，避免连续提交两个变更
  - 发送前把 `{at, signature, data}`（含生成的 `operationId`）写进本地 `pendingOrderOperation`
  - 网络失败**重试一次**；业务错误（`result.ok === false`）直接抛给页面，并清掉 pending
  - 恢复不确定请求时若 `signature` 变了，会拒绝静默重放，提示用户先核对订单
  - pending 超过 20 小时（`STALE_OPERATION_MS`）视为过期：丢弃并重新同步，提示用户核对订单，不再永久锁死
- `upload(path)`：先 `prepareUpload` 拿路径再上传；同一路径的并发上传会合并成一次。
- `bind(page, method)` / `unbind`：页面订阅刷新；快照应用后统一 `page.refresh()`。
- `apply(snapshot)`：`revision` 落后于本地则丢弃；比对前后状态后按 `preferences` 触发「云宝」事件或 toast（新消息 `orderUpdates`、订单状态变化、新行程 `nearbyTrip`、新任务 `newJobs`），并遵守考试周免打扰（`examUntil`）。
- `photoURL(path)`：把 `cloud://` 换成快照里的临时链接；`invalidate()` 在登录态变化时清空事件、代数、上传缓存。

### 与服务端共享的模块（容易踩坑）

这几个文件与 `cloudfunctions/orderService/` 下的同名文件**逐字节相同**，是刻意的双份（客户端预览/校验、服务端权威）：

- `utils/domain.js` = `cloudfunctions/orderService/domain.js`
- `utils/catalog.js` = `cloudfunctions/orderService/catalog.js`
- `utils/runner-level.js` = `cloudfunctions/orderService/runner-level.js`
- `utils/pickup-point.js` = `cloudfunctions/parseSmsScreenshot/pickup-point.js`

**改动其中一份，必须同步另一份**，否则端上预览和服务端判定会不一致。

两处**同名但内容不同**，不要当成副本：

- `utils/workflow.js`：客户端专用分支。差异在于中国时区用 `+08:00` 字符串解析、`view()` 会把照片字段换成本地缓存 URL、`candidates()` 按 `campusId` 过滤。业务规则本身与云端一致。
- `utils/rewards.js`：完全是另一个模块。客户端这份只有 `quote(id, reward, fee)`，用来在发布页**预览**券列表与抵扣金额；服务端那份才是权威的券引擎（发放、可用性、核销、结算）。

### 文案、样式与辅助模块

| 类别 | 模块 |
| --- | --- |
| 语言切换 | `page-title.js`：27 个页面的中文/英文导航标题映射 + 切换后重跑当前页本地化；入口是「我的 → 语言」与欢迎页右上角按钮 |
| 中英文案 | `order-copy.js`（订单状态/标签）、`create-copy.js`、`post-copy.js`、`runner-copy.js`、`orders-copy.js`（各页面）、`onboarding.js`、`app-guide.js`（引导）、`hall-copy.js`（大厅）、`me-copy.js`（我的）、`help-copy.js` + `help-faq.js`（帮助）、`rules-data.js` + `rules.json`（规则） |
| 交互辅助 | `ui.js`（toast、照片本地保存；`cleanSaved()` 清理 24 小时前或超过 6 MB 的已保存照片）、`image-input.js`（选图）、`yuni.js`（吉祥物定义）、`yuni-events.js`（按 key 去重的事件队列）、`ocr.js`（OCR 调用） |
| 业务辅助 | `earnings.js`（周收益汇总）、`saved-routes.js`（已保存地址与路线）、`pickup-point.js`（从通知里抽取真实驿站名，**从不默认到某个校区**） |
| 楼层加价 | 文星宿舍区 3 楼及以上每单 +¥1；A05 有电梯免收；文缘/文萃/文荟不加价。金额在 `domain.createRequest` 里按「宿舍区 + 楼层（缺省时从房间号解析，如 1201 → 12 楼）+ 楼栋」计算，下单页预览与云端保持一致 |
| 地址表单 | 「常用路线」编辑页按 mini program 1 补齐：宿舍区（文缘/文星/文萃/文荟）→ 楼栋（按区过滤）→ 楼层（按楼栋 1–23 层）→ 房间号；保存 `area/building/floor/room`，列表显示「文星 A05 12楼 1201」。`locker` 字段保留以兼容老数据，mini program 1 已把输入框去掉，这里同样不再收集 |
| 校园数据 | `campus.js`：4 个宿舍区（文缘/文星/文萃/文荟）、31 栋楼（D01–D06、A01–A05、C01–C10、B01–B10）、楼层（文缘/文萃/文荟 23 层，文星 A05 20 层、其余 6 层）、9 个真实取件点，全部中英双语；来源 mini program 1（xjtlu-run-no-run） |
| 外观 | `appearance.js`：读取 `meAppearance`，设置原生导航栏、窗口背景，并给当前页根节点加 `.page-dark`；26 个页面在 `app.wxss` 里有统一深色覆盖（浅底→深底、深字→浅字），底部导航同步换色；「我的」页切换后立即生效 |
| 共享样式 | `flow.wxss`、`final.wxss`、`v8.wxss`、`post-form.wxss` |

---

## 5. 云函数接口

### 5.1 orderService

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
| 履约 | `runnerCancel` | 跑手取消，带原因，影响信用 |
| 顾客 | `raise` | 加价 ¥1.88 / ¥2.66 / ¥5.55 / ¥6.66 / ¥8.88 |
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
2. 已接受跑手规则（`runnerRulesAcceptedAt`）
3. 姓名 ≥ 2 字且手机号为中国大陆号码
4. 未被信用暂停

**容量上限**：订单 ≤ 200 条、行程 ≤ 200 条、单文档 ≤ 850 KB。每个用户最多 10 个进行中的订单、每天最多发布 30 单。已完成/取消/退款的订单 8 天后由 `archiveFinished()`（每小时一次、独立事务）移到 `uniearn_order_archive`，跑手累计单数/准时/收入和奖励判断所需的事实保留在 `members` 上。照片通过 `cloud.getTempFileURL` 下发的临时链接有效 **600 秒**，只下发当前快照中真正可见的照片。

### 5.2 studentAccount

| action | 说明 |
| --- | --- |
| `wechatLogin` | 用微信手机号授权码换手机号；仅接受中国大陆号；写入 `profile`、`loggedOut: false`、`authRevision+1` |
| `status` / `saveProfile` / `saveDorm` / `logout` 等 | 账户资料 |
| `apply` | 提交跑手申请：真实姓名、手机号、学号。学号在待审核/已认证账户之间唯一；被拒后可重新申请 |
| `agreeRules` | 同意跑手规则 |
| `adminLogin` / `adminLogout` / `adminStatus` | 管理员登录（账号密码来自环境变量），会话 12 小时；连续 5 次失败锁定 15 分钟 |
| `adminDashboard` / `adminOrders` / `review` | 订单统计（总数、待接单、未付款＝已送达未确认、已完成，含已归档）、用户数、跑手数、订单列表（隐藏手机号与取件码）、审核申请（拒绝时备注作为原因） |

- 集合 `uniearn_accounts`，文档 ID = `sha256(openid)`；完整学号只存在服务端，客户端只拿到后 4 位
- 字段：`profile`、`verification`、`authRevision`、`admin`、`loggedOut`
- `REVIEWER_OPENIDS` 中的账户同样视为管理员
- `config.json` 声明了 `phonenumber.getPhoneNumber` 权限
- 依赖：`wx-server-sdk`

### 5.3 parseParcelScreenshot / parseSmsScreenshot

两个 OCR 云函数结构几乎相同，用 `parseSmsScreenshot` 举例：

1. `action === 'prepareUpload'` → 返回 `sms-temp/<actorHash>/<32hex>.jpg`
2. 否则要求 `fileID` 落在 **调用者自己的目录前缀**下且文件名是 32 位 hex + `.jpg`，否则 `Invalid screenshot location.`
3. 频控：同一账户 **5 秒一次**、**每天 100 次**，记在 `uniearn_ocr_limits`
4. 下载文件，大小上限 **6 MB**
5. 调腾讯云 `GeneralBasicOCR`（`LanguageType: 'zh'`，区域默认 `ap-shanghai`）
6. `parseSmsScreenshot` 会合并 SMS 解析与包裹解析的候选取件码，随后在 `finally` 里删除临时文件

> `parseParcelScreenshot/pickup-point.js` 与 `parseSmsScreenshot/pickup-point.js`、以及两边的 `parser.js` / `parcel-parser.js` 是**逐字节相同**的副本。微信云函数各自独立部署、不能互相 require，所以这是有意的重复，不是 bug；改动时记得两处同步。

---

## 6. 订单状态机

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

## 7. 业务规则速查

### 价格与费用

包裹尺寸目录（`catalog.js`）：

| 尺寸 | 价格 | 重量 | 单次上限 |
| --- | --- | --- | --- |
| 小件 · Small | ¥3 | < 1 kg | 3 |
| 中件 · Medium | ¥4 | 1 ~ <3 kg | 3 |
| 大件 · Large | ¥5 | 3 ~ <10 kg | 1 |
| 超大件 · Extra large | ¥10 | 10–20 kg | 1 |

- **服务费**：免收（¥0）。历史订单里的旧服务费照常展示/结算
- **合计** = 赏金 + 服务费（0）− 优惠券抵扣
- 快递可按件计价（最多 5 件，每件一个取件码），赏金 = 各件价格之和 + 小费（小费 0 / 1.88 / 2.66 / 5.55 / 6.66 / 8.88 元，按整单计一次、不按件均摊；部分接单时小费留在剩余订单，整单被同一人接完时才随单支付）
- 不按件时：每件单价下限均为 ¥3；快递 ≤3 件且大件只能 1 件；外卖 ≤5 袋
- 任务：单个任务，价格即赏金，服务费免收

> 以上单价、服务费、小费/加价档位与同类型项目 `xjtlu-run-no-run`（XP跑了么）保持一致：基础 ¥3、快递档位 ¥3/4/5/10、服务费免收、自由加价 ¥1.88/2.66/5.55/6.66/8.88。

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
- 跑手取消仅限**未取件**的订单；取消原因 `missing` / `quantity` / `personal` / `mismatch`
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

**暂停**：14 天内 ≥5 个标记 → 从最后一个标记起暂停 **7 天**。额度同时限制单条订单与整条行程的赏金总额。

### 优惠券与奖金

运营配置集中在 `cloudfunctions/orderService/promotions.js`（**改完要重新部署 orderService**）：

- `golden2026`：国庆 1–7 日 18:00–20:00 免配送费（上限 ¥8），每晚前 30 单
- `welcome-free`：新用户免配送费（上限 ¥8，7 天，自动发放）
- `welcome-two`：¥2 无门槛券（30 天，自动发放）
- `return2026`：上月下过单的老用户 ¥1 × 3 张

其他奖励：

- **周奖**：每周（周一起算，中国时区）完成 5 单 → ¥5
- **高峰加价**：北门 11:30–13:00 接的外卖单 +¥1
- **邀请**：邀请码 = 账户 ID 前 12 位；被邀请人须尚未下过单；首单确认后双方各得一张免配送费券
- 抵扣金额 = `min(券上限, 券类型为配送费 ? 赏金 : 赏金 + 服务费)`

---

## 8. 数据模型

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

**`uniearn_accounts/<sha256(openid)>`** —— `profile`、`verification`、`authRevision`、`admin`、`loggedOut`

**`uniearn_order_archive`** —— 归档的订单行（完成 8 天后写入）

**`uniearn_ocr_limits/<sha256(openid)>`** —— `lastAt`、`day`、`count`

**云存储**：`order-photos/<actorHash>/`、`ocr-temp/<actorHash>/`、`sms-temp/<actorHash>/`

**客户端本地缓存**：`wx` 存储键 `uniearn_cloud_cache_v1`，含快照、`cloudRevision`、`photoURLs`、`pendingOrderOperation`。

> 身份口径：`actor = sha256(openid)`。数据库里不存明文 `openid`。

---

## 9. 部署与配置

### 云函数环境变量

| 变量 | 用途 |
| --- | --- |
| `TENCENT_SECRET_ID` / `TENCENT_SECRET_KEY` | 腾讯云 OCR 密钥（缺失时 OCR 直接报未配置） |
| `TENCENT_OCR_REGION` | OCR 区域，默认 `ap-shanghai` |
| `REVIEWER_OPENIDS` | 逗号分隔的审核人 `openid`，拥有 `resolveDispute` 与管理后台权限 |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | studentAccount 的管理员账号密码（密码至少 8 位），未配置时管理员登录不可用 |

### 步骤

1. 微信开发者工具导入本项目，填自己的 AppID，开通云开发环境
2. 把云环境 ID 写进 `utils/ocr-config.js` 的 `envId`（该文件只放公开 ID，**不要放密钥**）
3. 建四个集合：`uniearn_order_state`、`uniearn_accounts`、`uniearn_ocr_limits`、`uniearn_order_archive`
4. 在 `uniearn_order_state` 里新建文档 `team-test`，内容用 `cloudfunctions/orderService/initial-state.json`
5. 部署 4 个云函数，选「上传并部署：云端安装依赖」
   - `wx-server-sdk ~3.0.1`
   - `tencentcloud-sdk-nodejs-ocr ^4.0.345`（两个截图识别函数）
6. 给 OCR 云函数和 studentAccount 配上表里的环境变量
7. 确认 `studentAccount` 的 `config.json` 权限已随部署生效（微信手机号）

---

## 10. 测试

`npm test` → `node scripts/check.js`：先遍历全仓做 JS 语法检查与 JSON 解析，再按文件名顺序 `node` 执行每个 `tests/*.test.js`。

**当前 35 个测试文件全部通过，退出码 0**，输出 `Syntax checked: 119 JS files, 42 JSON files`。

> 输出里出现 `Coupon refresh failed Error: offline`、`studentAccount failure { ... }` 是**故意构造的失败路径**，用于验证离线降级与错误提示，不是失败。判断标准只看退出码。

覆盖范围（按文件名）：

| 领域 | 测试文件 |
| --- | --- |
| 云端服务 | `order-service`、`workflow`、`domain`、`cloud`、`v8-services`、`retry` |
| 账户与认证 | `dorm-profile`、`logout`、`student-check`、`v8-email`、`onboarding-campus` |
| 快递与 OCR | `ocr`、`pickup-point`、`sms`、`sms-flow`、`parcel-address`、`non-dorm-orders`、`categories` |
| 页面与流程 | `pages`、`takeaway-pages`、`task-post-controls`、`task-no-address`、`saved-routes`、`read-coupons`、`rules-full-page` |
| 接单大厅 | `jobs-navigation`、`jobs-selection`、`bilingual-hall` |
| 界面与文案 | `ui-bindings`、`wxss`、`help-template`、`me-copy-compatibility`、`me-sticker-inline`、`final-english` |
| 引导与提示 | `guide-replay`、`yuni-support` |
| 审查修复 | `review-fixes`（中国时区显示、页面栈安全跳转、已存照片清理） |

`docs/SELF-CHECK.txt` 保存了一次完整自检的原始输出，可与本地结果对照。

---

## 附：已知小问题（未改）

- `project.config.json` 声明基础库 `3.7.0`，而本地 `project.private.config.json` 是 `3.17.3`，不一致
- `parseParcelScreenshot` 与 `parseSmsScreenshot` 存在逐字节相同的副本文件（见 5.3，属有意重复）
- 代码中的「退款」「扣款」均为演示逻辑（`demo refund`、`simulated refund`），未接入真实支付；也未接入微信订阅消息
