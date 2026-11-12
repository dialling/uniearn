const store=require('../../utils/store'),motion=require('../../utils/motion'),checkin=require('../../utils/checkin');
const TEXT={
 zh:{title:'升级成功',sub:'继续积累积分，解锁下一等级',points:'当前积分',done:'Yuni 等级已升级',plus:'+1 级',cta:'继续使用',weekTitle:'连续登录奖励',weekSub:'已连续 7 天打开 UniEarn',weekPoints:'额外获得积分',unit:'积分'},
 en:{title:'Level up!',sub:'Keep earning points to reach the next tier',points:'Points',done:'Yuni level unlocked',plus:'+1 level',cta:'Continue',weekTitle:'7-day login reward',weekSub:'You opened UniEarn 7 days in a row',weekPoints:'Bonus points',unit:'points'}
};
Component({
 data:{motionEnabled:motion.enabled(),open:false,acknowledging:false,noticeId:'',noticeType:'',ui:TEXT.zh,level:'',levelNo:1,name:'',points:0,bonusPoints:10,videoSrc:'',videoFailed:false},
 lifetimes:{attached(){this.watch();this.check();},detached(){this.unwatch();}},
 pageLifetimes:{show(){this.watch();this.check();},hide(){this.unwatch();}},
 methods:{
  watch(){if(!this.offStore)this.offStore=store.subscribe(()=>this.check());if(!this.offMotion)this.offMotion=motion.watch(()=>this.check());if(!this.off)this.off=require('../../utils/orders').subscribe(()=>this.check());},
  unwatch(){if(this.offStore)this.offStore();this.offStore=null;if(this.offMotion)this.offMotion();this.offMotion=null;if(this.off)this.off();this.off=null;},
  check(){if(!motion.enabled()){this.setData({motionEnabled:false,open:false,videoSrc:''});return;}if(!this.data.motionEnabled)this.setData({motionEnabled:true});if(this.data.open||this.data.acknowledging||checkin.pending())return;const s=store.get(),progression=s.progression||{},notice=(progression.notices||[]).find(n=>n.type==='level'||n.type==='weekly');if(!notice)return;
   const ui=TEXT[s.language==='en'?'en':'zh'],level=require('../../utils/yuni-level').levels[notice.level-1];
   this.setData({open:true,acknowledging:false,noticeId:notice.id,noticeType:notice.type,ui,level:notice.level||0,levelNo:notice.level||0,name:level?(s.language==='en'?level.en:level.zh):'',points:progression.points||0,bonusPoints:notice.points||10,videoSrc:'',videoFailed:notice.type==='weekly'});
   if(notice.type==='level')require('../../utils/yuni-video').prepare('levelup').then(videoSrc=>{if(motion.enabled()&&this.data.open&&this.data.noticeId===notice.id)this.setData({videoSrc});},()=>{if(motion.enabled()&&this.data.open&&this.data.noticeId===notice.id)this.setData({videoFailed:true});});
  },
  videoError(){this.setData({videoFailed:true});},
  close(){if(this.data.acknowledging)return;const id=this.data.noticeId;this.setData({open:false,acknowledging:true,videoSrc:''});require('../../utils/orders').act('ackLoyaltyNotice',{noticeId:id}).catch(()=>{}).finally(()=>{this.setData({acknowledging:false});this.check();});},
  noop(){}
 }
});
