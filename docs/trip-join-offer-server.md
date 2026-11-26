# 加入行程：跑手确认，而不是自动接单（后端改动说明）

2026-11-26 · 写给后端（`xjtlu-run-no-run/server/`）

## 现在的问题

顾客在别人的行程里下单（`POST /api/orders` 带 `trip_id`）时，服务端**直接把订单分给这个行程的跑手**（状态变成已接单）。
跑手没有机会选择，其他跑手在接单大厅里也看不到这单。

## 想要的流程

1. 顾客带 `trip_id` 下单 → 订单保持 **`pending`（待接单）**，同时：
   - 记 `offered_trip_id = <行程 id>`、`offer_expires_at = 现在 + 10~15 分钟`；
   - **照常出现在接单大厅** `GET /api/orders?status=pending`。
2. 这个行程的跑手在 `GET /api/trips` 的 `offers` 里看到这单（小程序行程页已经有「接受 / 拒绝」按钮）。
   - 接受：`POST /api/trips/:tripId/offers/:orderId { decision: "accept" }` → 订单 `accepted`，接单人 = 这个跑手，`runner_trip_id = tripId`，加入行程的 `request_ids`。
   - 拒绝：`{ decision: "decline" }` → 清掉 `offered_trip_id`，订单继续 `pending` 留在大厅。
3. 如果**其他跑手先在大厅接了**（`POST /api/orders/:id/accept`）：
   - 订单归这个跑手，清掉 `offered_trip_id`；
   - 原行程的跑手再点接受时返回错误（小程序会提示「这笔加入请求已失效，请刷新行程」）。
4. `offer_expires_at` 过期后：清掉 `offered_trip_id`，订单留在大厅。

## 小程序这边

不用改，已经支持：
- 行程页显示加入请求和「接受 / 拒绝」（`pages/trip`，`tripOffer` → `/api/trips/:id/offers/:orderId`）；
- 订单读 `offered_trip_id` / `offer_expires_at`（`utils/xp-orders.js` `toRequest`）；
- 大厅照常显示所有 `pending` 订单，别人接走后请求会从行程页消失。

## 怎么看效果

网页预览（`npm run preview` → http://127.0.0.1:4180/?pair）的模拟服务端已经按上面的规则实现（`preview-web/src/mock-api.js`），可以用两台/三台手机试：跑手发起行程 → 学生加入 → 跑手接受或拒绝，或者朋友手机在大厅先接。
