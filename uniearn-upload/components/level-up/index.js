const store=require('../../utils/store'),levels=require('../../utils/runner-level');
const TEXT={
 zh:{title:'升级成功',sub:'继续完成订单，解锁下一等级',jobs:'已完成订单',unit:' 单',done:'已升级',plus:'+1 级',cta:'继续使用'},
 en:{title:'Level up!',sub:'Keep completing jobs to reach the next tier',jobs:'Jobs completed',unit:'',done:'Levelled up',plus:'+1 level',cta:'Continue'}
};
// Celebrate completed-job tiers; credit marks and order limits do not change this progression.
function detect(s){
 const p=s.profile||{};if(!p.studentVerified||!p.runnerRulesAccepted)return null;
 const key=p.accountId||'local',tier=levels.tier(p.jobsDone||0),seen=(s.levelSeen||{})[key];
 if(typeof seen!=='number'){
  store.update(x=>{x.levelSeen={...(x.levelSeen||{}),[key]:tier.level};});
  return null;
 }
 if(seen===tier.level)return null;
 store.update(x=>{x.levelSeen={...(x.levelSeen||{}),[key]:tier.level};});
 return tier.level>seen?tier:null;
}
Component({
 data:{open:false,ui:TEXT.zh,level:'',levelNo:1,name:'',perk:'',jobs:0,videoSrc:'',videoFailed:false},
 lifetimes:{attached(){this.watch();this.check();},detached(){this.unwatch();}},
 pageLifetimes:{show(){this.watch();this.check();},hide(){this.unwatch();}},
 methods:{
  watch(){if(!this.off)this.off=require('../../utils/orders').subscribe(()=>this.check());},
  unwatch(){if(this.off)this.off();this.off=null;},
  check(){if(this.data.open)return;const s=store.get(),tier=detect(s);if(!tier)return;const ui=TEXT[s.language==='en'?'en':'zh'],name=s.language==='en'?tier.en:tier.zh;
   this.setData({open:true,ui,level:tier.level,levelNo:tier.level,name,perk:'',jobs:s.profile.jobsDone||0,videoSrc:'',videoFailed:false});
   require('../../utils/yuni-video').prepare('levelup').then(videoSrc=>{if(this.data.open)this.setData({videoSrc});},()=>this.setData({videoFailed:true}));},
  videoError(){this.setData({videoFailed:true});},
  close(){this.setData({open:false,videoSrc:''});},
  noop(){}
 }
});
module.exports={detect};
