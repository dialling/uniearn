// 优惠券：REST 拉取后写进 store.rewards，页面仍然是原来的渲染逻辑。
const api=require('./api'),store=require('./store');
async function load(){
  try{
    const [all,avail]=await Promise.all([api.get('/api/coupons'),api.get('/api/coupons/available')]);
    const rows=(all&&all.list)||[];
    const usable=new Set(((avail&&(avail.list||avail.coupons))||[]).map(c=>c.id));
    const coupons=rows.map(c=>({
      id:c.id, title:c.title||'Coupon', titleZh:c.title_zh||c.title||'优惠券',
      kind:c.discount_type==='percentage'?'percent':'amount',
      // 服务端返回 pay_rate_bps（用户实付比例，1 = 几乎免单），页面要的是「折扣百分比」
      percent:c.discount_type==='percentage'?Math.round(100-(Number(c.pay_rate_bps)||10000)/100):0,
      max:(Number(c.max_discount_cents||c.discount_cents||0)||0)/100,
      stored:false, balance:0,
      expiresAt:c.expires_at?Date.parse(c.expires_at):null,
      usable:usable.has(c.id), status:c.status||(usable.has(c.id)?'available':'expired'),
      description:c.description||'', short:c.title||'Coupon'
    }));
    store.update(s=>{s.rewards={...(s.rewards||{}),coupons, couponHistory:coupons};});
    return coupons;
  }catch(e){return [];}
}
module.exports={load};
