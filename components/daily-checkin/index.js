const store=require('../../utils/store'),motion=require('../../utils/motion'),checkin=require('../../utils/checkin');
const TEXT={
 zh:{title:'喂 Yuni',subtitle:'每天一条小鱼干，Yuni 好开心',hungry:'我饿啦！',chew:'啊呜，真好吃！',happy:'好吃！谢谢你！',bucket:'小鱼干桶',feed:'喂 Yuni',bigFeed:'喂大鱼',eating:'正在吃小鱼干…',fed:'今天已喂 · 00:00 再来',dailyReward:'每日签到奖励',reward:'每日签到 + 连续 7 天奖励',credited:'积分已到账',today:'今日签到已完成',goal:'每天签到得 2 积分，连续 7 天额外得 10 积分',collected:'今日已领取',collect:'收下奖励',continue:'继续使用',day:'第',dayUnit:'天',todayLabel:'今天',close:'关闭',cash:'积分无现金价值',bonus:'奖励'},
 en:{title:'Feed Yuni',subtitle:'One dried fish a day keeps Yuni happy',hungry:'I’m hungry!',chew:'Nom nom!',happy:'Yum! Thank you!',bucket:'Dried fish bucket',feed:'Feed Yuni',bigFeed:'Feed the big fish',eating:'Enjoying a little fish…',fed:'Fed today · next fish at 00:00',dailyReward:'Daily check-in reward',reward:'Daily + 7-day streak reward',credited:'Points added to your account',today:'Today’s check-in is complete',goal:'Earn 2 points daily + 10 extra for every 7-day streak',collected:'Already claimed',collect:'Collect reward',continue:'Continue',day:'Day',dayUnit:'',todayLabel:'Today',close:'Close',cash:'Points have no cash value',bonus:'bonus'}
};
Component({
 data:{open:false,ui:TEXT.zh,motionEnabled:motion.enabled(),phase:'waiting',collected:false,fed:false,feeding:false,streak:1,cycleDay:1,points:0,dailyPoints:0,weeklyPoints:0,days:[],hint:'',floating:'',pose:0},
 lifetimes:{attached(){this.visible=true;this.watch();this.check();},detached(){this.visible=false;this.hide();this.unwatch();}},
 pageLifetimes:{show(){this.visible=true;this.watch();this.check();},hide(){this.visible=false;this.hide();this.unwatch();}},
 methods:{
  watch(){if(!this.off)this.off=store.subscribe(()=>this.check());},
  unwatch(){if(this.off)this.off();this.off=null;},
  cancelAnimation(){(this.timers||[]).forEach(clearTimeout);this.timers=[];this.run=(this.run||0)+1;},
  later(ms,fn){const run=this.run,token=this.token;this.timers=this.timers||[];this.timers.push(setTimeout(()=>{if(this.visible&&this.data.open&&this.token===token&&this.run===run)fn();},ms));},
  refreshCopy(){
   const en=store.get().language==='en',ui=TEXT[en?'en':'zh'],d=this.data,completed=d.fed?d.cycleDay:d.cycleDay-1,remaining=7-d.cycleDay;
   const streakShown=d.fed?d.streak:Math.max(0,d.streak-1);
   let feedLabel=ui.feed;
   if(d.points>0)feedLabel=(d.weeklyPoints?ui.bigFeed:ui.feed)+(en?' · ':' · ')+(d.dailyPoints?'+'+d.dailyPoints+(en?' pts':' 积分'):'')+(d.weeklyPoints?(d.dailyPoints?' +':'')+d.weeklyPoints+' '+ui.bonus:'');
   this.setData({ui,streakText:en?streakShown+'-day streak':'连续 '+streakShown+' 天',feedLabel:d.fed?ui.fed:d.feeding?ui.eating:feedLabel,
    speech:d.phase==='waiting'||d.phase==='flying'?ui.hungry:d.phase==='chewing'?ui.chew:ui.happy,
    rewardTitle:d.weeklyPoints?ui.reward:ui.dailyReward,
    hint:d.fed?(d.points?ui.credited:ui.today):d.weeklyPoints?(en?'An extra 10 points today':'今天可获得额外 10 积分'):(en?(remaining+1)+' more consecutive days to earn 10 extra points':'再连续 '+(remaining+1)+' 天，获得额外 10 积分'),
    weekCount:en?completed+' of 7 fish this week':'本轮已喂 '+completed+' / 7 天',weekBonus:en?'Day 7: +10 extra':'第 7 天：额外 +10',
    days:Array.from({length:7},(_,i)=>({day:i+1,done:i<completed,today:i+1===d.cycleDay,label:i+1===d.cycleDay?ui.todayLabel:(en?'Day '+(i+1):'第 '+(i+1)+' 天')}))});
  },
  check(){
   if(!this.visible)return;
   if(this.data.open){
    const s=store.get();if(s.profile.loggedOut||s.profile.accountId!==this.token?.accountId){this.hide(false);return;}
    const enabled=motion.enabled();if(this.data.motionEnabled!==enabled){this.setData({motionEnabled:enabled});if(!enabled&&this.data.feeding){this.cancelAnimation();this.finishFeed();}}
    if(this.data.ui!==TEXT[s.language==='en'?'en':'zh'])this.refreshCopy();return;
   }
   const n=checkin.claim();if(n)this.showNotice(n);
  },
  openFromJourney(){
   if(this.data.open)return true;
   if(!this.visible)return false;
   const n=checkin.claim(true);if(!n)return false;this.showNotice(n);return true;
  },
  showNotice(n){
   this.token=n;this.rewardCompleting=false;this.cancelAnimation();const fed=checkin.wasFed(n)||checkin.wasCollected(n),collected=!!n.preview&&fed;if(collected)checkin.markCollected(n);
   const weeklyPoints=Number(n.weeklyPoints??(n.cycleDay===7?Math.min(10,n.points):0))||0;
   const dailyPoints=Number(n.dailyPoints??Math.max(0,n.points-weeklyPoints))||0;
   this.setData({open:true,collected,motionEnabled:motion.enabled(),phase:fed?'happy':'waiting',pose:fed?2:0,feeding:false,fed,floating:'',streak:n.streak,cycleDay:n.cycleDay,points:n.points,dailyPoints,weeklyPoints});this.refreshCopy();if(fed&&!n.preview)this.completeReward();
  },
  // The existing first-login check-in has already credited this server notice.
  // Feed only presents that reward; it must never call a points/check-in API.
  feed(){
   if(!this.token||!this.data.open||this.data.feeding||this.data.fed)return;
   this.cancelAnimation();
   if(!motion.enabled()){this.finishFeed();return;}
   this.setData({feeding:true,phase:'flying',floating:''});this.refreshCopy();
   this.later(740,()=>{this.setData({pose:1,phase:'chewing'});this.refreshCopy();});
   this.later(1840,()=>{this.setData({pose:2,phase:'happy'});this.refreshCopy();});
   this.later(2020,()=>this.floatReward(false));
   if(this.data.weeklyPoints)this.later(2720,()=>this.floatReward(true));
   this.later(this.data.weeklyPoints?3200:2400,()=>this.finishFeed(true));
   this.later(this.data.weeklyPoints?3740:3040,()=>this.setData({floating:''}));
  },
  floatReward(bonus){const points=bonus?this.data.weeklyPoints:this.data.dailyPoints;if(points)this.setData({floating:'+'+points+(bonus?' '+this.data.ui.bonus:(store.get().language==='en'?' pts':' 积分')),floatKey:bonus?'bonus':'daily'});},
  finishFeed(keepFloating=false){if(!this.token||!this.data.open)return;checkin.markFed(this.token);this.setData({fed:true,feeding:false,collected:false,phase:'happy',pose:2,floating:keepFloating?this.data.floating:''});this.refreshCopy();this.completeReward();},
  completeReward(){if(!this.token||this.rewardCompleting)return;this.rewardCompleting=true;checkin.markCollected(this.token);this.ackNotice(this.token);this.later(1200,()=>this.hide());},
  collectReward(){if(this.token&&this.data.collected)this.close();},
  ackNotice(token){
   const p=store.get().profile;if(!token||token.ackSent||token.acknowledged||p.accountId!==token.accountId||p.loggedOut)return;
   token.ackSent=true;require('../../utils/orders').act('ackLoyaltyNotice',{noticeId:token.id}).catch(()=>{});
  },
  close(){this.hide();},
  hide(ack=true){
   this.cancelAnimation();const token=this.token;if(!token)return;this.token=null;this.setData({open:false,feeding:false,floating:''});checkin.release(token.key);
   if(ack&&!token.preview)this.ackNotice(token);
  },
  noop(){}
 }
});
