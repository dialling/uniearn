const store=require('./store');
function quote(id,reward,fee){
 const state=store.get(),now=Date.now(),data=state.rewards||{};
 const hour=new Date(now+28800000).getUTCHours()+new Date(now+28800000).getUTCMinutes()/60;
 const coupons=(Array.isArray(data.coupons)?data.coupons:[])
  .filter(c=>!c.usedBy&&(!c.expiresAt||c.expiresAt>now))
  .map(c=>{const inWindow=!c.hours||(hour>=c.hours[0]&&hour<c.hours[1]);return {...c,short:c.short||c.title||'Coupon',usable:c.usable!==false&&inWindow,unavailableLabel:!inWindow?c.hours[0]+':00–'+c.hours[1]+':00 only':'Unavailable now'};});
 const c=coupons.find(c=>c.id===id&&c.usable);
 const delivery=Number(reward)||0,service=Number(fee)||0;
 const discount=c?Math.max(0,Math.min(Number(c.max)||0,c.kind==='delivery'?delivery:delivery+service)):0;
 return {coupons,couponCount:coupons.length,couponId:c?c.id:'',couponTitle:c?c.short:'None',discount:discount.toFixed(2),total:Math.max(0,delivery+service-discount).toFixed(2)};
}
module.exports={quote};
