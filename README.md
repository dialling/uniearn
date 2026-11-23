# UniEarn · 校园代取与跑腿小程序

XJTLU 校园里的「顺路帮拿」平台。同学发布 **代取快递**、**代拿外卖** 或 **其他任务**，跑手（Runner）顺路接单、取件、上门送达并拍照留证，双方确认后结算。中英双语，微信小程序 + **自建 HTTP 后端**。

| 项 | 值 |
| --- | --- |
| 小程序 AppID | `wxf85d5cbdae249978` |
| 后端地址 | `https://pararouter.cn`（体验版 / 正式版 / 模拟器统一） |
| 后端代码 | 独立仓库 `xjtlu-run-no-run` 的 `server/`（Node.js + Express + SQLite） |
| 版本 | `4.0.4` |
| 技术栈 | 微信小程序原生（WXML/WXSS/JS）+ REST API |
| 基础库 | `3.7.0` |
| Node.js | ≥ 18（**仅**用于跑本地测试，小程序本身不需要） |
| 规模 | 127 个 JS / 43 个 JSON，27 个页面，35 个客户端模块，39 个测试文件 |

---

## 后端约定（重要）

**本项目不再使用微信云开发（CloudBase）。** 所有数据、文件、OCR、消息都走自建后端 `https://pararouter.cn`。

### 硬性规则

1. **禁止新增 `wx.cloud.*` 调用**：`wx.cloud.init` / `callFunction` / `uploadFile` / `getTempFileURL` / `deleteFile` 一律不写。
2. **禁止在客户端依赖 `cloudfunctions/`**：该目录是历史遗留（原始 uniEarn 项目带进来的），只作存档，不再部署、不再被调用。
3. **不要在 `merge-mode` 里关掉 REST**：`utils/merge-mode.js` 的 `enabled` 必须为 `true`；置为 `false` 会退回云函数通道，而当前 AppID 名下没有云环境，所有请求都会失败。
4. **新功能一律「后端先有接口」**：先在 `server/src/routes/` 加路由，再在 `utils/xp-*.js` 里映射，页面只调用 `utils/orders.js` / `utils/account.js`，不直接碰 `api.js`。

### 调用链

```
页面 (pages/*)
  └── utils/orders.js · utils/account.js · utils/wallet.js   ← merge 模式分支
        └── utils/xp-orders.js · utils/xp-account.js · utils/xp-rewards.js
              └── utils/api.js  →  https://pararouter.cn/api/*
                    └── server/src/routes/*.js  →  SQLite
```

`utils/cloud.js` 只在 `merge-mode` 关闭时才返回真实的 `wx.cloud`；合并模式下它返回一个 REST 适配器，把历史云函数名（`newsService` / `parseParcelScreenshot` / `parseSmsScreenshot` / `studentAccount` / `orderService`）转成对应的 HTTP 请求，避免老页面报「云函数不存在」。

### 已转接的云函数

| 云函数 | 现在的落点 |
| --- | --- |
| `studentAccount`（status） | `GET /api/auth/me` |
| `orderService`（wallet 等） | `GET /api/wallet`、`/api/orders/*`（见 `xp-orders.js`） |
| `parseParcelScreenshot` | `POST /api/ocr/parcel` |
| `parseSmsScreenshot` | `POST /api/ocr/sms` |
| `newsService`（newsList） | 后端暂无资讯源，返回空列表；需先建 news 表 |
| `newsService`（analyticsBatch / activityConfig） | no-op |

### 本地联调

```bash
# 后端（另一个仓库 xjtlu-run-no-run）
cd server && PORT=8099 node src/index.js

# 小程序：utils/config.js 里 develop 默认指向线上；本机联调时临时改成
# http://127.0.0.1:8099 即可
```

## 网页预览 · Clickable preview

不用微信开发者工具，也能在浏览器里点完整流程：三台手机（学生 / 跑手 / 朋友）共用一个模拟云端，跑的是同一套页面代码和订单逻辑。

```bash
npm run preview
```

然后打开 http://127.0.0.1:4180 。需要 Node.js ≥ 18，不用 npm install。数据保存在浏览器里，点「Reset demo data」可清空。

Run `npm run preview` and open http://127.0.0.1:4180 to click through the app in a browser (student, runner and friend phones sharing one simulated cloud). Needs Node.js 18+, no install. Preact loads from cdn.jsdelivr.net, so the first load needs internet.

---

## 目录结构

```
uniearn/
├── app.js / app.json / app.wxss   小程序入口、页面注册、全局样式
├── sitemap.json                   微信搜索索引配置
├── project.config.json            微信开发者工具项目配置
├── package.json                   仅承载 npm test
├── assets/                        46 个图标、插画与「云宝」吉祥物
├── components/                    自定义组件
│   ├── nav/                       底部导航栏
│   ├── yuni/                      「云宝」轻提示
│   ├── yuni-assistant/            「云宝」助手浮层
│   └── lang-switch/               每页钩子：本地化导航标题 + 深浅色导航（不渲染 UI）
├── pages/                         27 个页面（每个页面 index.{js,json,wxml,wxss}）
├── utils/                         35 个客户端模块（含中英文案、共享样式）
├── cloudfunctions/                4 个云函数，每个目录独立部署
│   ├── orderService/              订单 / 行程 / 奖励核心服务
│   ├── studentAccount/            账户、跑手申请、管理后台、微信手机号
│   ├── parseParcelScreenshot/     快递截图 OCR 解析
│   └── parseSmsScreenshot/        短信截图 OCR 解析
├── scripts/check.js               语法检查 + 依次执行 tests/
├── tests/                         39 个回归测试（Node 直跑，无框架）
└── docs/                          项目文档
    ├── PROJECT-OVERVIEW.md        架构与业务规则总览 ← 接手代码先看这个
    ├── UPDATE-CN.md               0.9.20 版本更新说明
    └── SELF-CHECK.txt             一次完整自检的原始输出
```

> `cloudfunctions/` 为历史云函数代码，仅作存档，已不部署、不被引用。新增后端能力请写到 `xjtlu-run-no-run/server/`。


小程序根目录就是仓库根目录（`miniprogramRoot: "./"`），所以 `app.*`、`assets/`、`components/`、`pages/`、`utils/` 必须留在顶层，不能收进 `src/`。`project.config.json` 的 `packOptions.ignore` 已把 `tests/`、`scripts/` 和所有 `.md` / `.txt` 排除在小程序包外。

---

## 快速开始

```sh
git clone https://github.com/yz768771-maker/uniEarn.git
cd uniEarn
npm test
```

`npm test` 应输出 `Syntax checked: 127 JS files, 43 JSON files`，然后跑完 `tests/` 下 39 个测试文件并**退出码 0**。

（若本地显示 `41 JSON files`，多出来的是微信开发者工具生成的 `project.private.config.json`——它已被 `.gitignore` 忽略、不在仓库里，属正常。）

> 测试输出里会出现 `Coupon refresh failed Error: offline`、`studentAccount failure { ... }` 这类字样——那是**故意构造的失败路径**，用来验证降级行为，不是测试失败。判断标准只看退出码和结尾。

在微信开发者工具里：**导入项目 → 选择本目录 → 填自己的 AppID → 配置云开发环境**。

如果要换到自己的云开发环境，改 `utils/ocr-config.js` 里的 `envId`（那里只放公开 ID，**绝不要放密钥**）。密钥只配在云函数的环境变量里，见 [docs/PROJECT-OVERVIEW.md](docs/PROJECT-OVERVIEW.md#9-部署与配置)。

---

## 协作者约定

所有协作者都有 **write** 权限：可以克隆、提交、直接 push 到 `main`、开分支、发 PR，也可以直接在 GitHub 网页上编辑文件并提交。`main` **未设**保护分支。

- 提交前先 `git pull --rebase`，避免把别人的改动顶掉。
- 改动大或影响他人时，走分支 + Pull Request，方便回退和 review。
- 用 GitHub 网页上传时，**文件夹要整个拖进去**。分次上传单个文件很容易漏目录——曾经有一份拷贝就是因为漏了 `pages/` 和 `utils/` 导致整个小程序跑不起来。
- `project.private.config.json` 是微信开发者工具的本地配置，已在 `.gitignore` 中忽略，**不要提交**。
- 提交信息写清「这次改了什么」。

## 中英文与个人语言设置

在「我的」顶部选择 **语言 / Language**。已登录账户的偏好保存在 CloudBase，访客使用微信本机存储。首次使用按微信客户端语言选择中文或英文。部署步骤、兼容说明、测试和已知限制见 [中英文开发与部署](docs/LOCALIZATION.md)。
