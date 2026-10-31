// Source tiers (mini program 1 server/src/level.js): 5 levels by completed jobs.
const TIERS=[{level:1,zh:'青铜',en:'Bronze',min:0},{level:2,zh:'白银',en:'Silver',min:5},{level:3,zh:'黄金',en:'Gold',min:20},{level:4,zh:'铂金',en:'Platinum',min:50},{level:5,zh:'钻石',en:'Diamond',min:100}];
function tier(count){
 const n=Math.max(0,Number(count)||0);let cur=TIERS[0];
 for(const t of TIERS)if(n>=t.min)cur=t;
 const i=TIERS.indexOf(cur),next=TIERS[i+1]||null,from=cur.min,to=next?next.min:cur.min;
 return {level:cur.level,zh:cur.zh,en:cur.en,name:cur.zh,count:n,min:cur.min,next:next?{level:next.level,zh:next.zh,en:next.en,min:next.min,remain:Math.max(0,next.min-n)}:null,remaining:next?Math.max(0,next.min-n):0,progress:next?Math.min(100,Math.max(0,(n-from)/(to-from)*100)):100};
}
const DAY=86400000;
function level(profile={},now=Date.now()){
 const marks=(profile.marks||[]).filter(m=>m.at>now-14*DAY),n=profile.jobsDone||0;
 const paused=marks.length>=5&&now<Math.max(...marks.map(m=>m.at))+7*DAY;
 const name=marks.length>=3?'New':n>=40&&!marks.length?'Top':n>=10&&marks.length<=1?'Trusted':'New';
 return {name,limit:name==='Top'?Infinity:name==='Trusted'?25:10,marks,paused,remaining:Math.max(0,(name==='New'?10:40)-n),progress:tier(n).progress};
}
module.exports={tier,level};
