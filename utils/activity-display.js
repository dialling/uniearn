const fallback=require('./news-activity');
const {fairnessOf}=require('./activity-fairness');
const revision=c=>{const m=/^admin-(\d+)$/.exec(c&&c.revision||'');return m?Number(m[1]):0;};
function latest(current,incoming){if(!incoming)return current||fallback;if(!current||revision(incoming)>=revision(current))return incoming;return current;}
function limitLabel(kind,fair,zh){
 if(kind==='profile')return fair.profileCountsForRanking?(zh?'计入长期等级，活动期内也计入排行':'Counts toward your level and the current round'):(zh?'只计入长期等级，不计入本期排行':'Counts toward your level only, not this round');
 if(kind==='customer_order')return zh?`每日最多计入 ${fair.customerOrdersPerDay} 单，超出仍可下单但不计分`:`Up to ${fair.customerOrdersPerDay} orders count per day. Extra orders still go through, without points.`;
 if(kind==='runner_order')return zh?`每日最多计入 ${fair.runnerOrdersPerDay} 单，超出仍可配送但不计分`:`Up to ${fair.runnerOrdersPerDay} jobs count per day. Extra jobs can still be completed, without points.`;
 if(kind==='weekly_login')return fair.checkinGracePerCycle>0?(zh?`每个 7 天周期可保护 ${fair.checkinGracePerCycle} 次漏签，再漏则本周期从第 1 天重计`:`Each 7-day cycle protects ${fair.checkinGracePerCycle} missed day. Another miss restarts that cycle.`):(zh?'漏签后从第 1 天重新累计':'A missed day restarts the streak.');
 if(kind==='referral')return zh?`排行榜每期最多计入 ${fair.referralRankingPerRound} 位新同学；等级积分仍按每次绑定发放`:`Ranking counts at most ${fair.referralRankingPerRound} new classmates per round. Level points still apply to every link.`;
 return '';
}
function display(config,zh,now=Date.now()){
 const c=config||fallback,tr=x=>x&&x[zh?'zh':'en']||x&&x.en||x&&x.zh||'',schedule=c.schedule||{},fair=fairnessOf(c);
 const open=['open','scheduled'].includes(c.status)&&c.scoringEnabled&&now>=Date.parse(schedule.startsAt)&&now<Date.parse(schedule.endsAt);
 const ended=c.status==='ended'||schedule.endsAt&&now>=Date.parse(schedule.endsAt),active=c.pointsProgram?.status==='active';
 return {
  activityTitle:tr(c.title),activityIntro:tr(c.intro),activityPaused:!active,
  activityStatusLabel:zh?(active?'日常积分已开启':'日常积分已暂停'):(active?'Daily points active':'Daily points paused'),
  rankingStatusLabel:zh?(open?'排行榜进行中':ended?'排行榜已结束':c.status==='scheduled'?'排行榜已安排':'排行榜暂未开放'):(open?'Ranking open':ended?'Ranking ended':c.status==='scheduled'?'Ranking scheduled':'Ranking not open'),
  rankingDescription:zh?'每期 '+schedule.durationDays+' 天，每月最多一期。':'Each event lasts '+schedule.durationDays+' days, at most once per month.',
  activityTasks:(c.tasks||[]).filter(t=>t.enabled).map(t=>t.kind==='weekly_login'?{...t,...fallback.tasks.find(rule=>rule.kind==='weekly_login'),enabled:t.enabled}:t).map(t=>({...t,label:tr(t.title),detail:tr(t.description),firstLabel:t.firstCompletion?(zh?'该角色首单共 '+t.firstCompletion.points+' 分，不叠加普通奖励':'First completion in this role: '+t.firstCompletion.points+' points total'):'',limitLabel:limitLabel(t.kind,fair,zh)}))
 };
}
function withProgress(tasks,progress,config,zh){
 const fair=fairnessOf(config),p=progress||{};
 const customerCap=Number.isInteger(p.customerCap)?p.customerCap:fair.customerOrdersPerDay;
 const runnerCap=Number.isInteger(p.runnerCap)?p.runnerCap:fair.runnerOrdersPerDay;
 const referralCap=Number.isInteger(p.referralRankingCap)?p.referralRankingCap:fair.referralRankingPerRound;
 return (tasks||[]).map(t=>{
  let progressLabel='',action='',actionLabel='';
  if(t.kind==='profile'){
   progressLabel=p.profile?(zh?'已完成':'Done'):(zh?'尚未完成':'Not finished');
   if(!p.profile){action='profile';actionLabel=zh?'去完善':'Complete profile';}
  }else if(t.kind==='customer_order'){
   progressLabel=zh?`今日已计入 ${p.customerToday||0}/${customerCap} 单`:`Counted today ${p.customerToday||0}/${customerCap}`;
   action='post';actionLabel=zh?'去发布':'Post an order';
  }else if(t.kind==='runner_order'){
   progressLabel=zh?`今日已计入 ${p.runnerToday||0}/${runnerCap} 单`:`Counted today ${p.runnerToday||0}/${runnerCap}`;
   action='jobs';actionLabel=zh?'去接单':'Find jobs';
  }else if(t.kind==='weekly_login'){
   const c=p.checkin;
   progressLabel=c?(zh?`连续 ${c.streak||0} 天 · 本周期 ${c.cycleDay||0}/7`+(c.graceUsed?' · 保护已用':''):`Streak ${c.streak||0} · cycle ${c.cycleDay||0}/7`+(c.graceUsed?' · grace used':'')):(zh?'登录后自动签到':'Check in by signing in');
   action='levels';actionLabel=zh?'查看签到':'View check-in';
  }else if(t.kind==='referral'){
   progressLabel=zh?`本期排行已计入 ${p.referralRankingUsed||0}/${referralCap} 人`:`Ranking credits ${p.referralRankingUsed||0}/${referralCap} this round`;
   action='invite';actionLabel=zh?'去邀请':'Invite';
  }
  return {...t,progressLabel,action,actionLabel};
 });
}
module.exports={latest,display,withProgress,limitLabel};
