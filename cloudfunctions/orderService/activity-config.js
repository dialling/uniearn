'use strict';
const defaults=require('./activity-default.json');
const clone=x=>JSON.parse(JSON.stringify(x));
const check=(ok,message)=>{if(!ok)throw Object.assign(Error(message),{safe:true});};
function validate(input){
 const c=clone(input);check(JSON.stringify(c).length<20000,'活动配置过大。');check(c.version===1&&/^[a-zA-Z0-9_-]{2,60}$/.test(c.id),'活动标识无效。');
 check(['active','paused'].includes(c.pointsProgram?.status)&&c.pointsProgram.rolesCombined===true&&c.pointsProgram.resetOnRankingEnd===false&&c.pointsProgram.balance==='account_level_points','等级积分配置无效，用户与骑手必须共用长期积分。');
 check(Number.isFinite(Date.parse(c.pointsProgram.startedAt)),'请填写积分启用时间。');
 check(['not_open','scheduled','open','ended'].includes(c.status)&&typeof c.scoringEnabled==='boolean','排行榜状态无效。');
 const s=c.schedule;check(s&&s.timezone==='Asia/Shanghai'&&Number.isInteger(s.durationDays)&&s.durationDays>=1&&s.durationDays<=31&&s.maxCampaignsPerMonth===1,'排行榜每月最多一期，每期 1–31 天。');
 for(const k of ['startsAt','endsAt'])check(s[k]==null||Number.isFinite(Date.parse(s[k])),'活动时间格式无效。');
 if(s.startsAt||s.endsAt)check(s.startsAt&&s.endsAt&&Date.parse(s.endsAt)>Date.parse(s.startsAt)&&Date.parse(s.endsAt)-Date.parse(s.startsAt)===s.durationDays*86400000,'起止时间必须与活动天数一致。');
 if(c.status==='open')check(c.scoringEnabled&&s.startsAt&&s.endsAt,'开放排行前必须设置时间并开启排行计分。');
 const kinds=['profile','customer_order','runner_order','weekly_login','referral'];check(Array.isArray(c.tasks)&&c.tasks.length===kinds.length&&new Set(c.tasks.map(t=>t.kind)).size===kinds.length,'需要完整的五类积分任务。');
 for(const t of c.tasks){check(kinds.includes(t.kind)&&typeof t.enabled==='boolean'&&Number.isInteger(t.points)&&t.points>=0&&t.points<=10000,'任务积分需为 0–10000 的整数。');if(t.firstCompletion)check(t.firstCompletion.mode==='total'&&Number.isInteger(t.firstCompletion.points)&&t.firstCompletion.points>=0&&t.firstCompletion.points<=10000,'首单积分为总积分，不能叠加。');if(t.kind==='weekly_login')check(t.daysRequired===7&&t.weekStartsOn==='monday','每周任务需周一至周日全部登录。');}
 const discount=x=>x&&Number.isFinite(x.discountRate)&&x.discountRate>=0&&x.discountRate<=1&&Number.isFinite(x.maxDiscount)&&x.maxDiscount>0&&x.maxDiscount<=100;
 check(discount(c.referralCoupon)&&c.referralCoupon.recipient==='inviter'&&c.referralCoupon.trigger==='invitee_first_completed_order'&&c.referralCoupon.pendingUntilTriggered===true&&Number.isInteger(c.referralCoupon.days)&&c.referralCoupon.days>=1&&c.referralCoupon.days<=365,'邀请券规则无效。');
 let end=0;check(Array.isArray(c.rewards)&&c.rewards.length>0&&c.rewards.length<=10,'排名奖励需有 1–10 档。');for(const r of c.rewards){check(Number.isInteger(r.rankFrom)&&Number.isInteger(r.rankTo)&&r.rankFrom===end+1&&r.rankTo>=r.rankFrom&&r.rankTo<=1000&&discount(r.coupon),'奖励名次需连续、不重复，折扣及上限需有效。');end=r.rankTo;}
 for(const v of [c.title,c.intro,...c.tasks.flatMap(t=>[t.title,t.description]),...c.rewards.map(r=>r.physical).filter(Boolean)])check(v&&['zh','en'].every(k=>typeof v[k]==='string'&&v[k].length<=600),'请填写中英文文案（每项最多 600 字）。');
 return c;
}
const configFor=s=>s.activityConfig||defaults;
const rankingOpen=(c,now)=>['open','scheduled'].includes(c.status)&&c.scoringEnabled&&now>=Date.parse(c.schedule.startsAt)&&now<Date.parse(c.schedule.endsAt);
module.exports={defaults,clone,validate,configFor,rankingOpen};
