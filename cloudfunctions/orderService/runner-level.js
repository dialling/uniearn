const DAY=86400000;
function level(profile={},now=Date.now()){
 const marks=(profile.marks||[]).filter(m=>m.at>now-14*DAY),n=profile.jobsDone||0,on=profile.onTime||0;
 const paused=marks.length>=5&&now<Math.max(...marks.map(m=>m.at))+7*DAY;
 const name=marks.length>=3?'New':n>=40&&on/n>=.95&&!marks.length?'Top':n>=10&&marks.length<=1?'Trusted':'New';
 return {name,limit:name==='Top'?Infinity:name==='Trusted'?25:10,marks,paused,remaining:Math.max(0,(name==='New'?10:40)-n),progress:Math.min(100,n/(name==='New'?10:40)*100)};
}
module.exports={level};
