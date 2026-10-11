# UniEarn · 校园代取与跑腿小程序

XJTLU 校园里的「顺路帮拿」平台。同学发布 **代取快递**、**代拿外卖** 或 **其他任务**，校园帮手（Runner）顺路接单、取件、上门送达并拍照留证，双方确认后结算。中英双语，微信小程序 + 微信云开发（CloudBase）。

| 项 | 值 |
| --- | --- |
| 小程序 AppID | `wxf6d43df037493a8c` |
| 云开发环境 ID | `cloud1-d1g757cev03375e35`（在 `utils/ocr-config.js` 里） |
| 版本 | `0.9.20` |
| 技术栈 | 微信小程序原生（WXML/WXSS/JS）+ 云函数 + 云数据库 + 云存储 |
| 基础库 | `3.7.0` |
| Node.js | ≥ 18（**仅**用于跑本地测试，小程序本身不需要） |
| 规模 | 114 个 JS / 40 个 JSON，26 个页面，30 个客户端模块，4 个云函数，36 个测试文件 |

---

## 目录结构

```
uniearn/
├── app.js / app.json / app.wxss   小程序入口、页面注册、全局样式
├── sitemap.json                   微信搜索索引配置
├── project.config.json            微信开发者工具项目配置
├── package.json                   仅承载 npm test
├── assets/                        78 个图标、插画与「云宝」吉祥物
├── components/                    自定义组件
│   ├── nav/                       底部导航栏
│   ├── yuni/                      「云宝」轻提示
│   └── yuni-assistant/            「云宝」助手浮层
├── pages/                         26 个页面（每个页面 index.{js,json,wxml,wxss}）
├── utils/                         30 个客户端共享模块（含中英文案、共享样式）
├── cloudfunctions/                4 个云函数，每个目录独立部署
│   ├── orderService/              订单 / 行程 / 奖励核心服务
│   ├── studentAccount/            账户、学生认证、邮箱验证码
│   ├── parseParcelScreenshot/     快递截图 OCR 解析
│   └── parseSmsScreenshot/        短信截图 OCR 解析
├── scripts/check.js               语法检查 + 依次执行 tests/
├── tests/                         36 个回归测试（Node 直跑，无框架）
└── docs/                          项目文档
    ├── PROJECT-OVERVIEW.md        架构与业务规则总览 ← 接手代码先看这个
    ├── UPDATE-CN.md               0.9.20 版本更新说明
    └── SELF-CHECK.txt             一次完整自检的原始输出
```

小程序根目录就是仓库根目录（`miniprogramRoot: "./"`），所以 `app.*`、`assets/`、`components/`、`pages/`、`utils/` 必须留在顶层，不能收进 `src/`。`project.config.json` 的 `packOptions.ignore` 已把 `tests/`、`scripts/` 和所有 `.md` / `.txt` 排除在小程序包外。

---

## 快速开始

```sh
git clone https://github.com/yz768771-maker/uniEarn.git
cd uniEarn
npm test
```

`npm test` 应输出 `Syntax checked: 114 JS files, 40 JSON files`，然后跑完 `tests/` 下 36 个测试文件并**退出码 0**。

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
