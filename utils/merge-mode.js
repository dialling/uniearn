// 合并版：西浦跑的后端是 HTTP（server/），云开发在这个 AppID 下没有权限。
// 订单同步在适配器（utils/xp-orders.js）接好之前先跳过，避免每次进页面报 -601034。
module.exports={enabled:true};
