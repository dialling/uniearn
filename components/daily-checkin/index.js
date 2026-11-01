const store=require('../../utils/store'),motion=require('../../utils/motion'),checkin=require('../../utils/checkin'),media=require('../../utils/checkin-media');
const TEXT={
 zh:{title:'签到成功',streak:'已连续签到',days:'天',reward:'连续 7 天签到奖励',credited:'积分已到账',today:'今日签到已完成',goal:'每连续签到 7 天可得 10 积分',continue:'继续使用',collect:'收下奖励',day:'第',dayUnit:'天',close:'关闭'},
 en:{title:'Checked in!',streak:'Streak:',days:'days',reward:'7-day streak reward',credited:'Points added to your account',today:'Today’s check-in is complete',goal:'Earn 10 points for every 7 consecutive days',continue:'Continue',collect:'Collect reward',day:'Day',dayUnit:'',close:'Close'}
};
Component({
 data:{open:false,ui:TEXT.zh,motionEnabled:motion.enabled(),videoSrc:'',videoFailed:false,videoDone:false,posterSrc:media.daily.poster,stageHeight:Math.round(596*media.daily.height/media.daily.width),streak:1,cycleDay:1,points:0,days:[],hint:''},
 lifetimes:{attached(){this.visible=true;this.watch();this.check();},detached(){this.visible=false;this.hide();this.unwatch();}},
 pageLifetimes:{show(){this.visible=true;this.watch();this.check();},hide(){this.visible=false;this.hide();this.unwatch();}},
 methods:{
  watch(){if(!this.off)this.off=store.subscribe(()=>this.check());},
  unwatch(){if(this.off)this.off();this.off=null;},
  check(){
   if(!this.visible)return;
   if(this.data.open){
    const s=store.get();if(s.profile.loggedOut||s.profile.accountId!==this.token?.accountId){this.hide(false);return;}
    const enabled=motion.enabled();if(this.data.motionEnabled!==enabled)this.setData({motionEnabled:enabled,videoSrc:enabled?this.data.videoSrc:''});return;
   }
   const n=checkin.claim();if(!n)return;this.token=n;
   const en=store.get().language==='en',ui=TEXT[en?'en':'zh'],remaining=7-n.cycleDay,clip=n.points?media.weekly:media.daily;
   this.setData({open:true,ui,motionEnabled:motion.enabled(),videoSrc:'',videoFailed:false,videoDone:false,posterSrc:clip.poster,stageHeight:Math.round(596*clip.height/clip.width),streak:n.streak,cycleDay:n.cycleDay,points:n.points,
    days:Array.from({length:7},(_,i)=>({day:i+1,done:i<n.cycleDay,today:i+1===n.cycleDay})),
    hint:n.points?ui.credited:remaining?(en?remaining+' more consecutive '+(remaining===1?'day':'days')+' to earn 10 points':'再连续签到 '+remaining+' 天可得 10 积分'):ui.today});
   if(motion.enabled())require('../../utils/yuni-video').prepare(clip.kind).then(src=>{if(this.visible&&this.data.open&&this.token===n&&motion.enabled())this.setData({videoSrc:src});},()=>{if(this.data.open&&this.token===n)this.setData({videoFailed:true});});
  },
  videoError(){this.setData({videoFailed:true,videoSrc:''});},
  videoEnded(){this.setData({videoDone:true,videoSrc:''});},
  close(){this.hide();},
  hide(ack=true){
   const token=this.token;if(!token)return;this.token=null;this.setData({open:false,videoSrc:''});checkin.release(token.key);
   if(ack&&store.get().profile.accountId===token.accountId&&!store.get().profile.loggedOut)require('../../utils/orders').act('ackLoyaltyNotice',{noticeId:token.id}).catch(()=>{});
  },
  noop(){}
 }
});
