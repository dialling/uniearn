# UniEarn · 校园代取与跑腿小程序

XJTLU 校园里的「顺路帮拿」平台。同学发布 **代取快递**、**代拿外卖** 或 **其他任务**，校园帮手（Runner）顺路接单、取件、上门送达并拍照留证，双方确认后结算。中英双语，微信小程序 + 微信云开发（CloudBase）。

| 项 | 值 |
| --- | --- |
| 小程序 AppID | `wxf6d43df037493a8c` |
| 版本 | `0.9.20` |
| 技术栈 | 微信小程序原生（WXML/WXSS/JS）+ 云函数 + 云数据库 + 云存储 |
| 运行环境 | 微信开发者工具（基础库 3.7.0）+ 微信云开发环境 |
| Node.js | ≥ 18（**仅**用于跑本地测试脚本，小程序本身不需要） |

---

## ⚠️ 当前状态：仓库代码尚不完整

本仓库只上传了项目的一部分（111 个文件）。GitHub 上传时漏掉了两个关键目录：

| 缺失目录 | 应有内容 | 影响 |
| --- | --- | --- |
| `pages/` | `app.json` 里声明的 **26 个页面** | 小程序无法编译运行 |
| `utils/` | 客户端共享模块：`store` `cloud` `account` `orders` `domain` `catalog` `ocr` `workflow` `runner-level` `help-copy` `onboarding` | `app.js` 和几乎全部测试都加载不了 |

`docs/SELF-CHECK.txt` 里记录的原始自检结果是 **114 个 JS / 40 个 JSON**，而本仓库实际只有 **36 个 JS / 14 个 JSON**。所以 `npm test` 会在第一个测试文件就 `MODULE_NOT_FOUND`——10 个测试文件里目前只有 1 个能加载。

这属于**上传遗漏，不是代码问题**；补齐这两个目录即可恢复。缺口的完整清单和补齐步骤见 [docs/PROJECT-OVERVIEW.md](docs/PROJECT-OVERVIEW.md)。

---

## 目录结构

```
uniearn/
├── app.js / app.json / app.wxss   小程序入口、全局配置、全局样式
├── sitemap.json                   微信搜索索引配置
├── project.config.json            微信开发者工具项目配置（miniprogramRoot = "./"）
├── package.json                   仅承载 npm test
├── assets/                        图标与插画（SVG + PNG，50 个）
├── components/                    自定义组件
│   ├── nav/                       底部导航栏
│   ├── yuni/                      轻提示
│   └── yuni-assistant/            云宝助手
├── cloudfunctions/                云函数（每个目录独立部署）
│   ├── orderService/              订单 / 行程 / 奖励核心服务
│   ├── studentAccount/            账户、学生认证、邮箱验证码
│   ├── parseParcelScreenshot/     快递截图 OCR 解析
│   └── parseSmsScreenshot/        短信截图 OCR 解析
├── scripts/check.js               语法检查 + 依次执行 tests/
├── tests/                         回归测试（Node 直跑，无框架）
├── docs/                          项目文档
│   ├── PROJECT-OVERVIEW.md        架构与业务规则总览
│   ├── UPDATE-CN.md               0.9.20 版本更新说明
│   └── SELF-CHECK.txt             一次完整自检的原始输出
├── pages/                         ⚠️ 缺失（26 个页面）
└── utils/                         ⚠️ 缺失（客户端共享模块）
```

小程序根目录就是仓库根目录（`miniprogramRoot: "./"`），所以 `app.*`、`assets/`、`components/`、`pages/`、`utils/` 必须留在顶层，不能收进 `src/`。`project.config.json` 的 `packOptions.ignore` 已把 `tests/`、`scripts/` 和所有 `.md` / `.txt` 排除在小程序包外。

---

## 快速开始

```sh
git clone https://github.com/dialling/uniearn.git
cd uniearn
npm test            # 语法检查 + 回归测试（当前会因缺失 utils/ 而失败，见上方状态）
```

在微信开发者工具里：**导入项目 → 选择本目录 → 使用自己的 AppID 或测试号 → 配置云开发环境**。

云函数部署与环境变量、数据库集合的初始化步骤，见 [docs/PROJECT-OVERVIEW.md](docs/PROJECT-OVERVIEW.md#8-部署与配置)。

---

## 协作者约定

所有协作者都有 **write** 权限：可以克隆、提交、直接 push 到 `main`、开分支、发 PR，也可以直接在 GitHub 网页上编辑文件并提交。`main` **未设**保护分支。

- 提交前先 `git pull --rebase`，避免把别人的改动顶掉。
- 改动大或影响他人时，走分支 + Pull Request，方便回退和 review。
- 用 GitHub 网页上传时，**文件夹要整个拖进去**——本仓库的 `pages/` 和 `utils/` 就是分次上传时漏掉的。
- `project.private.config.json` 是微信开发者工具的本地配置，已在 `.gitignore` 中忽略，**不要提交**。
- 提交信息写清「这次改了什么」。
