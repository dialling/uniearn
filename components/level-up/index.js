const store=require('../../utils/store'),levels=require('../../utils/runner-level');
const RANK={New:1,Trusted:2,Top:3};
const TEXT={
 zh:{title:'升级成功',sub:'现在的你，能接更多单',jobs:'已完成订单',unit:' 单',done:'已升级',plus:'+1 级',cta:'继续使用',names:{New:'新手跑手',Trusted:'可信赖跑手',Top:'顶级跑手'},perks:{Trusted:'单次行程赏金上限提升到 ¥25',Top:'单次行程赏金不再设上限'}},
 en:{title:'Level up!',sub:'You can take bigger trips now',jobs:'Jobs completed',unit:'',done:'Levelled up',plus:'+1 level',cta:'Continue',names:{New:'New runner',Trusted:'Trusted runner',Top:'Top runner'},perks:{Trusted:'Trip limit raised to ¥25',Top:'No trip limit any more'}}
};
// Compares the runner level with the last one this account has seen; returns the new level only when it went up.
function detect(s){
 const p=s.profile||{};if(!p.studentVerified||!p.runnerRulesAccepted)return null;
 const key=p.accountId||'local',name=levels.level(p).name,seen=(s.levelSeen||{})[key];
 if(seen===name)return null;
 store.update(x=>{x.levelSeen={...(x.levelSeen||{}),[key]:name};});
 return seen&&RANK[name]>RANK[seen]?name:null;
}
Component({
 data:{open:false,ui:TEXT.zh,level:'',levelNo:1,name:'',perk:'',jobs:0,videoSrc:'',videoFailed:false},
 lifetimes:{attached(){this.watch();this.check();},detached(){this.unwatch();}},
 pageLifetimes:{show(){this.watch();this.check();},hide(){this.unwatch();}},
 methods:{
  watch(){if(!this.off)this.off=require('../../utils/orders').subscribe(()=>this.check());},
  unwatch(){if(this.off)this.off();this.off=null;},
  check(){if(this.data.open)return;const s=store.get(),name=detect(s);if(!name)return;const ui=TEXT[s.language==='en'?'en':'zh'];
   this.setData({open:true,ui,level:name,levelNo:RANK[name],name:ui.names[name],perk:ui.perks[name]||'',jobs:s.profile.jobsDone||0,videoSrc:'',videoFailed:false});
   require('../../utils/yuni-video').prepare('levelup').then(videoSrc=>{if(this.data.open)this.setData({videoSrc});},()=>this.setData({videoFailed:true}));},
  videoError(){this.setData({videoFailed:true});},
  close(){this.setData({open:false,videoSrc:''});},
  noop(){}
 }
});
module.exports={detect};
