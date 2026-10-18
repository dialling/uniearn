# Uniearn「我的」页面改版 + 多语言完善 + 后端修复

> 设计稿：`../design/profile_final_long.png`（定稿）、`../design/profile_final_markup.png`（模块说明）
> 分支：main ｜ 远程：github.com/dialling/uniearn

## 阶段 1 ·「我的」页面重构

- [x] 1.1 me-copy.js 增补双语文案（双徽章、折叠贴纸、分组标题，84→105 键）
- [x] 1.2 顶部大卡：资料 + 发布/接单双徽章 + 等级进度条，点「校园帮手 ›」展开等级详情
- [x] 1.3 Yuni 贴纸折叠卡：默认迷你预览，点开完整网格 + 获得方式（Yuni 功能全保留）
- [x] 1.4 订单与工具组 3 行：我的订单 / 常用路线 / 我的配送信息（原 4 行中「历史订单与收据」与「我的订单」同跳 requests 页，合并去重）
- [x] 1.5 删除「考试模式」toggle（前端 wxml + 后端 engine.js 写入端 + utils/orders.js 读取端 + 文档，全部清除）
- [x] 1.6 通知与提醒组：Yuni 小提示 / 附近的新任务 / 我的订单更新
- [x] 1.7 账户组：通用设置（内联展开校区/语言/外观）/ 平台规则 / 隐私与我的数据 / 帮助中心 / 管理员登录
- [x] 1.8 保留：成为跑手卡、问问 Yuni（悬浮入口）、邀请同学卡、数据卡、收益卡、footer；修复 tips 绑定（yuniTips 开关显示状态）

## 阶段 2 · 多语言

- [x] 2.1 me-copy.js 英文全部用正规表达，与中文同步校对
- [x] 2.2 语言切换链路检查：lang-switch 组件 → page-title.toggle → onboarding.toggle + 标题刷新 + relocalize；nav 组件 observer + pageLifetimes.show 兜底，29 页全覆盖，无断链
- [x] 2.3 page-title.js MAP 核对全部页面标题（lang-switch.test.js 锁定）

## 阶段 3 · 后端（cloudfunctions）

- [x] 3.1 审查 orderService / studentAccount / parse* 全部源码，列问题清单（双 explore 代理交叉审查）
- [x] 3.2 已修复：考试模式 exam 残留 4 处；OCR 两云函数配额移到文件校验后（不再白扣额度）+ 日限额按中国时区切日；runnerStats 只暴露 jobsDone/onTime（不再泄露跑手累计收入与处罚记录给客户）；活动列表过滤未开始/已结束活动；getAccount/review/logout 补 missing 文档容错（含 errCode -502005）；studentAccount 去重复 require、微信登录名 trim 空白回落 Student

## 阶段 4 · 交付

- [x] 4.1 本地测试通过（node scripts/check.js 全绿）
