const store=require('./store');
function quote(id,reward,fee,ready=true){
 const state=store.get(),now=Date.now(),data=state.rewards||{};
 const hour=new Date(now+28800000).getUTCHours()+new Date(now+28800000).getUTCMinutes()/60;
 const coupons=(Array.isArray(data.coupons)?data.coupons:[])
  .filter(c=>ready&&!c.pending&&!c.usedBy&&(!c.expiresAt||c.expiresAt>now)&&(!c.daily||Number.isFinite(c.issuedAt)&&new Date(c.issuedAt+28800000).toISOString().slice(0,10)===new Date(now+28800000).toISOString().slice(0,10)))
  .map(c=>{const inWindow=!c.hours||(hour>=c.hours[0]&&hour<c.hours[1]);return {...c,short:c.short||c.title||'Coupon',usable:c.usable!==false&&inWindow,unavailableLabel:!inWindow?c.hours[0]+':00–'+c.hours[1]+':00 only':'Unavailable now'};});
 const delivery=Number(reward)||0,service=Number(fee)||0,save=c=>{const cap=Number(c.stored?c.balance:c.max)||0;return Math.round(Math.max(0,c.kind==='deliveryPercent'?Math.min(Number(c.max)||3.9,delivery*(Number(c.percent)||50)/100):Math.min(cap,c.kind==='delivery'?delivery:delivery+service))*100)/100;};
 coupons.forEach(x=>{x.save=x.usable?save(x).toFixed(2):'0.00';});
 // id null/undefined = automatic: use the usable coupon that saves the most.
 const c=id==null?coupons.filter(x=>x.usable&&save(x)>0).sort((a,b)=>save(b)-save(a))[0]:coupons.find(x=>x.id===id&&x.usable);
 const discount=c?save(c):0;
 return {auto:ready&&id==null,coupons,couponCount:coupons.length,couponId:c?c.id:!ready?(id||''):'',couponTitle:c?c.short:'None',discount:discount.toFixed(2),total:Math.max(0,delivery+service-discount).toFixed(2)};
}
module.exports={quote};
