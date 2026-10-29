const fallback=require('./news-activity');
const CHINA=28800000;
const tr=(value,zh)=>value&&value[zh?'zh':'en']||value&&value.en||value&&value.zh||'';
const finiteDate=value=>value?Date.parse(value):NaN;
const stamp=(value,zh)=>{const d=new Date(value+CHINA);return zh?(d.getUTCMonth()+1)+'月'+d.getUTCDate()+'日':(d.getUTCMonth()+1)+'/'+d.getUTCDate();};
function timing(config,zh,now=Date.now()){
 const c=config||fallback,s=c.schedule||{},start=finiteDate(s.startsAt),end=finiteDate(s.endsAt),scheduled=['scheduled','open'].includes(c.status)&&c.scoringEnabled&&Number.isFinite(start)&&Number.isFinite(end);
 const phase=c.status==='ended'||Number.isFinite(end)&&now>=end?'ended':scheduled?(now<start?'scheduled':'open'):'not_open';
 const target=phase==='scheduled'?start:phase==='open'?end:null;
 let clock=phase==='ended'?(zh?'已结束':'Ended'):(zh?(s.durationDays||14)+' 天 / 期':(s.durationDays||14)+' days / round');
 if(target!==null){const seconds=Math.max(0,Math.floor((target-now)/1000)),days=Math.floor(seconds/86400),pad=n=>String(n).padStart(2,'0');clock=days+(zh?'天 ':'d ')+pad(Math.floor(seconds/3600)%24)+':'+pad(Math.floor(seconds/60)%60)+':'+pad(seconds%60);}
 return {
  rankingPhase:phase,
  rankingShortStatus:zh?({not_open:'暂未开放',scheduled:'即将开始',open:'进行中',ended:'已结束'}[phase]):({not_open:'Coming soon',scheduled:'Upcoming',open:'Live',ended:'Ended'}[phase]),
  rankingPeriod:Number.isFinite(start)&&Number.isFinite(end)?stamp(start,zh)+' – '+stamp(end,zh)+(zh?'（北京时间）':' (Beijing time)'):(zh?'本期 · '+(s.durationDays||14)+' 天挑战':'This round · '+(s.durationDays||14)+' days'),
  rankingTimingLabel:zh?(phase==='open'?'本期剩余时间':phase==='scheduled'?'距离开始':'活动周期'):(phase==='open'?'Time remaining':phase==='scheduled'?'Starts in':'Round duration'),
  rankingClock:clock
 };
}
function couponText(coupon,zh){
 const c=coupon||{};
 return c.discountRate===0?(zh?'免单券':'Free delivery coupon'):zh?Math.round(Number(c.discountRate)*10)+'折配送券':Math.round((1-Number(c.discountRate))*100)+'% off delivery';
}
function rewardRows(config,zh){return (config.rewards||[]).map(r=>({
 rankFrom:r.rankFrom,rankTo:r.rankTo,range:r.rankFrom===r.rankTo?'#'+r.rankFrom:'#'+r.rankFrom+'–'+r.rankTo,
 physical:tr(r.physical,zh),coupon:couponText(r.coupon,zh),
 prize:(tr(r.physical,zh)?tr(r.physical,zh)+' + ':'')+couponText(r.coupon,zh),
 cap:(zh?'最高抵 ¥':'Up to ¥')+Number(r.coupon.maxDiscount).toFixed(2)
}));}
function view(config,snapshot,progression,registered,zh,updatedAt,now=Date.now()){
 const c=config||fallback,clock=timing(c,zh,now),rewards=rewardRows(c,zh),maxRank=rewards[rewards.length-1]?.rankTo||0;
 const matches=!!snapshot&&snapshot.config?.id===c.id&&snapshot.config?.schedule?.startsAt===c.schedule?.startsAt&&snapshot.config?.schedule?.endsAt===c.schedule?.endsAt;
 const visible=['open','ended'].includes(clock.rankingPhase),ready=matches&&Array.isArray(snapshot.leaderboard);
 const rewardFor=rank=>rewards.find(r=>rank>=r.rankFrom&&rank<=r.rankTo);
 const rows=visible&&ready?snapshot.leaderboard.filter(r=>Number.isInteger(r.rank)&&r.rank>0&&r.points>0).map(r=>({...r,mine:registered&&!!r.mine,reward:rewardFor(r.rank)?.prize||''})):[];
 const myRank=registered&&visible&&ready&&Number.isInteger(snapshot.myRank)&&snapshot.myRank>0?snapshot.myRank:null;
 const points=registered?Number(snapshot?.points??progression?.points)||0:0,myPoints=registered&&visible&&ready?Number(snapshot.rankingPoints)||0:0;
 const personalTitle=!registered?(zh?'登录查看名次':'Log in to see your rank'):myRank?(zh?'第 '+myRank+' 名':'Rank '+myRank):clock.rankingPhase==='not_open'||clock.rankingPhase==='scheduled'?(zh?'尚未开榜':'Not started'):(zh?'暂未上榜':'Not ranked');
 const hint=!registered?(zh?'参与校园任务，积攒你的积分':'Earn points through campus tasks'):!visible?(zh?'长期积分继续累计，开榜后才计入本期':'Keep earning level points. Ranking starts when the round opens.'):!ready?(zh?'正在同步本期榜单':'Syncing this round’s leaderboard'):myRank&&rewardFor(myRank)?(zh?'当前名次奖励：':'Current rank reward: ')+rewardFor(myRank).prize:clock.rankingPhase==='ended'?(zh?'本期已结束，期待下次参与':'This round has ended. Join the next round.'):zh?'完成积分任务，争取进入前 '+maxRank+' 名':'Earn points and aim for the top '+maxRank;
 const emptyTitle=!visible?(zh?'排行榜尚未开启':'The leaderboard is not open'):!ready?(zh?'榜单同步中':'Syncing leaderboard'):zh?'本期还没有同学上榜':'No one has ranked this round yet';
 const emptyText=!visible?(zh?'先积攒日常积分，活动开启后完成任务即可参与。':'Earn level points now. Complete tasks after the round opens to rank.'):!ready?(zh?'获取本期真实排名后会显示在这里。':'This round’s rankings will appear when synced.'):clock.rankingPhase==='ended'?(zh?'本期没有积分排名记录。':'No ranking records for this round.'):(zh?'活动期间获得第一笔积分，就能进入榜单。':'Earn your first points during the round to join the board.');
 return {...clock,rankingRows:rows,rankingRewards:rewards,rankingRewardSeats:maxRank,
  rankingTopPrize:rewards[0]?.prize||'',rankingTopCap:rewards[0]?.cap||'',
  rankingPrizeLabel:zh?(clock.rankingPhase==='not_open'||clock.rankingPhase==='scheduled'?'奖励预告':'本期最高奖励'):(visible?'Top reward':'Reward preview'),
  rankingParticipants:visible&&ready?(Number.isInteger(snapshot.participantCount)?snapshot.participantCount:rows.length>=100?'100+':rows.length):'—',
  rankingMyRank:myRank,rankingMyPoints:myPoints,rankingLevelPoints:points,rankingPersonalTitle:personalTitle,rankingPersonalHint:hint,
  rankingEmptyTitle:emptyTitle,rankingEmptyText:emptyText,
  rankingUpdated:visible&&ready&&updatedAt?(zh?'更新于 ':'Updated ')+new Date(updatedAt+CHINA).toISOString().slice(11,16):'',
  rankingRuleText:zh?'按活动期间新增积分排名，长期积分不清零。同分时，先达到当前积分的同学优先。每月最多一期，起止时间以本期展示为准。':'Only points earned during this round count. Lifetime points stay intact. Ties go to whoever reached the score first. At most one round per month; see this round’s dates.'
 };
}
module.exports={timing,view};
