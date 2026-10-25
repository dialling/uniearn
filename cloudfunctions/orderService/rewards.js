const baseConfig=require('./promotions');
const configFor=s=>s.adminPromotions?{...baseConfig,...s.adminPromotions}:baseConfig;
const loyalty=require('./loyalty');
const day=t=>new Date(t+28800000).toISOString().slice(0,10);
function member(s,id){return s.members[id]||(s.members[id]={marks:[]});}
function issue(m,c,now,suffix=''){m.coupons=m.coupons||[];const id=c.id+suffix;if(!m.coupons.some(x=>x.id===id))m.coupons.push({...c,id,campaignId:c.id,issuedAt:now,expiresAt:c.end?Date.parse(c.end):now+(c.days||30)*86400000});}
function init(s,id,now){const m=member(s,id);if(!m.rewardsJoined){m.rewardsJoined=now;configFor(s).campaigns.filter(c=>c.automatic&&c.enabled!==false&&eligible(s,id,c,now)).forEach(c=>issue(m,c,now));}return m;}
function eligible(s,id,c,now){if(c.start&&now<Date.parse(c.start)||c.end&&now>=Date.parse(c.end))return false;if(c.returning){const prev=new Date(now+28800000);prev.setUTCDate(1);prev.setUTCMonth(prev.getUTCMonth()-1);const month=prev.toISOString().slice(0,7);return s.requests.some(r=>r.ownerId===id&&r.status==='confirmed'&&day(r.createdAt).startsWith(month))||((s.members[id]||{}).confirmedMonths||[]).includes(month);}return true;}
function collect(s,id,cid,now){const m=init(s,id,now),c=configFor(s).campaigns.find(x=>x.id===cid&&!x.automatic&&x.enabled!==false);if(!c||!eligible(s,id,c,now))throw Error('This campaign is not available to your account.');if(c.daily){const key='-'+day(now);issue(m,c,now,key);}else for(let i=0;i<(c.count||1);i++)issue(m,c,now,'-'+i);}
// Stored-value coupons (stored:true) keep a balance and can be spent across several orders until it runs out.
const round=x=>Math.round(x*100)/100,left=c=>c.stored?round(Number(c.balance)||0):c.max;
function available(c,now){if(c.pending||c.stored&&!(left(c)>0))return false;const h=new Date(now+28800000).getUTCHours()+new Date(now+28800000).getUTCMinutes()/60;return !c.usedBy&&now<c.expiresAt&&(!c.hours||h>=c.hours[0]&&h<c.hours[1])&&(!c.daily||day(c.issuedAt)===day(now));}
function discount(c,reward,fee){if(c.kind==='deliveryPercent')return Math.round(Math.min(Number(c.max)||3.9,reward*(Number(c.percent)||50)/100)*100)/100;return Math.round(Math.min(left(c),c.kind==='delivery'?reward:reward+fee)*100)/100;}
function apply(s,id,r,cid,now){if(!cid)return;const m=init(s,id,now),c=m.coupons.find(x=>x.id===cid);if(!c||!available(c,now))throw Error('This coupon is used, expired, or outside its time window.');const campaignKey=c.campaignId||c.id.replace(/-\d{4}-\d{2}-\d{2}$/,'');if(c.dailyOrderLimit&&s.requests.filter(x=>x.couponId&&(x.couponCampaignId===campaignKey||!x.couponCampaignId&&x.couponId.startsWith(campaignKey+'-'))&&day(x.createdAt)===day(now)&&!['cancelled','refunded'].includes(x.status)).length>=c.dailyOrderLimit)throw Error('This evening’s first 30 promotional orders have been claimed.');r.discount=discount(c,r.reward,r.serviceFee);r.couponId=c.id;r.couponCampaignId=campaignKey;r.couponTitle=c.short;r.couponUseId=r.id;if(c.stored){c.balance=round(left(c)-r.discount);c.uses=(c.uses||[]).concat({id:r.id,amount:r.discount});if(!(c.balance>0))c.usedBy=r.id;return;}c.usedBy=r.id;delete c.usedByCompleted;}
function couponGroup(s,r,c){
 const original=s.requests.find(x=>x.id===c.usedBy&&x.ownerId===r.ownerId&&x.couponId===r.couponId);
 if(!original)return [];
 const group=[original],ids=new Set([original.id]);
 for(let i=0;i<group.length;i++){
  const row=group[i];
  // A removed split may have completed and been archived; never refund blindly.
  if(row.splitOriginal&&!s.requests.some(x=>x.id===row.splitOriginal.extraId))return [];
  for(const x of s.requests)if(x.ownerId===r.ownerId&&x.couponId===r.couponId&&(x.splitParentId===row.id||x.couponUseId===c.usedBy)&&!ids.has(x.id)){ids.add(x.id);group.push(x);}
 }
 return ids.has(r.id)?group:[];
}
function restore(s,r){
 const m=s.members[r.ownerId],c=m&&(m.coupons||[]).find(x=>x.id===r.couponId);
 if(c&&c.stored){const u=(c.uses||[]).find(x=>x.id===r.id);if(u&&!r.splitParentId&&!r.splitOriginal){c.balance=round(left(c)+u.amount);c.uses=c.uses.filter(x=>x!==u);delete c.usedBy;}return;}
 if(!c||!c.usedBy||c.usedByCompleted)return;
 const group=couponGroup(s,r,c);
 if(group.length&&group.every(x=>['cancelled','refunded'].includes(x.status)))delete c.usedBy;
}
function settle(s,now){for(const r of s.requests){if(['cancelled','refunded'].includes(r.status))restore(s,r);if(r.status!=='confirmed')continue;const m=member(s,r.ownerId);const used=(m.coupons||[]).find(c=>c.id===r.couponId);if(used&&!used.stored&&used.usedBy&&(r.couponUseId===used.usedBy||couponGroup(s,r,used).length))used.usedByCompleted=true;const trip=s.trips.find(t=>t.id===r.runnerId);loyalty.completeOrder(s,r,trip,now);unlockInviteCoupon(s,r.ownerId,now,r.confirmedAt);if(trip&&trip.runnerAccountId)unlockInviteCoupon(s,trip.runnerAccountId,now,r.confirmedAt);}
}
function pendingInviteCoupon(s,inviter,invitee,now){const m=init(s,inviter,now);m.coupons=m.coupons||[];const id='invite-'+invitee;if(m.coupons.some(c=>c.id===id))return;const c={id,title:'Invite reward · 50% delivery coupon',titleZh:'邀请奖励 · 5折配送券',short:'Invite 50% off',percent:50,max:3.9,kind:'deliveryPercent',pending:true,description:'Unlock when your classmate completes their first order',descriptionZh:'新同学完成首单后解锁，最高抵 ¥3.9'};m.coupons.push(c);}
function unlockInviteCoupon(s,id,now,confirmedAt){const m=member(s,id);if(!m.invitedBy||m.inviteCouponUnlocked||!confirmedAt||confirmedAt<=m.invitedAt)return;const inviter=member(s,m.invitedBy),coupon=(inviter.coupons||[]).find(c=>c.id==='invite-'+id);if(!coupon)return;coupon.pending=false;coupon.issuedAt=now;coupon.expiresAt=now+30*86400000;m.inviteCouponUnlocked=true;}
function invite(s,id,code,now=Date.now()){const m=member(s,id);if(m.invitedBy)throw Error('You have already linked an invitation code.');const inviter=Object.keys(s.members).find(x=>x.slice(0,12)===code);if(!inviter||inviter===id)throw Error('Invalid invitation code.');m.invitedBy=inviter;m.invitedAt=now;loyalty.invite(s,inviter,id,now);pendingInviteCoupon(s,inviter,id,now);}
function bonus(s,id,now){const cfg=configFor(s).weekly,n=new Date(now+28800000),weekday=(n.getUTCDay()+6)%7;n.setUTCHours(0,0,0,0);const start=n.getTime()-28800000-weekday*86400000;const ts=new Set(s.trips.filter(t=>t.runnerAccountId===id).map(t=>t.id));const done=s.requests.filter(r=>ts.has(r.runnerId)&&['delivered','confirmed'].includes(r.status)&&r.deliveredAt>=start);return {enabled:!!cfg.enabled,target:cfg.target,count:done.length,amount:cfg.amount,earned:cfg.enabled&&done.length>=cfg.target,segments:Array.from({length:cfg.target},(_,i)=>i<done.length)};}
function view(s,id,now){const m=s.members[id]||{},all=m.coupons||[],couponData=c=>({...c,...(c.stored?{face:'¥'+left(c),balance:left(c)}:{}),endLabel:c.expiresAt?day(c.expiresAt-1):''}),couponHistory=all.map(c=>({...couponData(c),status:c.pending?'pending':c.usedBy?'used':c.expiresAt<=now||c.daily&&day(c.issuedAt)!==day(now)?'expired':'available'}));return {coupons:all.filter(c=>!c.pending&&!c.usedBy&&c.expiresAt>now&&(!c.daily||day(c.issuedAt)===day(now))).map(c=>({...couponData(c),usable:available(c,now)})),couponHistory,campaigns:configFor(s).campaigns.filter(c=>c.enabled!==false&&!c.automatic&&(!c.start||now>=Date.parse(c.start))&&(!c.end||now<Date.parse(c.end))).map(c=>({...c,eligible:eligible(s,id,c,now),collected:all.some(x=>x.id.startsWith(c.id)&&(!x.daily||day(x.issuedAt)===day(now)))})),weekly:bonus(s,id,now),rush:configFor(s).rush,news:baseConfig.news,inviteCode:id.slice(0,12),hasInvitedBy:!!m.invitedBy};}
function recordBonus(s,id,r,now){if(r.bonusRecorded)return;r.bonusRecorded=true;const c=configFor(s).rush,h=new Date(r.takenAt+28800000).getUTCHours()+new Date(r.takenAt+28800000).getUTCMinutes()/60;r.runnerBonus=c.enabled&&r.category==='takeout'&&r.station===c.station&&h>=c.hours[0]&&h<c.hours[1]?c.amount:0;const b=bonus(s,id,now),m=member(s,id),date=new Date(now+28800000);date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);const key=date.toISOString().slice(0,10);m.weeklyBonuses=m.weeklyBonuses||{};if(b.earned&&!m.weeklyBonuses[key]){m.weeklyBonuses[key]=r.id;r.runnerBonus+=b.amount;}}
module.exports={left,recordBonus,init,collect,apply,restore,settle,invite,view,available,discount,profileCompleted:loyalty.profileCompleted,dailyLogin:loyalty.dailyLogin,acknowledge:loyalty.acknowledge,loyaltyView:loyalty.view};
