const fallback=require('./news-activity').fairness;
function fairnessOf(config){
 const base=fallback,raw=config&&config.fairness||{};
 const int=(value,key,min,max)=>{const n=Number(value);return Number.isInteger(n)&&n>=min&&n<=max?n:base[key];};
 return {
  customerOrdersPerDay:int(raw.customerOrdersPerDay,'customerOrdersPerDay',1,10),
  runnerOrdersPerDay:int(raw.runnerOrdersPerDay,'runnerOrdersPerDay',1,20),
  referralRankingPerRound:int(raw.referralRankingPerRound,'referralRankingPerRound',0,30),
  profileCountsForRanking:raw.profileCountsForRanking===true,
  checkinGracePerCycle:int(raw.checkinGracePerCycle,'checkinGracePerCycle',0,1),
  dailyCheckinPoints:int(raw.dailyCheckinPoints,'dailyCheckinPoints',0,20)
 };
}
module.exports={fairnessOf};
