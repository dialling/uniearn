const fallback=require('./news-activity');
const revision=c=>{const m=/^admin-(\d+)$/.exec(c&&c.revision||'');return m?Number(m[1]):0;};
function latest(current,incoming){if(!incoming)return current||fallback;if(!current||revision(incoming)>=revision(current))return incoming;return current;}
function display(config,zh,now=Date.now()){
 const c=config||fallback,tr=x=>x&&x[zh?'zh':'en']||x&&x.en||x&&x.zh||'',schedule=c.schedule||{};
 const open=['open','scheduled'].includes(c.status)&&c.scoringEnabled&&now>=Date.parse(schedule.startsAt)&&now<Date.parse(schedule.endsAt);
 const ended=c.status==='ended'||schedule.endsAt&&now>=Date.parse(schedule.endsAt),active=c.pointsProgram?.status==='active';
 return {
  activityTitle:tr(c.title),activityIntro:tr(c.intro),activityPaused:!active,
  activityStatusLabel:zh?(active?'日常积分已开启':'日常积分已暂停'):(active?'Daily points active':'Daily points paused'),
  rankingStatusLabel:zh?(open?'排行榜进行中':ended?'排行榜已结束':c.status==='scheduled'?'排行榜已安排':'排行榜暂未开放'):(open?'Ranking open':ended?'Ranking ended':c.status==='scheduled'?'Ranking scheduled':'Ranking not open'),
  rankingDescription:zh?'每期 '+schedule.durationDays+' 天，每月最多一期。':'Each event lasts '+schedule.durationDays+' days, at most once per month.',
  activityTasks:(c.tasks||[]).filter(t=>t.enabled).map(t=>({...t,label:tr(t.title),detail:tr(t.description),firstLabel:t.firstCompletion?(zh?'该角色首单共 '+t.firstCompletion.points+' 分，不叠加普通奖励':'First completion in this role: '+t.firstCompletion.points+' points total'):''})),
  activityRewards:(c.rewards||[]).map(r=>({range:r.rankFrom===r.rankTo?String(r.rankFrom):r.rankFrom+'~'+r.rankTo,prize:(r.physical&&tr(r.physical)?tr(r.physical)+' + ':'')+(r.coupon.discountRate===0?(zh?'免单':'Free order'):zh?Math.round(r.coupon.discountRate*10)+' 折券':Math.round((1-r.coupon.discountRate)*100)+'% off'),cap:(zh?'最高抵扣 ¥':'Up to ¥')+r.coupon.maxDiscount}))
 };
}
module.exports={latest,display};
