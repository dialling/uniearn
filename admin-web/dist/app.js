
"use strict";
/* ============ time helpers (China time, UTC+8) ============ */
const MIN=6e4,HR=36e5,DAY=864e5,TZ=8*HR;
let NOW=Date.now();
const cn=ms=>new Date(ms+TZ);
const dayStart=ms=>{const d=cn(ms);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())-TZ};
let TODAY0=dayStart(NOW);
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const p2=n=>String(n).padStart(2,'0');
const fHM=ms=>{const d=cn(ms);return p2(d.getUTCHours())+':'+p2(d.getUTCMinutes())};
let LANG='zh';try{const l=localStorage.getItem('uniearn-admin-lang');if(l==='zh'||l==='en')LANG=l}catch(e){}
const ZWD='日一二三四五六';
const fDay=ms=>{const d=cn(ms);return LANG==='zh'?(d.getUTCMonth()+1)+'月'+d.getUTCDate()+'日':MON[d.getUTCMonth()]+' '+d.getUTCDate()};
const fWDay=ms=>{const d=cn(ms);return LANG==='zh'?'周'+ZWD[d.getUTCDay()]+' '+d.getUTCDate()+'日':WD[d.getUTCDay()]+' '+d.getUTCDate()};
const fDayW=ms=>{const d=cn(ms);return LANG==='zh'?(d.getUTCMonth()+1)+'月'+d.getUTCDate()+'日 周'+ZWD[d.getUTCDay()]:WD[d.getUTCDay()]+' '+d.getUTCDate()+' '+MON[d.getUTCMonth()]};
const fDT=ms=>ms==null?'—':(dayStart(ms)===TODAY0?(LANG==='zh'?'今天 ':'Today ')+fHM(ms):fDay(ms)+(LANG==='zh'?' ':', ')+fHM(ms));
const hourOf=ms=>cn(ms).getUTCHours();
const ago=ms=>{const m=Math.round((NOW-ms)/MIN),z=LANG==='zh';if(m<1)return z?'刚刚':'just now';if(m<60)return z?m+' 分钟前':m+' min ago';const h=Math.round(m/60);if(h<24)return z?h+' 小时前':h+' h ago';const d=Math.round(h/24);return z?d+' 天前':d+(d===1?' day ago':' days ago')};
const fMin=m=>{if(m==null||isNaN(m))return'—';const z=LANG==='zh';return m<60?Math.round(m)+(z?' 分钟':' min'):(m<1440?(m/60).toFixed(m<600?1:0)+(z?' 小时':' h'):(m/1440).toFixed(1)+(z?' 天':' d'))};
const Y=f=>'¥'+(f/100).toFixed(2);
const Y0=f=>'¥'+(f/100).toLocaleString('en-US',{minimumFractionDigits:f%100?2:0,maximumFractionDigits:2});
const pct=(a,b)=>b?Math.round(a/b*100):0;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const median=a=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2};
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const sum=a=>a.reduce((x,y)=>x+y,0);

/* ============ seeded random ============ */
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const R=rng(20261022);
const pick=a=>a[Math.floor(R()*a.length)];
const int=(a,b)=>a+Math.floor(R()*(b-a+1));
const wpick=(items,w)=>{let t=sum(w),r=R()*t;for(let i=0;i<items.length;i++){r-=w[i];if(r<=0)return items[i]}return items[items.length-1]};
const gauss=()=>{let u=0,v=0;while(!u)u=R();while(!v)v=R();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
const logn=(med,s)=>med*Math.exp(gauss()*s);

/* ============ places & types ============ */
const AREAS=[{id:'WY',en:'Wen Yuan',zh:'文缘'},{id:'WX',en:'Wen Xing',zh:'文星'},{id:'WC',en:'Wen Cui',zh:'文萃'},{id:'WH',en:'Wen Hui',zh:'文汇'}];
const AREA=Object.fromEntries(AREAS.map(a=>[a.id,a]));
const areaL=a=>{const x=typeof a==='string'?AREA[a]:a;return x?(LANG==='zh'?x.zh:x.en):''};
const BUILDINGS=[];
const LOCKER_SPOTS=['Lobby shelf, left of the main door','Ground floor, next to the vending machines','Outside the side door, under the canopy','Lobby, by the notice board'];
[['WY','D',6],['WX','A',6],['WC','C',5],['WH','',5]].forEach(([a,pre,n])=>{for(let i=1;i<=n;i++){const code=pre?pre+p2(i):'#'+i;
  BUILDINGS.push({id:a+i,area:a,code,name:AREA[a].en+' '+code,gender:i%3===0?'Male':'Female',lockerLoc:i%3===1?LOCKER_SPOTS[(i+a.length)%4]:''})}});
const BLD=Object.fromEntries(BUILDINGS.map(b=>[b.id,b]));
const maskRoom=r=>r?r.slice(0,-2)+'**':'—';
const SURN=['Chen','Wang','Li','Zhang','Liu','Yang','Huang','Zhao','Wu','Zhou','Xu','Sun','Lin','Xie','Guo'];
const PICKUPS=[
  {id:'NG',name:'North gate',kind:'Gate',active:true},
  {id:'SG',name:'South gate',kind:'Gate',active:true},
  {id:'EG',name:'East gate',kind:'Gate',active:true},
  {id:'NL',name:'North gate food locker',kind:'Food locker',active:true},
  {id:'HL',name:'Hanlin parcel station',kind:'Parcel station',active:true},
  {id:'WS',name:'Wencui station',kind:'Parcel station',active:true}];
const PU=Object.fromEntries(PICKUPS.map(p=>[p.id,p]));
const TYPES={takeaway:'Takeaway',parcel:'Parcel',nightMarket:'Night market',purchase:'Purchasing agent'};
const TYPE_KEYS=Object.keys(TYPES);

/* ============ members ============ */
const PINYIN={'小鹿':'Xiaolu','橙子':'Chengzi','阿悦':'Ayue','小鱼':'Xiaoyu','栗子':'Lizi','小雨':'Xiaoyu','阿杰':'Ajie','糖糖':'Tangtang','奶茶':'Naicha','小熊':'Xiaoxiong','葡萄':'Putao','柚子':'Youzi','布丁':'Buding','芒果':'Mangguo','小满':'Xiaoman','阿宁':'Aning','豆豆':'Doudou','七七':'Qiqi','小白':'Xiaobai','乐乐':'Lele'};
const NICK=['小鹿','橙子','阿悦','Momo','Kiki','小鱼','栗子','Yuki','Coco','小雨','阿杰','Leo','Mia','Lucas','Echo','Nina','糖糖','奶茶','小熊','Ivy Z','Zoe','Ryan','Jason','Amy','Lily','Cathy','Eric','Tony','葡萄','柚子','布丁','Ava','Sunny','Ella','Ken','Max','芒果','小满','Kevin W','Ming','Hana','Tina','阿宁','Joy','Chloe','Ben','Jade','Ruby','豆豆','七七','Luna','小白','Sam','Grace','Wendy','乐乐','Tim','Ada','Owen','Daisy'];
const USERS=[];
const STAFF_TEST=6;
function mkPhone(){const p='1'+pick(['3','5','7','8','9'])+int(0,9);return p+p2(int(0,99))+p2(int(0,99))+String(int(1000,9999))}
for(let i=0;i<1315;i++){
  const isTest=i<STAFF_TEST;
  const area=isTest?'WX':wpick(['WY','WX','WC','WH'],[50,40,6,4]);
  const blds=BUILDINGS.filter(b=>b.area===area);
  const b=wpick(blds,blds.map(x=>x.gender==='Female'?1.6:1));
  let joined;
  if(isTest)joined=Date.parse('2026-09-24T10:00:00+08:00')+i*HR;
  else if(R()<.7)joined=Date.parse('2026-09-28T09:00:00+08:00')+R()*7.5*DAY;
  else joined=Date.parse('2026-10-05T18:00:00+08:00')+R()*(NOW-Date.parse('2026-10-05T18:00:00+08:00'));
  const nk=isTest?('Staff test '+(i+1)):(pick(NICK)+(R()<.45?'_'+int(2,99):'')),nkEn=nk.replace(/^[^_\s]+/,w=>PINYIN[w]||w);
  USERS.push({id:'U'+(10001+i),_zh:nk,_en:nkEn,get nick(){return LANG==='zh'?this._zh:this._en},isTest,area,bld:b.id,room:String(int(1,23))+p2(int(1,30)),contact:pick(SURN)+' '+pick(['M.','K.','Y.','L.','X.','J.','H.','Z.']),dropPref:wpick(['door','lobby'],[70,30]),
    phone:mkPhone(),sid:String(int(20,26))+String(int(10000,99999)),joined,lastActive:joined+(NOW-joined)*Math.pow(R(),1.6)*.97,
    source:wpick(['Booth','Poster','Dorm group','Unknown'],[35,20,30,15]),consent:isTest?false:R()<.23,
    certified:false,tags:new Set(),notes:[],goodwill:[],lastNews:null,pointsAdj:0});
}
const UMAP=Object.fromEntries(USERS.map(u=>[u.id,u]));
const realUsers=USERS.slice(STAFF_TEST);
// runner certification
const certPool=[...realUsers].sort(()=>R()-.5).slice(0,318);
certPool.forEach(u=>{u.certified=true;u.certAt=Math.min(u.joined+R()*2*DAY,NOW-2*HR)});
USERS.slice(0,STAFF_TEST).forEach(u=>{u.certified=true;u.certAt=u.joined});
const activeRunners=certPool.slice(0,46);
const runnerW=activeRunners.map((_,i)=>1/Math.pow(i+1,.85));
const orderers=realUsers.filter(u=>!u.certified||R()<.3).sort(()=>R()-.5).slice(0,285);
const ordererW=orderers.map((_,i)=>1/Math.pow(i+1,.75));

/* ============ orders ============ */
const ORDERS=[];
const HOURS={takeaway:[0,0,0,0,0,0,0,1,2,3,4,18,26,8,3,3,4,14,20,8,5,6,4,1],
  parcel:[0,0,0,0,0,0,0,0,1,3,5,7,9,8,8,9,10,10,9,8,8,6,3,1],
  nightMarket:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,3,8,12,9,3],
  purchase:[0,0,0,0,0,0,0,0,1,3,5,6,5,5,5,6,6,5,5,4,3,2,1,0]};
const H24=[...Array(24).keys()];
function feeFor(t){if(t==='takeaway')return wpick([300,350,400,450,500,600],[38,12,26,6,13,5]);if(t==='parcel')return wpick([400,500,600,700,800],[18,34,26,12,10]);if(t==='nightMarket')return wpick([400,450,500,600],[30,20,35,15]);return wpick([300,400,500],[40,40,20])}
function pickupFor(t){if(t==='takeaway')return wpick(['NG','SG','NL','EG'],[44,24,22,10]);if(t==='parcel')return wpick(['HL','WS'],[62,38]);if(t==='nightMarket')return wpick(['SG','NG'],[70,30]);return wpick(['NG','EG'],[60,40])}
const NO_RUNNER='No one took the order';
/* the reasons a student picks on the cancel screen, plus runner, automatic and staff ones */
const REASONS=[
  {k:NO_RUNNER,zh:'没人接单',who:'Student, or automatic when the order closes',app:true},
  {k:'Collected it myself',zh:'我自己取了',who:'Student',app:true},
  {k:'Changed my mind',zh:'不需要了',who:'Student',app:true},
  {k:'Wrong details in the order',zh:'信息填错了',who:'Student',app:true},
  {k:'Runner too slow to pick up',zh:'跑腿员太慢',who:'Student, after a runner took it',app:true},
  {k:'Other',zh:'其他',who:'Student, with a short note',app:true},
  {k:"Runner cancelled: can't go any more",zh:'跑腿员：临时有事',who:'Runner'},
  {k:"Runner cancelled: bags didn't match",zh:'跑腿员：袋子对不上',who:'Runner'},
  {k:'Runner cancelled: food not found',zh:'跑腿员：没找到外卖',who:'Runner'},
  {k:'Cancelled by staff on request',zh:'客服取消',who:'Staff'},
  {k:'Test order',zh:'测试单',who:'Team',test:true}];
const OTHER_NOTES=['Class ran late','Posted it twice by mistake','Going out to eat instead','A friend brought it'];
const CANCEL={
  system:[NO_RUNNER],
  runner:['Runner cancelled: can\'t go any more','Runner cancelled: bags didn\'t match','Runner cancelled: food not found']};
let seq=0;
function makeOrder(base){
  const o=Object.assign({id:null,campus:'SIP',bags:1,offerRaised:0,svc:0,rating:null,dispute:null,groupId:null,notes:[],refunds:[]},base);
  o.area=BLD[o.bld].area;o.seq=seq++;return o}
function life(o,dayIdx){
  // decide fate and timestamps
  const t=o.type, lunch=hourOf(o.postedAt)>=11&&hourOf(o.postedAt)<=13, dinner=hourOf(o.postedAt)>=17&&hourOf(o.postedAt)<=19;
  o.paidAt=o.postedAt+int(10,70)*1000;
  if(t==='takeaway'){o.dueAt=o.postedAt+int(8,35)*MIN}else if(t==='parcel'){o.dueAt=o.postedAt;o.askedBy=o.postedAt+int(1,4)*HR}else{o.dueAt=o.postedAt+int(10,40)*MIN}
  o.bags=t==='parcel'?wpick([1,2,3],[60,30,10]):wpick([1,2,3],[80,16,4]);
  const pCancel=o.isTest?.4:(.16+.14*dayIdx/19+(o.fee<=300?.08:0)+(t==='parcel'?-.04:0));
  let wait=t==='parcel'?logn(13,.7):logn(lunch||dinner?8:4.5,.75);
  if(o.isTest)wait=logn(1.5,.5);
  if(R()<pCancel){
    const who=wpick(['system','studentPosted','studentTaken','runner'],[40,40,12,8]);
    if(who==='system'){o.status='expired';o.cancelledBy='system';o.cancelStage='posted';o.cancelReason=CANCEL.system[0];
      o.cancelledAt=(t==='takeaway'?o.dueAt+30*MIN:o.postedAt+int(60,180)*MIN);
      if(R()<.35){o.offerRaised=100;o.raisedAt=o.postedAt+int(8,14)*MIN}}
    else if(who==='studentPosted'){o.status='cancelled';o.cancelledBy='student';o.cancelStage='posted';o.cancelReason=wpick([NO_RUNNER,'Collected it myself','Changed my mind','Wrong details in the order','Other'],[45,20,15,10,10]);o.cancelledAt=o.postedAt+(o.cancelReason===NO_RUNNER?int(12,40):int(2,25))*MIN;if(o.cancelReason==='Other')o.cancelNote=pick(OTHER_NOTES)}
    else{o.runner=wpick(activeRunners,runnerW).id;o.takenAt=o.postedAt+wait*MIN;
      if(who==='studentTaken'){o.status='cancelled';o.cancelledBy='student';o.cancelStage='taken';o.cancelReason=wpick(['Collected it myself','Runner too slow to pick up','Other'],[45,40,15]);if(o.cancelReason==='Other')o.cancelNote=pick(OTHER_NOTES);o.cancelledAt=o.takenAt+int(3,12)*MIN}
      else{o.status='expired';o.cancelledBy='runner';o.cancelStage='taken';o.cancelReason=pick(CANCEL.runner);o.cancelledAt=o.takenAt+int(5,20)*MIN;o.runnerCancelled=o.runner}}
    if(o.isTest){o.cancelledAt=o.postedAt+int(5,40)*1000;o.cancelReason='Test order';o.cancelledBy='student';o.cancelStage='posted';o.status='cancelled';delete o.runner;delete o.takenAt}
    return}
  o.runner=o.isTest?pick(USERS.slice(0,STAFF_TEST).filter(u=>u.id!==o.customer)).id:wpick(activeRunners.filter(r=>r.id!==o.customer),runnerW).id;
  o.takenAt=o.postedAt+Math.max(.4,wait)*MIN;
  const toGate=t==='takeaway'?Math.max(o.dueAt,o.takenAt+int(4,9)*MIN):o.takenAt+int(6,16)*MIN;
  o.pickedAt=toGate+int(1,4)*MIN;
  o.deliveredAt=o.pickedAt+Math.max(2,logn(7,.45))*MIN;
  o.pickedAt=Math.round(o.pickedAt);o.deliveredAt=Math.round(o.deliveredAt);
  if(!o.isTest&&R()<.025){o.dispute={type:pick(['Not received','Wrong bag','Spilled']),reportedAt:o.deliveredAt+int(4,25)*MIN,status:'open',note:''};}
  const auto=t==='parcel'?48*HR:(t==='takeaway'?1*HR:24*HR);
  if(R()<.72){o.confirmedAt=o.deliveredAt+Math.max(1,logn(9,.9))*MIN;o.confirmedBy='student'}else{o.confirmedAt=o.deliveredAt+auto;o.confirmedBy='auto'}
  if(o.confirmedAt-o.deliveredAt>auto){o.confirmedAt=o.deliveredAt+auto;o.confirmedBy='auto'}
  if(R()<.55)o.rating=wpick([5,4,3,2],[70,22,6,2]);
}
const start=Date.parse('2026-10-03T00:00:00+08:00');
for(let d=0;d<20;d++){
  const day0=start+d*DAY, dow=cn(day0).getUTCDay();
  let n=(dow===6?13:dow===0?15:20)+int(-5,5);
  for(let k=0;k<n;k++){
    const isTest=R()<.065;
    const type=isTest?pick(['takeaway','parcel']):wpick(TYPE_KEYS,[56,33,7,4]);
    const hour=wpick(H24,HOURS[type]);
    const posted=day0+hour*HR+int(0,59)*MIN+int(0,59)*1000;
    if(posted>NOW)continue;
    const cust=isTest?pick(USERS.slice(0,STAFF_TEST)):wpick(orderers,ordererW);
    const o=makeOrder({type,isTest,postedAt:posted,customer:cust.id,bld:cust.bld,pickup:pickupFor(type),fee:isTest?wpick([1,100],[60,40]):feeFor(type)});
    life(o,d);ORDERS.push(o);
    // grouped companion: same pickup + building, posted within 9 min, same runner
    if(!isTest&&o.runner&&!o.cancelledBy&&(type==='takeaway'||type==='parcel')&&R()<.2){
      const mates=orderers.filter(u=>u.bld===o.bld&&u.id!==o.customer&&u.id!==o.runner);
      if(mates.length){const c=pick(mates);
        const o2=makeOrder({type,isTest:false,postedAt:o.postedAt+int(1,9)*MIN,customer:c.id,bld:o.bld,pickup:o.pickup,fee:feeFor(type)});
        o2.paidAt=o2.postedAt+30000;o2.dueAt=type==='parcel'?o2.postedAt:Math.min(o.dueAt+int(0,10)*MIN,o.dueAt+14*MIN);if(type==='parcel')o2.askedBy=o2.postedAt+int(1,4)*HR;
        o2.runner=o.runner;o2.takenAt=Math.max(o.takenAt,o2.postedAt+40000);o2.pickedAt=Math.max(o.pickedAt,o2.takenAt+MIN);o2.deliveredAt=o.deliveredAt+int(1,3)*MIN;
        o2.confirmedAt=o2.deliveredAt+Math.max(1,logn(10,.8))*MIN;o2.confirmedBy='student';
        o.groupId=o2.groupId='G'+o.seq;
        if(o2.postedAt<=NOW)ORDERS.push(o2)}}
  }
}
// resolve states relative to NOW
ORDERS.forEach(o=>{
  if(o.cancelledBy){
    if(o.cancelledAt>NOW){const keepRunner=o.takenAt&&o.takenAt<=NOW;o.cancelledBy=o.cancelReason=o.cancelStage=o.cancelledAt=null;o.status=keepRunner?'taken':'posted';if(!keepRunner){o.runner=null;o.takenAt=null}}
    return}
  if(o.takenAt>NOW){o.status='posted';o.runner=null;o.takenAt=o.pickedAt=o.deliveredAt=o.confirmedAt=null;o.dispute=null}
  else if(o.pickedAt>NOW){o.status='taken';o.pickedAt=o.deliveredAt=o.confirmedAt=null;o.dispute=null}
  else if(o.deliveredAt>NOW){o.status='picked';o.deliveredAt=o.confirmedAt=null;o.dispute=null}
  else if(o.dispute&&o.dispute.reportedAt<=NOW){o.status='disputed';o.confirmedAt=null;
    if(NOW-o.dispute.reportedAt>30*HR){o.dispute.status=R()<.6?'upheld':'rejected';o.dispute.decidedAt=o.dispute.reportedAt+int(2,20)*HR;o.status=o.dispute.status==='upheld'?'refunded':'confirmed';
      if(o.dispute.status==='upheld')o.refunds.push({fen:o.fee,reason:'Dispute upheld: '+o.dispute.type,at:o.dispute.decidedAt,by:'Ops'});else{o.confirmedAt=o.dispute.decidedAt;o.confirmedBy='after review'}}}
  else if(o.confirmedAt>NOW){o.status='delivered';o.confirmedAt=null;o.dispute=null}
  else{o.status='confirmed';o.dispute=null}
});
// live lunch orders right now (so the live views show real work in progress)
{const mk=(type,postedHM,status,extra={})=>{const cust=pick(orderers.filter(u=>u.bld.startsWith(pick(['WY','WX']))));const posted=Date.parse('2026-10-22T'+postedHM+':00+08:00');
  const o=makeOrder({type,isTest:false,postedAt:posted,customer:cust.id,bld:cust.bld,pickup:pickupFor(type),fee:feeFor(type)});
  o.paidAt=posted+40000;o.status=status;o.dueAt=type==='parcel'?posted:posted+int(20,30)*MIN;if(type==='parcel')o.askedBy=posted+2*HR;o.bags=1;Object.assign(o,extra);
  if(status!=='posted'){o.runner=wpick(activeRunners.filter(r=>r.id!==o.customer),runnerW).id;o.takenAt=posted+int(2,6)*MIN}
  if(status==='picked')o.pickedAt=NOW-int(3,6)*MIN;ORDERS.push(o);return o};
 mk('takeaway','11:52','posted',{fee:300});mk('parcel','11:49','posted',{fee:500});mk('takeaway','12:05','posted',{fee:400});
 mk('takeaway','11:44','taken');mk('takeaway','11:37','picked');mk('takeaway','11:58','taken',{fee:500})}
/* ---------- coupons (sample) ---------- */
const R2=rng(4242),pick2=a=>a[Math.floor(R2()*a.length)],int2=(a,b)=>a+Math.floor(R2()*(b-a+1));
const COUPONS=[
  {id:'C1',nameEn:'National Day trial: ¥1 off',name:'国庆试运营立减1元',kind:'amount',off:100,cap:null,min:0,types:['takeaway','parcel','nightMarket','purchase'],how:'collect',total:150,from:Date.parse('2026-10-01T00:00:00+08:00'),to:Date.parse('2026-10-08T00:00:00+08:00'),createdBy:'Guitar'},
  {id:'C2',nameEn:'New member: ¥2 off first order',name:'新人首单立减2元',kind:'amount',off:200,cap:null,min:0,firstOnly:true,types:['takeaway','parcel','nightMarket','purchase'],how:'collect',total:300,from:Date.parse('2026-10-09T00:00:00+08:00'),to:Date.parse('2026-11-30T23:59:00+08:00'),createdBy:'Iris'},
  {id:'C3',nameEn:'10.12–10.18 thank-you: 50% off',name:'10.12—10.18 下单回馈五折券',kind:'percent',off:50,cap:1000,min:0,types:['takeaway','parcel','nightMarket','purchase'],how:'send',total:39,from:Date.parse('2026-10-18T15:55:00+08:00'),to:Date.parse('2026-11-17T15:55:00+08:00'),createdBy:'Yuran'},
  {id:'C4',nameEn:'Lunch: ¥1 off orders from ¥4',name:'午餐满4元减1元',kind:'amount',off:100,cap:null,min:400,types:['takeaway'],how:'collect',total:200,from:Date.parse('2026-10-19T00:00:00+08:00'),to:Date.parse('2026-10-26T00:00:00+08:00'),createdBy:'Guitar'},
  {id:'C5',nameEn:'Launch week: ¥1.50 off orders from ¥3',name:'上线周 满3元减1.5元',kind:'amount',off:150,cap:null,min:300,types:['takeaway','parcel'],how:'collect',total:500,from:Date.parse('2026-11-02T00:00:00+08:00'),to:Date.parse('2026-11-09T00:00:00+08:00'),createdBy:'Guitar'}];
COUPONS.forEach(c=>{c.claims=[];c.stopped=false});
const CMAP=Object.fromEntries(COUPONS.map(c=>[c.id,c]));
const cName=c=>LANG==='zh'?c.name:(c.nameEn||c.name);
function couponOff(c,feeFen){if(feeFen<c.min)return 0;return c.kind==='amount'?Math.min(c.off,feeFen):Math.min(Math.round(feeFen*c.off/100),c.cap??1e9)}
{const real=ORDERS.filter(o=>!o.isTest).sort((a,b)=>a.postedAt-b.postedAt),firstSet=new Set(),seenC=new Set();real.forEach(o=>{if(!seenC.has(o.customer)){seenC.add(o.customer);firstSet.add(o)}});
 COUPONS.forEach(c=>{
   if(c.from>NOW)return;
   const target=c.id==='C1'?96:c.id==='C2'?131:c.id==='C3'?39:c.id==='C4'?64:0;
   const ok=u=>u.joined<Math.min(c.to,NOW),ord=new Set(orderers.map(u=>u.id));
   const pool=orderers.filter(ok).sort(()=>R2()-.5).slice(0,Math.round(target*.55)).concat(realUsers.filter(u=>ok(u)&&!ord.has(u.id)).sort(()=>R2()-.5));
   pool.slice(0,target).forEach(u=>c.claims.push({user:u.id,at:Math.max(c.from,u.joined)+int2(1,60)*HR*(c.how==='send'?0:1)+(c.how==='send'?int2(1,10)*MIN:0),order:null}));
   c.claims.forEach(cl=>{if(cl.at>NOW)cl.at=NOW-int2(10,300)*MIN});
   const want=c.id==='C3'?3:Math.round(c.claims.length*(c.id==='C2'?.32:c.id==='C1'?.45:.28));
   let used=0;
   for(const cl of c.claims.sort(()=>R2()-.5)){if(used>=want)break;
     const o=real.find(o=>o.customer===cl.user&&!o.coupon&&o.postedAt>=Math.max(c.from,cl.at)&&o.postedAt<c.to&&c.types.includes(o.type)&&o.fee>=c.min&&(!c.firstOnly||firstSet.has(o))&&o.status==='confirmed');
     if(o){o.coupon={id:c.id,fen:couponOff(c,o.fee+o.offerRaised)};cl.ord=o;cl.usedAt=o.postedAt;used++}}
 })}
const paidOf=o=>o.fee+o.offerRaised+o.svc-(o.coupon?o.coupon.fen:0);
ORDERS.forEach(o=>o.refunds.forEach(r=>{if(r.reason.startsWith('Dispute upheld'))r.fen=paidOf(o)}));

// refunds for cancellations
ORDERS.forEach(o=>{
  if(o.status==='expired'||(o.status==='cancelled'&&o.cancelStage==='posted'))o.refunds.push({fen:paidOf(o),reason:o.cancelReason,at:o.cancelledAt,by:'System'});
  else if(o.status==='cancelled'&&o.cancelStage==='taken')o.refunds.push({fen:Math.round(paidOf(o)/2),reason:'Cancelled after a runner took it (50% back)',at:o.cancelledAt,by:'System'});
});
ORDERS.sort((a,b)=>a.postedAt-b.postedAt);
ORDERS.forEach((o,i)=>{o.id='UE'+(20400+i)});
const OMAP=Object.fromEntries(ORDERS.map(o=>[o.id,o]));
COUPONS.forEach(c=>c.claims.forEach(cl=>{if(cl.ord){cl.order=cl.ord.id;delete cl.ord}}));
// first orders
{const seen=new Set();ORDERS.forEach(o=>{o.isFirst=!seen.has(o.customer);seen.add(o.customer)})}
// last active from orders
ORDERS.forEach(o=>{const u=UMAP[o.customer];u.lastActive=Math.max(u.lastActive,o.postedAt);if(o.runner){const r=UMAP[o.runner];r.lastActive=Math.max(r.lastActive,o.deliveredAt||o.takenAt||o.postedAt)}});

/* saved addresses (one per student, like the live "Delivery locker address" page) */
const ADDRS=[];
{const by={};ORDERS.forEach(o=>{(by[o.customer]=by[o.customer]||[]).push(o)});
 const list=[];USERS.forEach(u=>{const os=by[u.id];if(!os&&R()>.05)return;
   const created=os?os[0].postedAt-int(1,8)*MIN:u.joined+int(1,48)*HR;
   list.push({user:u.id,contact:u.contact,bld:u.bld,room:R()<.08?'':u.room,drop:u.dropPref,createdAt:Math.min(created,NOW-MIN),lastUsed:os?os[os.length-1].postedAt:null})});
 list.sort((a,b)=>a.createdAt-b.createdAt).forEach((a,i)=>{a.id=String(1+i);ADDRS.push(a)})}
const AMAP=Object.fromEntries(ADDRS.map(a=>[a.id,a]));

/* money helpers per order */
function money(o){
  const paid=paidOf(o),refunded=sum(o.refunds.map(r=>r.fen)),coupon=o.coupon?o.coupon.fen:0;
  let released=0,held=0,svc=0;
  if(o.status==='confirmed'){released=o.fee+o.offerRaised-(o.partialRefundToRunner||0);svc=o.svc}
  else if(o.status==='cancelled'&&o.cancelStage==='taken')released=Math.round((o.fee+o.offerRaised)/2);
  else if(['posted','taken','picked','delivered','disputed'].includes(o.status))held=paid;
  const subsidy=Math.max(0,released+refunded+svc-paid-held);
  return{paid,refunded,released,held,svc,coupon,subsidy}}
/* ---------- runner wallets and withdrawals (sample) ---------- */
var SHOW_TEST=false;
const WITHDRAWALS=[];
function walletCredits(id){const L=[];ORDERS.forEach(o=>{if(o.isTest&&!SHOW_TEST)return;const m=money(o);
  if(o.runner===id&&o.status==='confirmed'&&m.released)L.push({at:o.confirmedAt,fen:m.released,order:o.id,what:'Job paid'});
  else if((o.runner===id)&&o.status==='cancelled'&&o.cancelStage==='taken'&&m.released)L.push({at:o.cancelledAt,fen:m.released,order:o.id,what:'Half fee, student cancelled'})});return L.sort((a,b)=>a.at-b.at)}
{activeRunners.forEach((r,ri)=>{let bal=0,last=0;
  walletCredits(r.id).forEach(c=>{bal+=c.fen;
    if(bal>=400&&R2()<.7&&c.at-last>DAY){const at=c.at+int2(1,20)*HR;if(at<NOW-3*HR){WITHDRAWALS.push({runner:r.id,fen:bal,at,status:'paid',by:pick2(['Guitar','Iris','Yuran','Yichen']),doneAt:at+int2(20,600)*MIN});bal=0;last=at}}});
  if(bal>=300&&ri%4===0)WITHDRAWALS.push({runner:r.id,fen:bal,at:NOW-int2(40,1100)*MIN,status:'pending'});
});
 WITHDRAWALS.forEach(w=>{if(w.doneAt&&w.doneAt>NOW)w.doneAt=NOW-MIN});
 const rj=WITHDRAWALS.filter(w=>w.status==='paid').slice(3,5);rj.forEach(w=>{w.status='rejected';w.reason='WeChat name does not match the runner';w.fenBack=w.fen});
 WITHDRAWALS.sort((a,b)=>a.at-b.at).forEach((w,i)=>w.id='W'+(1+i))}
function wallet(id){const cr=walletCredits(id),W=WITHDRAWALS.filter(w=>w.runner===id);
  const earned=sum(cr.map(c=>c.fen)),paidOut=sum(W.filter(w=>w.status==='paid').map(w=>w.fen)),frozen=sum(W.filter(w=>w.status==='pending').map(w=>w.fen));
  const lastW=W.filter(w=>w.status==='paid').slice(-1)[0];
  return{earned,paidOut,frozen,balance:earned-paidOut-frozen,lastW,credits:cr,W}}
/* order chat (sample, generated per order) */
const PU_ZH={NG:'北门',SG:'南门',EG:'东门',NL:'北门外卖柜',HL:'翰林驿站',WS:'文萃驿站'};
const VIEWED_CHATS=new Set();
function chatFor(o){
  o._chatL=o._chatL||{};if(o._chatL[LANG])return o._chatL[LANG];
  const msgs=[];o._chatL[LANG]=msgs;
  const rid=o.runner||o.runnerCancelled;if(!rid||!o.takenAt)return msgs;
  const r=rng(o.seq*7919+13),zh=(r(),LANG==='zh'),T=(en,z)=>zh?z:en,c=UMAP[o.customer],last4=c.phone.slice(-4),door=c.dropPref==='door';
  const add=(from,at,text,extra={})=>{if(at&&at<=NOW)msgs.push({from,at,text,...extra})};
  const pz=PU_ZH[o.pickup]||PU[o.pickup].name, pe=PU[o.pickup].name;
  add('sys',o.takenAt,'Order taken by the runner');
  add('runner',o.takenAt+50000,T(`Hi, I've taken your order. Going to ${pe} now.`,`你好，我接单了，现在去${pz}取。`));
  if(r()<.65)add('student',o.takenAt+int(1,3)*MIN+r()*MIN,o.type==='parcel'?T('Thanks! It\'s a medium box, the code is in the order.','谢谢！是个中件，取件码在订单里。'):T(`Thanks! The phone on the bag ends in ${last4}.`,`谢谢！袋子上手机尾号${last4}。`));
  if(o.type==='takeaway'&&r()<.18){const t=o.takenAt+int(4,7)*MIN;add('student',t,T('The delivery app says 5 more minutes, sorry!','外卖说还要5分钟，不好意思～'));add('runner',t+40000,T('No problem, I\'ll wait at the gate.','没事，我在门口等。'))}
  if(o.cancelledBy==='student'&&o.cancelStage==='taken'){add('student',o.cancelledAt-50000,T('I picked it up myself, sorry! Cancelling.','我自己拿了，不好意思，取消一下～'));add('sys',o.cancelledAt,'Cancelled by the student · 50% refunded, the runner keeps half');msgs.sort((a,b)=>a.at-b.at);return msgs}
  if(o.runnerCancelled){add('runner',o.cancelledAt-50000,T('Sorry, something came up and I have to cancel.','不好意思，临时有事要取消了。'));add('sys',o.cancelledAt,'The runner cancelled · order went back to the job hall');msgs.sort((a,b)=>a.at-b.at);return msgs}
  if(o.pickedAt){add('sys',o.pickedAt,'Picked up · last 4 digits and seal checked');add('runner',o.pickedAt+30000,o.type==='parcel'?T('Got the parcel, on my way.','快递拿到了，马上到。'):T('Got it, the seal is fine. On my way.','拿到了，封签完好，马上送过来。'))}
  if(o.deliveredAt){add('runner',o.deliveredAt,door?T('Hung it on your door, photo sent.','已挂在门把手上，照片发你了。'):T('Left it on the lobby shelf, photo sent.','放在大堂架子上了，照片发你了。'),{photo:true});add('sys',o.deliveredAt+1000,'Delivered with a drop-off photo')}
  if(o.dispute){const d=o.dispute;add('student',d.reportedAt-30000,d.type==='Wrong bag'?T('This isn\'t mine, the number doesn\'t match.','这不是我的，尾号对不上。'):d.type==='Spilled'?T('The soup spilled inside the bag.','汤洒在袋子里了。'):T('I can\'t find it at my door.','门口没看到。'));
    add('sys',d.reportedAt,'Reported to Uniearn: '+d.type);add('runner',d.reportedAt+int(3,9)*MIN,T(`I left it at ${BLD[o.bld].name}, please check the photo.`,`我放在${BLD[o.bld].code}了，看下照片。`))}
  if(o.confirmedAt){if(o.confirmedBy==='student'){if(r()<.75)add('student',o.confirmedAt-20000,T('Got it, thank you!','收到啦，谢谢！'));add('sys',o.confirmedAt,'Confirmed by the student · runner paid')}else add('sys',o.confirmedAt,o.confirmedBy==='auto'?'Auto-confirmed · runner paid':'Closed after review')}
  msgs.sort((a,b)=>a.at-b.at);return msgs}
function chatHTML(o){
  const m=chatFor(o);if(!m.length)return'<p class="muted" style="margin:0">No chat yet. A chat opens when a runner takes the order.</p>';
  return`<div class="chat">${m.map(x=>x.from==='sys'?`<div class="chat-sys">${esc(x.text)} · ${fHM(x.at)}</div>`
    :`<div class="bubble ${x.from}"><span class="from"><span translate="no">${x.from==='student'?esc(UMAP[o.customer].nick):esc(UMAP[o.runner||o.runnerCancelled].nick)}</span> · ${x.from==='student'?'student':'runner'}</span><span translate="no">${esc(x.text)}</span>${x.photo?'<div class="ph" style="aspect-ratio:16/10;margin-top:6px;font-size:12px">Drop-off photo (sample)</div>':''}<small>${fDT(x.at)}</small></div>`).join('')}</div>`}

const STATUS={posted:['Waiting for runner','info'],taken:['Taken','info'],picked:['Picked up','info'],delivered:['Delivered · to confirm','info'],confirmed:['Done','good'],
  cancelled:['Cancelled','plain'],expired:['Expired · no runner','warn'],disputed:['Disputed','crit'],refunded:['Refunded after dispute','warn']};
const LIVE=new Set(['posted','taken','picked','delivered','disputed']);
const settle=o=>{const m=money(o);if(m.held)return'Held';if(m.refunded&&m.released)return'Split';if(m.refunded)return'Refunded';return'Credited'};
const SETTLE_LABEL={Held:'Held, not confirmed',Credited:'In runner wallet',Refunded:'Refunded',Split:'Part refunded'};

/* ============ runners, marks, applications ============ */
const LEVELS=[['new','New',1000],['rising','Rising',1500],['trusted','Trusted',2500],['top','Top',null]];
function levelOf(j){return j>=20?'top':j>=10?'trusted':j>=5?'rising':'new'}
const LEVEL_LABEL={new:'New',rising:'Rising',trusted:'Trusted',top:'Top'};
const MARK_RULES=['Late cancel (under 15 min before food)','Delivered after 15 min','No drop-off photo','Wrong bag','Left before student replied'];
const MARKS=[];
activeRunners.slice(2,14).forEach((r,i)=>{const n=i===3?5:(i%4===0?2:1);for(let k=0;k<n;k++){const g=NOW-int(1,12)*DAY-int(0,20)*HR;MARKS.push({id:'M'+MARKS.length,runner:r.id,rule:pick(MARK_RULES),givenAt:g,expiresAt:g+14*DAY,by:'System'})}});
const PAUSED={};{const r=activeRunners[5];PAUSED[r.id]=NOW+int(2,6)*DAY}
const APPS=[];
/* applicant checks: no photo, staff check name + student ID */
const sidValid=sid=>/^2[0-6]\d{5}$/.test(sid);
const REVIEWERS=['Guitar','Iris','Yuran','Yichen'];
certPool.forEach(u=>APPS.push({id:'A'+u.id,user:u.id,appliedAt:u.certAt-int(1,30)*HR,status:'approved',proof:true,checkedBy:pick(REVIEWERS),checkedAt:u.certAt,grad:2027+int(0,3)}));
realUsers.filter(u=>!u.certified).sort(()=>R()-.5).slice(0,24).forEach((u,i)=>{
  const st=i<7?'pending':i<20?'rejected':'revoked';
  const at=i<7?NOW-int(1,40)*HR:u.joined+int(2,60)*HR;
  APPS.push({id:'A'+u.id,user:u.id,appliedAt:Math.min(at,NOW-HR),status:st,proof:i<7?i>1:true,checkedBy:st==='pending'?null:pick(REVIEWERS),checkedAt:st==='pending'?null:at+int(2,20)*HR,grad:2027+int(0,3),
    reason:st==='rejected'?pick(['Student ID is not valid','Student ID already used by another account','Real name looks incomplete']):st==='revoked'?'Graduated':null})});

{const pa=APPS.filter(a=>a.status==='pending').sort((a,b)=>a.appliedAt-b.appliedAt);if(pa[3])UMAP[pa[3].user].sid=UMAP[certPool[0].id].sid;if(pa[5])UMAP[pa[5].user].sid='224513';}
/* ============ tickets ============ */
const TOPICS={'Item size':'student','Runner rules':'runner',Refund:'student','Order not received':'student','Runner was late':'student',Payment:'student','Runner certification':'runner','Payout question':'runner',Account:'student',Suggestion:'student'};
const TEXT={
  'Item size':['Is a felt board a large or small item?','A felt board counts as large (longer than 60 cm). Choose "Large" when you post so the runner knows.'],
  'Runner rules':['Hello, is it true that you can only accept 6 orders per day?','No daily limit. New runners have a ¥10 limit per trip; it rises after 5 and 10 finished jobs.'],
  Refund:['I cancelled before anyone took it but I can\'t see the refund yet.','The refund usually reaches WeChat Pay within a few minutes. I\'ve checked: it was sent at {t}. Please look under WeChat Pay → Bills.'],
  'Order not received':['The app says delivered but there is nothing at my door.','Sorry about that. The runner\'s photo shows the lobby shelf. Could you check there? If it\'s not there we\'ll refund you.'],
  'Runner was late':['My food came 25 minutes after pickup and was cold.','Thanks for telling us. Late deliveries go on the runner\'s record. Cold food can\'t be refunded, but we\'ve noted it.'],
  Payment:['Payment failed twice when I tried to post.','That was a WeChat Pay timeout around lunch. Please try again; you were not charged.'],
  'Runner certification':['I applied to be a runner three days ago. When will I be approved?','We check applications every evening. Yours is in the queue now.'],
  'Payout question':['When do I get paid for a job?','When the student confirms, or automatically 1 hour after a takeaway drop-off (48 hours for parcels). It goes to your Uniearn wallet, and you can withdraw it to your WeChat balance.'],
  Account:['I changed my phone number. How do I update it?','Me → Delivery details → Phone. The new number is checked by WeChat.'],
  Suggestion:['Could you add the East gate locker as a pickup point?','Good idea, we\'ve added it to the list for the team meeting.']};
const TICKETS=[];
for(let i=0;i<26;i++){
  const topic=i===0?'Item size':i===1?'Runner rules':i===3?'Refund':wpick(Object.keys(TOPICS),[2,2,5,4,3,2,4,2,2,2]);
  const role=TOPICS[topic];
  const user=role==='runner'?pick(activeRunners):wpick(orderers,ordererW);
  const created=NOW-(i<5?int(10,300)*MIN:int(6,240)*HR);
  const linked=['Refund','Order not received','Runner was late','Payment'].includes(topic)?(ORDERS.filter(o=>o.customer===user.id).slice(-1)[0]||null):null;
  const open=i<5||R()<.12;
  const replied=!(i<3);
  const first=replied?created+Math.max(4,logn(i<5?40:150,.8))*MIN:null;
  const tk={id:'T'+(310+i),topic,role,user:user.id,order:linked?linked.id:null,createdAt:created,firstReplyAt:first&&first<NOW?first:null,status:open?'open':'resolved',thread:[]};
  if(topic==='Item size')tk.thread.push({from:'user',text:'',img:'Product screenshot · felt board, 80 × 60 cm (sample)',at:created-40000});
  tk.thread.push({from:'user',text:TEXT[topic][0],at:created});
  if(tk.firstReplyAt){tk.repliedBy=pick(['Guitar','Iris','Yuran','Yichen']);tk.thread.push({from:'staff',by:tk.repliedBy,text:TEXT[topic][1].replace('{t}',fHM(created-20*MIN)),at:tk.firstReplyAt});
    if(i===3){tk.thread.push({from:'user',text:'Still nothing in my WeChat Pay bills…',at:NOW-int(20,50)*MIN});tk.status='open'}}
  if(!tk.firstReplyAt)tk.status='open';
  TICKETS.push(tk)}
TICKETS.forEach(t=>t.thread.forEach(m=>{if(m.at>NOW)m.at=NOW-MIN}));
TICKETS.sort((a,b)=>b.createdAt-a.createdAt);
const lastMsg=t=>t.thread[t.thread.length-1];
const needsReply=t=>lastMsg(t).from==='user';
const waitingSince=t=>{let i=t.thread.length-1;while(i>0&&t.thread[i-1].from==='user')i--;return t.thread[i].at};
const QUICK_EN=[['Checking now','Thanks for telling us. I\'m checking this now and will reply within an hour.'],['Refund timing','Refunds go back to WeChat Pay within a few minutes. Please look under WeChat Pay → Bills.'],['Drop-off photo','The runner\'s drop-off photo shows where the bag was left. Could you check there first?'],['Post as large','If it\'s longer than 60 cm or heavier than 5 kg, choose "Large" when you post.'],['Runner levels','There is no daily limit. New runners can take ¥10 per trip; it rises after 5, 10 and 20 finished jobs.'],['Withdrawals','Withdrawals are checked by hand and usually reach your WeChat balance within a day.']];
const QUICK_ZH=[['正在处理','收到，我们正在核实，一小时内回复你～'],['退款到账','退款会在几分钟内原路退回微信，可以在“微信支付→账单”里查看。'],['送达照片','跑腿员上传了送达照片，可以先按照片的位置找一下哦～'],['大件下单','超过60厘米或5公斤的物品，下单时请选择“大件”。'],['跑腿等级','接单没有每天单数限制。新手单趟最多¥10，完成5、10、20单后会自动升级。'],['提现说明','提现需要人工审核，一般一天内到账微信零钱。']];
const QUICKS=()=>LANG==='zh'?QUICK_ZH:QUICK_EN;

/* ============ ops state ============ */
const ST={
  view:'overview',range:'7d',area:'all',type:'all',showTest:false,role:'admin',
  orders:{q:'',reason:'all',status:'all',pickup:'all',cancelBy:'all',settle:'all',feeMin:'',feeMax:'',slow:false,complaint:false,grouped:false,page:0,sort:'new'},
  members:{seg:'all',q:'',tab:'members',page:0,sort:'active',sex:'all'},
  runners:{tab:'apps',appStatus:'pending'},
  support:{tab:'tickets',box:'need',sel:null,q:''},
  cancel:{reason:null,bld:null},
  verify:'manual',
  me:'Guitar',
  addr:{tab:'list',q:'',bld:'all',noRoom:false,noLocker:false,page:0},
  qr:{uploadedAt:Date.parse('2026-09-22T15:00:00+08:00'),img:null},
  newsLog:[
    {at:Date.parse('2026-10-20T18:30:00+08:00'),seg:'Active now',area:'all',text:'South gate pickups are open. Choose South gate when you post.',sent:58,by:'Ops'},
    {at:Date.parse('2026-10-13T11:00:00+08:00'),seg:'Joined, no order yet',area:'all',text:'Lunch gets busy at 12:00. Post by 11:45 to get a runner faster.',sent:121,by:'Ops'},
    {at:Date.parse('2026-10-08T17:00:00+08:00'),seg:'All opted in',area:'WY',text:'Meet us at the Clubs & Societies fair, Wen Yuan side.',sent:74,by:'Admin'}],
  exportLog:[
    {at:Date.parse('2026-10-18T13:40:00+08:00'),what:'Orders, 9–18 Oct (masked)',by:'Admin',rows:117},
    {at:Date.parse('2026-10-05T20:12:00+08:00'),what:'Members (masked)',by:'Admin',rows:1008}],
  accessLog:[],
  changeLog:[],
  features:{tasks:false},
  serviceFeeOn:false,
  funds:{tab:'flow'},
  opsBalance:25000,
  coupons:{},
  rewards:{tab:'membership'},
  config:[
    {k:'groupWindowMin',on:true,ph:'launch',label:'Grouping window',unit:'min',v:15,help:'Orders due within this many minutes of the earliest one can share a runner.',open:'Parcels: keep 15 min or allow longer (an older note said 45)?'},
    {k:'maxBags',on:true,ph:'launch',label:'Bags per trip',unit:'bags',v:5,help:'A group or trip never holds more than this.'},
    {k:'closeAfterDueMin',on:true,ph:'launch',label:'Close untaken takeaway',unit:'min',v:30,help:'Minutes after the food is due. Then a full refund.'},
    {k:'deliverWithinMin',on:true,ph:'launch',label:'Deliver within',unit:'min',v:15,help:'After pickup. Later counts against the runner\'s on-time record.'},
    {k:'replyWithinMin',on:true,ph:'launch',label:'Student reply time',unit:'min',v:10,help:'If the runner can\'t get in. After this the lobby counts as delivered.'},
    {k:'disputeWindowMin',on:true,ph:'launch',label:'Report window, takeaway',unit:'min',v:30,help:'After delivery. Reports need a photo.'},
    {k:'lateMoveMaxMin',on:true,ph:'launch',label:'"My food is late" move',unit:'min',v:30,help:'Once per order, until due + 10 min.'},
    {k:'autoTakeaway',on:true,ph:'launch',label:'Auto-confirm takeaway',unit:'h',v:1,help:'Runner is paid if the student doesn\'t confirm.'},
    {k:'autoParcel',on:true,ph:'launch',label:'Auto-confirm parcel',unit:'h',v:48,help:''},
    {k:'autoTask',on:true,ph:'p2',label:'Auto-confirm task',unit:'h',v:24,help:'Runner is paid if the student doesn\'t confirm a task.'},
    {k:'markExpiryDays',on:true,ph:'launch',label:'Mark expires after',unit:'days',v:14,help:'3 active marks: back to New. 5: paused 7 days.'},
    {k:'lowFeePrompt',on:false,ph:'later',label:'Prompt "Add ¥1–2" after',unit:'min',v:10,help:'For low-fee orders nobody has taken.',open:'Recommended, not decided.'},
    {k:'phoneCheck',on:true,ph:'launch',label:'Match last 4 digits',help:'Runner checks the last 4 digits of the phone number on the bag before pickup.'},
    {k:'sealCheck',on:true,ph:'launch',label:'Seal sticker check',help:'Runner checks the seal before pickup and reports a broken seal first.'},
    {k:'dropPhoto',on:true,ph:'launch',label:'Photo at drop-off',help:'A delivery can only be finished with a photo.'},
    {k:'halfBack',on:true,ph:'launch',label:'Cancel after a runner took it',help:'Student gets 50% back; the runner keeps the other half.'},
    {k:'taskPriceMax',on:true,ph:'p2',label:'Task price cap',unit:'¥',v:50,help:'Highest price a student can set for a task.',open:'¥50 cap not confirmed.'}],
  levels:{new:10,rising:15,trusted:25,top:null},
  goals:[
    {k:'doneRate',label:'Orders finished',dir:'min',v:80,unit:'%'},
    {k:'cancelRate',label:'Cancelled or expired',dir:'max',v:20,unit:'%'},
    {k:'waitMed',label:'Median wait for a runner',dir:'max',v:10,unit:'min'},
    {k:'perTrip',label:'Orders per trip',dir:'min',v:1.5,unit:''},
    {k:'repeat',label:'Students who ordered again',dir:'min',v:30,unit:'%'},
    {k:'active7',label:'Active runners, 7 days',dir:'min',v:20,unit:''},
    {k:'onTime',label:'Delivered within 15 min',dir:'min',v:90,unit:'%'},
    {k:'firstReply',label:'Median first reply',dir:'max',v:120,unit:'min'},
    {k:'replyWait',label:'Longest wait for a reply',dir:'max',v:120,unit:'min'},
    {k:'appWait',label:'Runner application waiting',dir:'max',v:24,unit:'h'},
    {k:'couponUse',label:'Coupons used',dir:'min',v:30,unit:'%'}],
};
const goal=k=>ST.goals.find(g=>g.k===k).v;
function tone(k,v){if(v==null||isNaN(v))return'';const g=ST.goals.find(x=>x.k===k);return(g.dir==='min'?v>=g.v:v<=g.v)?'good':'bad'}
function goalTxt(k,v){const g=ST.goals.find(x=>x.k===k),t=tone(k,v);if(!t)return'';const gv=g.unit==='min'?fMin(g.v):g.unit==='h'?g.v+' h':g.v+g.unit;return`<span class="goal">${t==='good'?'✓':'!'} Goal ${g.dir==='min'?'≥':'≤'} ${gv}</span>`}
let drawer=null; // {kind,id,...}

/* ============ derived: members ============ */
function memberStats(u){
  const asC=ORDERS.filter(o=>o.customer===u.id&&(ST.showTest||!o.isTest));
  const asR=ORDERS.filter(o=>o.runner===u.id&&o.status==='confirmed'&&(ST.showTest||!o.isTest));
  const done=asC.filter(o=>o.status==='confirmed');
  const cancelled=asC.filter(o=>o.cancelledBy==='student');
  const since=NOW-MEMBER.windowMonths*30*DAY,inW=o=>(o.confirmedAt||o.postedAt)>=since;
  let pts=done.filter(inW).length*MEMBER.order+asR.filter(inW).length*MEMBER.job+(done.length&&inW(done[0])?MEMBER.first:0)+(asC.length?MEMBER.details:0)+sum(u.goodwill.filter(g=>g.at>=since).map(g=>g.pts));
  const cr=asC.length?Math.round(cancelled.length/asC.length*100):0;
  const level=levelFor(pts,cr);
  const days=(NOW-u.lastActive)/DAY;
  const fav=Object.entries(asC.reduce((m,o)=>(m[o.type]=(m[o.type]||0)+1,m),{})).sort((a,b)=>b[1]-a[1])[0];
  const conf=done.filter(o=>o.confirmedBy==='student').map(o=>(o.confirmedAt-o.deliveredAt)/MIN);
  return{orders:asC.length,done:done.length,cancelled:cancelled.length,jobs:asR.length,points:pts,level,days,
    fees:sum(done.map(o=>o.fee+o.offerRaised)),last:asC.length?asC[asC.length-1].postedAt:null,fav:fav?TYPES[fav[0]]:'—',
    autoConf:done.filter(o=>o.confirmedBy==='auto').length,confMed:median(conf),
    lunch:asC.filter(o=>o.type==='takeaway'&&[11,12,13].includes(hourOf(o.postedAt))).length,parcels:asC.filter(o=>o.type==='parcel').length}}
const MEM_LABEL={order:'Order delivered points',job:'Job delivered points',first:'First order bonus',details:'Delivery details points',pairWeek:'Same two students limit',goodwill:'Goodwill points a month',expiryMonths:'Points expiry',silver:'Silver level',gold:'Gold level',goldMaxCancel:'Gold cancel rate limit',windowMonths:'Points window',dropOne:'Drop one level a month',winterFreeze:'Winter school freeze',silverCoupons:'Silver coupons a month',silverCouponOff:'Silver coupon value',goldCoupons:'Gold coupons a month',goldCouponOff:'Gold coupon value',couponMinFee:'Member coupon minimum fee',swapLaunchPts:'Points for a ¥1 coupon',swapLaunchOff:'Swap coupon value',goldGift:'Gold welcome gift',monthlyCap:'Member coupon monthly cap',useRate:'Assumed coupon use rate',silverFree:'Silver free service fees',goldFree:'Gold free service fees',goldHelpH:'Gold priority help',swapPts:'Points for a free service fee'};
var MEMBER={order:10,job:10,first:20,details:10,pairWeek:3,goodwill:50,expiryMonths:12,silver:80,gold:200,goldMaxCancel:20,windowMonths:3,dropOne:true,winterFreeze:true,
  silverCoupons:2,silverCouponOff:2,goldCoupons:4,goldCouponOff:2,couponMinFee:4,swapLaunchPts:100,swapLaunchOff:1,goldGift:true,monthlyCap:400,useRate:70,
  silverFree:2,goldFree:5,goldHelpH:2,swapPts:50};
const MEMBER_DEF=JSON.parse(JSON.stringify(MEMBER));
const levelFor=(p,cr=0)=>p>=MEMBER.gold&&cr<=MEMBER.goldMaxCancel?'Gold':p>=MEMBER.silver?'Silver':'Member';
let MS=new Map();
function refreshMembers(){MS=new Map(USERS.map(u=>[u.id,memberStats(u)]));
  USERS.forEach(u=>{const s=MS.get(u.id);['Lunch regular','Parcels','Runner'].forEach(t=>u.tags.delete(t));if(s.lunch>=3)u.tags.add('Lunch regular');if(s.parcels>=2)u.tags.add('Parcels');if(u.certified&&s.jobs>0)u.tags.add('Runner')})}
// staff-set tags
orderers.slice(3,7).forEach(u=>u.tags.add('Ambassador'));orderers.slice(40,42).forEach(u=>u.tags.add('Needs help'));
USERS.forEach(u=>{const x=Math.sin(+u.id.slice(1)*12.9898)*43758.5453,h=x-Math.floor(x);const bg=BLD[u.bld].gender;
  u.sexChosen=u.isTest||h>=.62?null:(h<.03?(bg==='Female'?'Male':'Female'):bg)});
let sexOf=u=>u.sexChosen?{g:u.sexChosen,src:'chosen'}:{g:BLD[u.bld].gender,src:'dorm'};
let sexL=(g,pl)=>LANG==='zh'?(g==='Female'?'女生':'男生'):(g==='Female'?(pl?'Girls':'Girl'):(pl?'Boys':'Boy'));
const sexCell=u=>{const x=sexOf(u);return sexL(x.g)+(x.src==='dorm'?` <span class="faint" data-tip="${LANG==='zh'?'学生没有选择，按宿舍楼判断':'Student did not choose; worked out from their dorm building'}">${LANG==='zh'?'· 按宿舍楼':'· from dorm'}</span>`:'')};
refreshMembers();
const SEGMENTS=[
  ['all','All members',u=>true],
  ['active','Active now',(u,s)=>s.days<=14],
  ['risk','At risk',(u,s)=>s.days>14],
  ['new','Joined, no order yet',(u,s)=>s.orders===0],
  ['ordered','Ordered at least once',(u,s)=>s.orders>=1],
  ['repeat','Ordered again',(u,s)=>s.orders>=2],
  ['runners','Runners',u=>u.certified],
  ['silver','Silver',(u,s)=>s.level==='Silver'],
  ['gold','Gold',(u,s)=>s.level==='Gold']];
const SEG_HELP={all:'Every student account (test accounts not included)',ordered:'Posted 1 or more orders',repeat:'Posted 2 or more orders',active:'Opened the app or ordered in the last 14 days',risk:'Not active for more than 14 days',new:'Signed up but never posted an order',runners:'Certified to take jobs'};
const segHelp=k=>k==='silver'?`Silver level: ${MEMBER.silver}+ points in the last ${MEMBER.windowMonths} months`:k==='gold'?`Gold level: ${MEMBER.gold}+ points in the last ${MEMBER.windowMonths} months and cancel rate ${MEMBER.goldMaxCancel}% or less`:SEG_HELP[k]||'';

/* ============ derived: filters ============ */
function rangeBounds(r=ST.range){
  if(r==='today')return[TODAY0,NOW,'today'];
  if(r==='7d')return[TODAY0-6*DAY,NOW,'7 days'];
  if(r==='30d')return[TODAY0-29*DAY,NOW,'30 days'];
  return[Date.parse('2026-09-20T00:00:00+08:00'),NOW,'all time']}
function prevBounds(){const[a,b]=rangeBounds();if(ST.range==='all')return null;const len=ST.range==='today'?DAY:(b-a);if(ST.range==='today')return[TODAY0-DAY,NOW-DAY];return[a-len,a]}
function baseFilter(o,{area=true,type=true}={}){
  if(!ST.showTest&&o.isTest)return false;
  if(area&&ST.area!=='all'&&o.area!==ST.area)return false;
  if(type&&ST.type!=='all'&&o.type!==ST.type)return false;
  return true}
const inRange=(o,[a,b])=>o.postedAt>=a&&o.postedAt<=b;
const scoped=(b=rangeBounds())=>ORDERS.filter(o=>baseFilter(o)&&inRange(o,b));

/* ============ language ============ */
const ROLEZ={Admin:'管理员',Operations:'运营',Support:'客服',Ops:'运营'};
const ZH={"Girls or boys":"按性别筛选","Show rules":"筛选规则","Runner is paid if the student doesn't confirm a task.":"用户不确认任务时，自动打款给跑腿员。","Highest price a student can set for a task.":"用户发布任务时能设置的最高价格。","Phase 2":"第二阶段","Launch":"首发阶段","Phase 3":"第三阶段","Later":"以后再定","Turn a rule off to try a phase without it. Off rules are kept, not deleted.":"关掉的规则只是暂停，不会删除，随时可以再开。","No rules here.":"这里没有规则。","Rule turned on.":"规则已开启。","Rule turned off. It is kept here; turn it on any time.":"规则已关闭，仍保留在这里，随时可以再开。","Match last 4 digits":"核对手机尾号后4位","Runner checks the last 4 digits of the phone number on the bag before pickup.":"取货前，跑腿员核对外卖袋上手机号的后4位。","Seal sticker check":"检查封口贴","Runner checks the seal before pickup and reports a broken seal first.":"取货前检查封口贴，封口破损要先上报。","Photo at drop-off":"送达拍照","A delivery can only be finished with a photo.":"必须拍照才能完成送达。","Cancel after a runner took it":"已接单后取消","Student gets 50% back; the runner keeps the other half.":"用户退回50%，另外50%给跑腿员。","Picture":"图片","Write a reply or add a picture first.":"请先写回复或添加图片。","Only pictures can be added.":"只能添加图片。","Up to 6 pictures per message.":"每条消息最多6张图片。","Pictures must be under 10 MB.":"图片不能超过10 MB。","That picture could not be opened.":"这张图片打不开。","Remove picture":"删除图片","Open picture":"查看大图","Every student account (test accounts not included)":"所有学生账号（不含测试账号）","Assumed use rate (%)": "预计使用率（%）", "No coupon data yet": "暂无优惠券数据", "Use a number from 0 to 100.": "请输入0到100之间的数字。","Orders · jobs":"下单 · 跑腿","Silver + Gold orders":"白银+黄金订单","Others":"其他","Membership & coupons": "会员与优惠券", "Membership levels and coupons, one budget": "会员等级和优惠券，统一预算", "Membership": "会员", "Coupons": "优惠券", "Silver members": "白银会员", "Gold members": "黄金会员", "Points earned this month": "本月发放积分", "Silver order more than others": "白银会员下单是其他人的", "Orders per student, last 30 days": "近30天人均下单数", "See all coupons": "查看全部优惠券", "Do members order more?": "会员下单更多吗？", "Member, ordered at least once": "普通会员（下过单）", "If Silver and Gold don't order clearly more than other students, the perks aren't changing behaviour. Then cut the coupons and keep the free perks.": "如果白银和黄金会员下单没有明显多于其他人，说明权益没起作用。这时可以取消优惠券，只保留免费权益。", "Last 4 weeks": "近4周", "Levels at the end of each week": "每周末的会员等级", "Week ending": "周末日期", "Orders by Silver + Gold": "白银+黄金订单", "Other orders": "其他订单", "Coupon cost": "优惠券补贴", "Coupon cost is the weekly share of the monthly estimate. Sample data covers October only.": "优惠券补贴按每月估算平摊到每周。示例数据只有10月。", "Moved this month": "本月等级变化", "Since Oct 1 · checked again on the 1st": "自10月1日起 · 每月1日重新检查", "Nobody yet.": "暂时没有。", "New Gold members get the plush keychain. Hand it out in person or post it to their dorm.": "新晋黄金会员可获得毛绒挂件，可以当面送或送到宿舍。", "Nobody.": "没有。", "Nobody. In January and February nobody drops a level.": "没有。1月和2月不会降级。", "Levels, points, perks and the monthly coupon cap now live on Membership & coupons → Membership.": "等级、积分、权益和每月券补贴上限已移到“会员与优惠券 → 会员”。", "Open Membership & coupons": "打开会员与优惠券", "Member": "普通会员","Member coupons this month": "本月会员券补贴", "✓ Within the monthly cap": "✓ 在每月上限内", "! Over the monthly cap": "! 超出每月上限", "Gold: cancel rate at most": "黄金：取消率不超过", "Gold is for good customers, not only heavy ones": "黄金会员要下单多，也要取消少", "No level drops in winter school": "寒假期间不降级", "January and February, when most students are away.": "1月和2月，大部分学生不在学校。", "Perks during the launch": "上线期间的权益", "Silver: coupons a month": "白银：每月优惠券", "Paid by Uniearn; the runner still gets the full fee": "由 Uniearn 承担，跑腿员仍拿全额跑腿费", "Silver: each coupon": "白银：每张优惠", "Gold: coupons a month": "黄金：每月优惠券", "Gold: each coupon": "黄金：每张优惠", "coupons": "张", "¥ off": "¥ 立减", "Member coupons work on orders from": "会员券使用门槛", "Stops members posting ¥3 orders nobody takes": "避免会员发没人接的 ¥3 订单", "Swap points for a ¥1 coupon": "积分兑换 ¥1 优惠券", "Any member": "所有会员", "Gold welcome gift": "黄金会员见面礼", "A plush keychain from the launch merch, once": "上线周边毛绒挂件一个，只送一次", "Monthly cap for member coupons": "会员券每月上限", "Turns red above this": "超过会变红", "Perks after the service fee starts": "开始收服务费后的权益", "Orders a month; replaces the coupons": "每月单数；替代优惠券", "Use a number of 0 or more.": "请输入0或以上的数字。", "Member coupons are over the monthly cap": "会员券超出每月上限","Membership rules": "会员规则", "Free for everyone. Points have no cash value and never change pay or runner level.": "所有人免费加入。积分不能兑现，也不影响收入和跑腿员等级。", "Back to the agreed rules": "恢复约定的规则", "Only Admins can change membership rules. You can see them here.": "只有管理员可以修改会员规则，你可以在这里查看。", "Earning points": "获得积分", "Order delivered": "订单完成", "Student, after they confirm": "下单用户确认收货后", "Job delivered": "跑腿完成", "Runner, after the student confirms": "跑腿员，用户确认收货后", "First order bonus": "首单奖励", "Once per member": "每人一次", "Delivery details added": "填写收货信息", "Limits": "限制", "Same two students": "同一对用户", "Orders between them count at most this many times a week": "两人之间的订单每周最多计算这么多次", "times": "次", "Goodwill points": "补偿积分", "Most staff can give one member in a month": "后台每月最多给一位用户补偿的积分", "Points expire after": "积分有效期", "months": "个月", "Levels": "等级", "Points needed": "所需积分", "Members now": "当前人数", "Points counted over": "积分统计周期", "Rolling window; levels are checked on the 1st of each month": "按滚动周期计算；每月1日检查等级", "Drop at most one level a month": "每月最多降一级", "A Gold member who stops ordering goes to Silver first, not straight to Member.": "黄金会员不再下单时，先降到白银，不会直接降为普通会员。", "Perks": "会员权益", "Silver: free service fee": "白银：免服务费", "Orders a month; plus a badge and early access to new services": "每月单数；另有徽章和新服务抢先体验", "Gold: free service fee": "黄金：免服务费", "Orders a month; plus a badge": "每月单数；另有徽章", "Gold: priority help": "黄金：优先客服", "Support replies within": "客服回复时限", "Swap points for a free service fee": "积分兑换免服务费", "Any member, one order": "所有会员，可抵一单", "orders": "单", "points": "分", "The service fee is free during the launch, so these perks start when it is switched on.": "上线期间服务费全免，所以这些权益在开始收服务费后才生效。", "Never earns points": "不会获得积分", "Cancelled, refunded or reported orders": "已取消、已退款或被投诉的订单", "Inviting or sharing (WeChat bans rewards for this)": "邀请或分享（微信禁止此类奖励）", "Fake or self orders: points removed, account may be frozen": "刷单或自己给自己下单：扣除积分，账号可能被冻结", "Changes that affect members are announced in the app 14 days before they start. Every change is saved in Rule changes.": "影响用户的规则变更需提前14天在小程序公告。每次修改都会记录在“规则修改记录”里。", "Use a whole number of 0 or more.": "请输入0或以上的整数。", "Gold must need more points than Silver.": "黄金所需积分必须比白银多。", "Saved. Members are told 14 days ahead.": "已保存，将提前14天通知用户。", "Back to the agreed rules.": "已恢复约定的规则。", "Membership rules reset to the agreed rules": "会员规则恢复为约定规则", "Silver points": "白银所需积分", "Gold points": "黄金所需积分","Approve anyway": "仍然通过", "Approved anyway": "已强制通过", "Anyway": "强制通过", "Approved anyway.": "已强制通过。", "An automatic check failed. You can still approve; it is saved as \"approved anyway\" with your name.": "自动检查未通过。你仍可以通过，系统会记录为“强制通过”，并记下你的名字。","One-click approval":"一键审核","The system checks the student ID format and duplicates. If both pass, approve with one click. No student card photo is needed. Automatic checking with a student API comes later.": "系统会自动检查学号格式和是否重复。两项都通过，一键即可审核通过。不需要上传学生证照片。之后会接入学生身份接口自动核验。", "Details": "详情", "Check failed": "检查未通过", "An automatic check failed. Open Details to fix or reject.": "自动检查未通过，请打开详情修改或驳回。","Resolved":"已解决","Still open":"处理中","A staff member checks each applicant's real name and student ID, then approves or rejects. No student card photo is needed. Automatic checking with a student API comes later.": "由工作人员核对申请人的真实姓名和学号，然后通过或驳回，不需要上传学生证照片。之后会接入学生身份接口自动核验。", "to review": "份待审核", "None waiting": "没有待审核", "Student ID given": "填写的学号", "Joined Uniearn": "注册时间", "Automatic checks": "自动检查", "Student ID has the right format (7 digits)": "学号格式正确（7位数字）", "Student ID doesn't look like an XJTLU ID": "学号格式不像西浦学号", "No other account uses this student ID": "没有其他账号使用这个学号", "Another account already uses this student ID": "已有其他账号使用这个学号", "Real name has a family name and a given name": "真实姓名包含姓和名", "Real name looks incomplete": "真实姓名不完整", "Phone number verified by WeChat": "手机号已通过微信验证", "The real name looks like a real person, not a nickname": "真实姓名像真人姓名，不是昵称", "The student ID belongs to a current XJTLU student (check with the student list or ask in the class group)": "学号属于西浦在校学生（可对照学生名单，或在班级群里确认）", "The expected graduation year is this year or later": "预计毕业年份是今年或以后", "Student ID is not valid": "学号无效", "Student ID already used by another account": "学号已被其他账号使用", "Not a current XJTLU student": "不是西浦在校学生", "Ask them to correct their details": "请对方修改信息", "Can't approve while an automatic check fails. Ask the student to correct it, or reject.": "自动检查没通过时不能审核通过。请让学生修改，或者驳回。", "Message sent asking them to correct their details.": "已通知学生修改信息。", "XJTLU students only, after staff check their real name and student ID.": "只限西浦在校学生，需工作人员核对真实姓名和学号。", "Staff check name and student ID by hand": "工作人员人工核对姓名和学号", "I applied to be a runner three days ago. When will I be approved?": "I applied to be a runner three days ago. When will I be approved?","Pick a template or fill in the four steps. Names are filled in for you.": "选一个模板，或者按下面四步填写。券名称会自动生成。", "Start from a template": "从模板开始", "Minimum delivery fee": "使用门槛", "First order only": "仅限首单", "Who gets it": "发给谁", "Students collect it": "用户自己领取", "Shows in the app's coupon centre until it runs out.": "显示在小程序领券中心，领完为止。", "Send to chosen members": "发给指定用户", "Goes straight into their coupon list.": "直接发到用户的券包里。", "How many coupons": "发放数量", "Valid for": "有效期", "3 days": "3天", "14 days": "14天", "Preview": "预览", "what students see": "用户看到的样子", "Edit names": "修改券名称", "Discount type": "优惠类型", "What students see": "用户看到的样子", "Most off (¥)": "最多减（¥）", "A group of members": "按用户分组", "Pick members": "指定用户", "Choose recipients by": "选择发放对象", "No one found.": "没有找到。", "Or paste member IDs (separated by commas or spaces)": "或粘贴用户ID（用逗号或空格隔开）", "Search name or member ID": "搜索昵称或用户ID", "Search members to add": "搜索要添加的用户", "+ Add": "+ 添加", "Remove": "移除", "Filled in for you": "自动生成", "Choose at least one member to send it to.": "请至少选择一位用户。", "Discount": "优惠", "Order types": "订单类型","Order list":"订单列表","the date, area and type filters don't change these":"不受日期、宿舍区和类型筛选影响","Student can pick it":"用户可选","Name in Chinese (students see it in the Chinese app)":"中文名称（中文版小程序显示）","Name in English":"英文名称","e.g. New member: ¥2 off":"例如：New member: ¥2 off","Give the coupon a Chinese name.":"请填写中文券名。","Give the coupon an English name.":"请填写英文券名。","Admin · SIP campus": "管理后台 · 园区校区", "Overview": "概览", "Orders": "订单数", "Cancellations": "取消分析", "Members": "用户数", "Member list": "用户列表", "Member info": "用户信息", "Runners": "跑腿员", "Addresses & lockers": "地址与外卖柜", "Support": "客服", "Funds": "资金", "Coupons": "优惠券", "News": "群发通知", "Rules & setup": "规则设置", "English": "English", "Viewing as": "当前身份", "Admin (all controls)": "管理员（全部权限）", "Operations": "运营", "Admin": "管理员", "Ops": "运营", "Your name (saved on decisions)": "你的名字（审核、打款时记录）", "Roles decide who can refund, approve runners, export and change rules.": "不同身份决定谁能退款、审核跑腿员、导出数据和修改规则。", "Main": "主菜单", "Language": "语言", "Date range": "时间范围", "Dorm area": "宿舍区", "Order type": "订单类型", "Team and developer accounts and their orders": "团队和开发人员的账号及其订单", "How the campus is doing and what needs attention": "校园运营情况和待处理事项", "Every order, its timeline and money": "所有订单的进度和资金", "Why orders were cancelled, by reason": "按原因查看订单为什么被取消", "Member CRM: segments, points, good customers": "用户运营：分组、积分、优质用户", "Applications, rankings and marks": "认证审核、排行和违规记录", "Saved delivery addresses and the food locker for each building": "用户保存的收货地址和每栋楼的外卖柜位置", "Messages from students and runners": "用户和跑腿员发来的消息", "Money held, released to runners and refunded": "资金暂存、入账和退款", "Discounts students collect or staff send": "用户领取或后台发放的优惠", "Subscription messages to members who opted in": "给开启通知的用户发订阅消息", "Rules, places, switches, group QR and logs": "规则、地点、开关、群二维码和操作记录", "Today": "今天", "7 days": "近7天", "30 days": "近30天", "All": "全部", "All dorm areas": "全部宿舍区", "All types": "全部类型", "Wen Yuan": "文缘", "Wen Xing": "文星", "Wen Cui": "文萃", "Wen Hui": "文汇", "Wen Yuan 文缘": "文缘", "Wen Xing 文星": "文星", "Wen Cui 文萃": "文萃", "Wen Hui 文汇": "文汇", "Takeaway": "外卖代取", "Parcel": "快递代取", "Night market": "夜市代购", "Purchasing agent": "代购", "Show test data": "显示测试数据", "Sample data, not live.": "示例数据，不是真实数据。", "Green: on target": "绿色：达标", "Red: needs work": "红色：未达标", "Goals are set in Rules & setup": "目标可在“规则设置”里修改", "Order status now": "订单实时状态", "Live, all dates · click a box to see those orders": "实时数据，不限日期 · 点击查看对应订单", "Waiting for a runner": "待接单", "Taken": "已接单", "Runner on the way": "跑腿员赶往取件点", "Picked up": "已取货", "Delivering": "配送中", "Delivered, not confirmed": "已送达，待确认", "Money held": "资金暂存中", "Disputed": "申诉中", "✓ None open": "✓ 没有待处理申诉", "! Decide within 24 h": "! 24 小时内处理", "✓ None waiting over 10 min": "✓ 没有超过10分钟未接的单", "Compared with the period before · click a box to open the list": "与上一周期对比 · 点击查看明细", "Click a box to open the list": "点击查看明细", "Finished": "完成率", "Cancelled or expired": "取消/超时", "Median wait for a runner": "接单等待（中位数）", "Orders per trip": "每趟配送单数", "People": "人员", "All time": "全部时间", "Since the pilot started": "自试运营开始", "Ordered at least once": "下过单的用户", "Ordered again": "复购用户", "Certified runners": "已认证跑腿员", "Student check passed": "已通过学生认证", "At least one job delivered": "至少完成一单", "Needs attention": "待处理事项", "Across the whole campus, live": "全校区实时", "Open": "查看", "Reply": "去回复", "Upload new": "上传新码", "Review": "去审核", "Set": "去设置", "See": "查看", "Check": "去核对", "Official group QR code has expired": "官方群二维码已过期", "Runners leaving lobby drop-offs there don't know where to put the bag.": "跑腿员放大堂时不知道放在哪里。", "Paused runners can't take jobs for 7 days.": "被暂停的跑腿员7天内不能接单。", "Operations account is short": "运营账户余额不足", "Right now": "进行中的订单", "Waiting for runner": "待接单", "Orders per day": "每日订单", "Done": "已完成", "In progress": "进行中", "Cancelled": "已取消", "Show the numbers": "查看数据", "Day": "日期", "Cancel rate": "取消率", "When orders are posted": "下单时间分布", "Lunch": "午餐", "Dinner": "晚餐", "Why orders didn't finish": "订单未完成的原因", "No cancellations in this period.": "这段时间没有取消的订单。", "Time per order": "每单用时", "Finished orders only.": "只统计已完成订单。", "Median": "中位数", "· average": "· 平均值", "Type": "类型", "Wait to be taken": "等待接单", "Pickup": "取货", "Delivery": "配送", "Total": "总用时", "Student confirms": "用户确认收货", "By time asked": "按约定时间送达", "\"By time asked\" is for parcels, where the student picks a delivery time. One forgotten order can double an average, so judge by the median.": "“按约定时间送达”只统计快递单（用户自己选送达时间）。一单忘记确认就会把平均值拉高很多，所以以中位数为准。", "Dorm areas": "宿舍区", "Orders and cancel rate": "订单数和取消率", "Order types": "订单类型", "Orders and average delivery fee": "订单数和平均跑腿费", "Stacked bar chart": "堆叠柱状图", "Orders by hour of day": "按小时统计的订单", "By the day they were posted": "按下单日期", "All reasons ›": "全部原因 ›", "had no runner.": "是因为没人接单。", "vs previous day": "对比前一天", "no change": "没有变化", "same as previous": "与上期持平", "Any status": "全部状态", "Delivered · to confirm": "已送达 · 待确认", "Expired · no runner": "超时 · 无人接单", "Refunded after dispute": "申诉后已退款", "Any pickup point": "全部取件点", "North gate": "北门", "South gate": "南门", "East gate": "东门", "North gate food locker": "北门外卖柜", "Hanlin parcel station": "翰林驿站", "Wencui station": "文萃驿站", "Cancelled by anyone": "全部取消方", "Cancelled by student": "用户取消", "Cancelled by runner": "跑腿员取消", "Expired (system)": "系统超时关闭", "Any cancel reason": "全部取消原因", "Any settlement": "全部结算状态", "Held, not confirmed": "暂存中，待确认", "In runner wallet": "已入跑腿员钱包", "Refunded": "已退款", "Part refunded": "部分退款", "Not taken within 10 min": "10分钟内没人接", "Has complaint": "有投诉", "Grouped trips": "拼单", "Newest first": "最新在前", "Oldest first": "最早在前", "Highest fee": "跑腿费最高", "Export (masked)": "导出（已脱敏）", "Clear filters": "清除筛选", "Order": "订单号", "Status": "状态", "Posted": "下单时间", "Delivery fee": "跑腿费", "Route": "路线", "Bags": "件数", "Wait": "等待", "Student": "下单用户", "Runner": "跑腿员", "so far": "（仍在等）", "Grouped": "拼单", "Previous": "上一页", "Next": "下一页", "Search order ID, member or runner": "搜索订单号、用户或跑腿员", "Search orders": "搜索订单", "Pickup point": "取件点", "Cancelled by": "取消方", "Cancel reason": "取消原因", "Settlement": "结算状态", "¥ min": "最低 ¥", "Minimum fee": "使用门槛", "¥ max": "最高 ¥", "Maximum fee": "最高跑腿费", "Sort": "排序", "Grouped with another order": "和其他订单拼单", "Back to students' WeChat Pay": "原路退回用户微信", "Cancel reasons": "取消原因", "Reason": "原因", "As students see it": "用户看到的选项", "Share": "占比", "Previous period": "上一周期", "In the app": "小程序内可选", "same": "持平", "Staff": "后台", "‹ All cancel reasons": "‹ 全部取消原因", "Open these in Orders": "在订单管理中查看", "Share of cancellations": "占全部取消", "Time before cancelling": "取消前等待", "Median, posted → cancelled": "中位数，下单 → 取消", "Low fees go untaken.": "跑腿费低的单没人接。", "When these orders were posted": "这些订单的下单时间", "By delivery fee": "按跑腿费", "Over ¥5": "¥5以上", "By dorm area": "按宿舍区", "By order type": "按订单类型", "Waited": "等了", "Automatic": "系统自动", "after taken": "接单后", "Note": "备注", "Test order": "测试单", "No orders were cancelled for this reason in this period. Try a longer date range.": "这段时间没有因这个原因取消的订单，可以把时间范围调长一些。", "No one took the order": "没人接单", "Collected it myself": "我自己取了", "Changed my mind": "不需要了", "Wrong details in the order": "订单信息填错了", "Runner too slow to pick up": "跑腿员取货太慢", "Other": "其他", "Runner cancelled: can't go any more": "跑腿员取消：临时有事", "Runner cancelled: bags didn't match": "跑腿员取消：外卖对不上", "Runner cancelled: food not found": "跑腿员取消：没找到外卖", "Cancelled by staff on request": "客服应用户要求取消", "Cancelled after a runner took it (50% back)": "接单后取消（退一半）", "Dispute upheld": "申诉成立", "Cancelled by staff": "客服取消", "Student, or automatic when the order closes": "用户取消，或订单超时自动关闭", "Student, after a runner took it": "用户（跑腿员已接单后）", "Student, with a short note": "用户，需要写简短说明", "Team": "团队", "Students pick one reason on the cancel screen; \"Other\" asks for a short note. \"No one took the order\" also counts orders that closed automatically with no runner (30 min after takeaway was due).": "用户取消时选择一个原因；选“其他”需要填写说明。“没人接单”也包括没人接、到时间自动关闭的订单（外卖送达时间后30分钟）。", "Good customers": "优质用户", "Watch list": "重点关注", "All members": "全部用户", "Active now": "活跃用户", "At risk": "流失风险", "Joined, no order yet": "注册未下单", "Silver": "白银会员", "Gold": "黄金会员", "Sort: Last active": "排序：最近活跃", "Sort: Points": "排序：积分", "Sort: Orders": "排序：订单数", "Sort: Newest members": "排序：最新注册", "Message this segment": "给这组用户发通知", "Member": "普通会员", "Level": "等级", "Points": "积分", "Jobs": "跑腿单", "Last active": "最近活跃", "Dorm": "宿舍", "Tags": "标签", "Off": "未开启", "On": "已开启", "Parcels": "快递常客", "Segments": "用户分组", "Opened the app or ordered in the last 14 days": "14天内打开过小程序或下过单", "Not active for more than 14 days": "超过14天没有活跃", "Signed up but never posted an order": "注册了但从没下过单", "Certified to take jobs": "已认证，可以接单", "Posted 1 or more orders": "下过1单及以上", "Posted 2 or more orders": "下过2单及以上", "Search nickname or member ID": "搜索昵称或用户ID", "Search members": "搜索用户", "Fees paid": "支付跑腿费", "Last order": "最近下单", "Favourite": "常下单类型", "Confirms in": "确认收货用时", "Stopped": "已停止", "Most finished orders with a low cancel rate and no complaints. Use for thank-you messages, early testers and check-ins when they stop ordering. Staff only; never shown to members.": "完成订单多、取消率低、没有投诉的用户。可以用来发感谢消息、邀请内测，或在他们不再下单时回访。仅后台可见，不对用户展示。", "Students who cancel a lot or never confirm (so runners wait for auto-confirm), and runners who cancel after taking jobs. A check-in comes first; marks and freezes follow the platform rules.": "经常取消或从不确认收货（跑腿员只能等自动确认）的用户，以及接单后又取消的跑腿员。先沟通了解情况；记违规或冻结按平台规则执行。", "Students": "下单用户", "Cancelled by them": "本人取消", "Left to auto-confirm": "未确认（自动确认）", "Why listed": "列入原因", "Slow to confirm": "确认收货慢", "Cancels often": "经常取消", "Cancelled after taking": "接单后取消", "Active marks": "当前违规记录", "Can take jobs": "可以接单", "Ambassador": "校园大使", "Lunch regular": "午餐常客", "Needs help": "需要协助", "Nobody on the list.": "名单为空。", "XJTLU student check passed": "已通过西浦学生认证", "Never ran a job": "从未接过单", "Good targets for a first-job nudge": "适合提醒他们接第一单", "Applications to check by hand": "待人工审核的申请", "Applications": "认证申请", "Ranking": "排行", "Marks & pauses": "违规与暂停", "Levels": "等级", "To review": "待审核", "Approved": "已通过", "Rejected": "已驳回", "Revoked": "已撤销", "Checked by hand for now": "目前人工审核", "A staff member opens each student card photo and approves or rejects it. Automatic checking with a student API comes later.": "由工作人员逐一查看学生证照片后通过或驳回。之后会接入学生身份接口自动核验。", "ready to review": "份可以审核", "waiting for a photo": "份等待上传照片", "Start reviewing (oldest first)": "开始审核（从最早的开始）", "Applicant": "申请人", "Waiting": "已等待", "Student ID": "学号", "Card photo": "学生证照片", "Uploaded": "已上传", "Not uploaded": "未上传", "Applied": "申请时间", "Checked by": "审核人", "Nothing here.": "暂无记录。", "Median delivery": "配送用时（中位数）", "Rating": "评分", "Earned": "收入", "Last job": "最近接单", "Inactive": "不活跃", "Top": "金牌", "Trusted": "资深", "Rising": "进阶", "New": "新手", "Rule": "违规类型", "Given": "记录时间", "Expires": "到期", "Warning": "提醒", "Back to New": "降回新手", "No active marks.": "没有违规记录。", "Late cancel (under 15 min before food)": "临近取餐取消（不足15分钟）", "Left before student replied": "没等用户回复就离开", "No drop-off photo": "没拍送达照片", "Delivered after 15 min": "取货后超过15分钟送达", "Wrong bag": "拿错外卖", "Pay limit per trip": "单趟金额上限", "Reached after": "升级条件", "Limit per trip": "单趟上限", "Runners now": "当前人数", "Student check": "通过学生认证", "No limit": "不限", "Runner levels": "跑腿员等级", "5 finished jobs": "完成5单", "10 finished jobs": "完成10单", "20 finished jobs": "完成20单", "Up to 5 bags per trip at every level. Points and membership never change a runner's level.": "每个等级单趟最多5件。积分和会员等级不影响跑腿员等级。", "Who can take what": "接单资格", "XJTLU students only, after the student card check.": "只限西浦在校学生，需通过学生证审核。", "Runners never see or take their own orders.": "跑腿员看不到、也不能接自己的订单。", "The job hall shows routes, prices and times. Room, full phone and pickup code unlock only after taking.": "接单大厅只显示路线、价格和时间。房间号、完整手机号和取件码接单后才可见。", "Runners who can't enter a building (male/female dorms) only see lobby drop-offs there.": "不能进入的楼（男女生宿舍），跑腿员只看到放大堂的订单。", "Phase 2 tasks: Rising and above; over ¥15 Trusted and Top; over ¥25 Top only.": "二期任务：进阶及以上可接；超过¥15限资深和金牌；超过¥25只限金牌。", "One mark per broken rule. Marks carry no money and expire after 14 days. 3 active marks send a runner back to New; 5 pause them for 7 days.": "每违反一次规则记一次，不扣钱，14天后自动失效。累计3次降回新手，5次暂停接单7天。", "Saved addresses": "已保存地址", "One per student, used on every order": "每位用户一个，每次下单使用", "Added, last 7 days": "近7天新增", "New students ready to order": "新用户已准备好下单", "Missing a room number": "缺少房间号", "Runner can only use the lobby": "跑腿员只能放大堂", "Buildings with a locker set": "已设置外卖柜的楼", "Where lobby drop-offs go": "放大堂时放在这里", "Food lockers by building": "各楼外卖柜", "All buildings": "全部楼栋", "Missing room": "缺少房间号", "Building has no locker set": "楼栋未设置外卖柜", "ID": "编号", "Contact name": "联系人", "Phone": "手机号", "Room": "房间号", "Drop-off": "送达方式", "Food locker": "外卖柜", "Orders here": "送到这里的订单", "Added": "添加时间", "At the door": "放门口", "Lobby": "放大堂", "Not set": "未设置", "Missing": "缺失", "Lobby, by the notice board": "大堂公告栏旁", "Outside the side door, under the canopy": "侧门外雨棚下", "Lobby shelf, left of the main door": "大堂正门左侧置物架", "Ground floor, next to the vending machines": "一楼自动售货机旁", "Search member, contact name or building (e.g. D04)": "搜索用户、联系人或楼栋（如 D04）", "Search addresses": "搜索地址", "Building": "楼栋", "Set the food locker once per building. Every saved address in that building uses it, and runners see it on the job card when the student chose lobby drop-off.": "每栋楼只需设置一次外卖柜位置。这栋楼的所有地址都会使用它；用户选择放大堂时，跑腿员会在订单卡片上看到。", "Food locker location": "外卖柜位置", "Addresses": "地址数", "Lobby drop-off": "选择放大堂", "Not set: e.g. Lobby shelf, left of the door": "未设置：例如 大堂门左侧置物架", "Only Admins can change locker locations.": "只有管理员可以修改外卖柜位置。", "Hang it on the door, with a photo": "挂在门把手上，并拍照", "Lobby, the student comes down": "放大堂，用户下楼取", "Last used": "最近使用", "Not used yet": "还没使用", "Logged under Rules & setup.": "操作会记录在“规则设置”里。", "Orders to this address": "送到这个地址的订单", "No orders yet.": "暂无订单。", "Addresses belong to the student. Staff can look but not edit; the student changes it in Me → Delivery details.": "地址属于用户本人。后台只能查看不能修改；用户在“我的 → 收货信息”里修改。", "runners can only use the lobby": "跑腿员只能放大堂", "Show room and full phone": "显示房间号和完整手机号", "Show full phone, student ID and room": "显示完整手机号、学号和房间号", "Waiting for a reply": "待回复", "Median first reply": "首次回复用时（中位数）", "✓ Everyone answered": "✓ 全部已回复", "To reply": "待回复", "‹ Back": "‹ 返回", "Item size": "物品大小", "Runner rules": "跑腿规则", "Refund": "退款", "Order not received": "没收到", "Runner was late": "送达太慢", "Payment": "支付问题", "Runner certification": "跑腿认证", "Payout question": "提现问题", "Account": "账号", "Suggestion": "建议", "Checking now": "正在处理", "Refund timing": "退款到账", "Drop-off photo": "送达照片", "Post as large": "大件下单", "Withdrawals": "提现说明", "Send": "发送", "Joined": "注册时间", "Open full profile ›": "查看完整资料 ›", "Linked order": "关联订单", "Link one of their orders": "关联该用户的订单", "Choose an order": "选择订单", "This conversation": "本次会话", "Needs reply": "待回复", "Replied": "已回复", "First reply": "首次回复", "Messages": "消息数", "Inbox": "消息列表", "Search name, message or order": "搜索名字、消息或订单号", "Search conversations": "搜索会话", "Topic": "问题类型", "Quick replies": "快捷回复", "Unlink": "取消关联", "No orders to link.": "没有可关联的订单。", "Earlier conversations": "历史会话", "Uniearn ·": "Uniearn ·", "You:": "我：", "Pick a conversation on the left.": "从左侧选择一个会话。", "Member and order details show here.": "这里会显示用户和订单信息。", "[Image]": "[图片]", "Gold member: reply within 2 h.": "黄金会员：2小时内回复。", "Money flow": "资金流向", "Runner wallets": "跑腿员钱包", "Student pays": "用户付款", "WeChat Pay, when posting": "下单时微信支付", "Basic account": "基本账户", "Held until confirmed": "确认收货前暂存", "Operations account": "运营账户", "Uniearn moves money in": "由 Uniearn 转入", "Runner wallet": "跑腿员钱包", "Credited on confirm": "确认收货后入账", "WeChat balance": "微信零钱", "After withdrawal review": "提现审核通过后", "Paid by students": "用户实付", "Credited to runner wallets": "已入跑腿员钱包", "Full delivery fee on every finished job": "每单完成后全额跑腿费入账", "Withdrawn to WeChat balance": "已提现到微信零钱", "Coupon cost": "优惠券补贴", "Paid by Uniearn so runners get the full fee": "由 Uniearn 承担，跑腿员拿全额", "Held right now": "当前暂存", "Service fee revenue": "服务费收入", "Free during launch (10% later)": "上线期间免收（之后收10%）", "WeChat Pay fee (0.6%)": "微信支付手续费（0.6%）", "Paid by Uniearn": "由 Uniearn 承担", "✓ Enough to pay runners": "✓ 足够支付跑腿员", "! Not enough to pay runners": "! 不够支付跑腿员", "Balance now (¥)": "当前余额（¥）", "Daily totals": "每日汇总", "Orders by the day they were posted; withdrawals by the day paid": "订单按下单日期，提现按打款日期", "Students paid": "用户实付", "To wallets": "入钱包", "Withdrawn": "已提现", "Refunds by reason": "按原因统计退款", "Goes to the runner's wallet when confirmed": "确认收货后转入跑腿员钱包", "Held": "暂存金额", "Goes to wallet": "何时入账", "After delivery and confirm": "送达并确认后", "No runner yet": "还没人接", "Refunded if no runner": "没人接会自动退款", "After a decision": "处理申诉后", "How money moves": "资金流向", "Nothing held.": "没有暂存资金。", "No refunds.": "没有退款。", "Waiting for review": "待审核", "Amount waiting": "待审核金额", "Frozen in runner wallets": "已在跑腿员钱包中冻结", "Median time to pay": "打款用时（中位数）", "✓ Goal: within 24 h": "✓ 目标：24小时内", "! Goal: within 24 h": "! 目标：24小时内", "Oldest first. Approving sends the money from the operations account to the runner's WeChat balance.": "按申请时间排序。通过后从运营账户打款到跑腿员微信零钱。", "Amount": "金额", "Requested": "申请时间", "Wallet after": "提现后钱包余额", "Approve and pay": "通过并打款", "Reject": "驳回", "No withdrawals waiting.": "没有待审核的提现。", "Check the amount matches the runner's finished jobs. Rejecting returns the money to their wallet and tells them why.": "请核对金额和跑腿员完成的订单是否一致。驳回后钱退回钱包，并告知原因。", "History": "历史记录", "Result": "结果", "Paid to WeChat balance": "已打款到微信零钱", "Rejected by staff": "后台驳回", "WeChat name does not match the runner": "微信实名与跑腿员不一致", "None in this period.": "这段时间没有记录。", "In runner wallets": "跑腿员钱包余额", "Not withdrawn yet": "还没提现", "Frozen for withdrawal": "提现冻结中", "Paid out, all time": "累计已打款", "To WeChat balance": "到微信零钱", "Wallet balance": "钱包余额", "Frozen": "冻结", "Earned, all time": "累计收入", "Last withdrawal": "最近提现", "Not enough in the operations account": "运营账户余额不足", "Running now": "进行中", "Collected or sent": "已领取/已发放", "All coupons, all time": "全部优惠券，累计", "Used": "已使用", "Use rate": "使用率", "Valid dates": "有效期", "Orders with a coupon": "用券订单占比", "Runners always get the full delivery fee.": "跑腿员始终拿到全额跑腿费。", "The student pays less; Uniearn pays the difference, shown as coupon cost in Funds. Students collect coupons in the app's coupon centre, or staff send them to chosen members.": "用户少付的部分由 Uniearn 补贴，计入“资金管理”的优惠券补贴。用户可以在小程序领券中心领取，也可以由后台定向发放。", "New coupon": "新建优惠券", "Coupon": "优惠券", "Discount": "优惠内容", "Valid": "有效", "Collected": "已领取", "Cost to Uniearn": "Uniearn 补贴", "Starts later": "未开始", "Running": "进行中", "Ended": "已结束", "All collected": "已领完", "All order types": "全部订单类型", "collect in the app": "用户领取", "sent by staff": "后台发放", "first order only": "仅限首单", "Quantity": "发放数量", "No minimum": "无门槛", "Per student": "每人限领", "1 coupon": "1 张", "Who pays": "谁来承担", "Uniearn. The runner still gets the full delivery fee.": "Uniearn 承担，跑腿员仍拿全额跑腿费。", "Send to members": "发给用户", "Or member IDs (up to 100, separated by commas or spaces)": "或填写用户ID（最多100个，用逗号或空格隔开）", "Members who already have this coupon are skipped. Never ask students to share or invite friends to get a coupon.": "已经有这张券的用户会自动跳过。不要用“分享/邀请好友”作为领券条件。", "Stop this coupon": "停用这张券", "Collected coupons can't be used after you stop it.": "停用后，已领取的券也不能再使用。", "Not used yet.": "还没人使用。", "The discount and dates can't be changed after you create it.": "创建后不能修改优惠金额和有效期。", "Name students see": "券名称（用户可见）", "e.g. 新人首单立减2元": "例如：新人首单立减2元", "Amount off": "立减", "Percent off": "折扣", "Amount off (¥)": "立减金额（¥）", "Percent off (%)": "折扣比例（%）", "Most off (¥, percent only)": "最多减（¥，仅折扣券）", "Minimum delivery fee (¥, 0 = none)": "使用门槛（¥，0 = 无门槛）", "How students get it": "发放方式", "Collect in the app's coupon centre": "用户在领券中心领取", "Staff send it to chosen members": "后台定向发给指定用户", "Starts": "开始日期", "Ends": "结束日期", "One per student. Uniearn pays the discount; the runner gets the full delivery fee.": "每人限领一张。优惠由 Uniearn 承担，跑腿员拿全额跑腿费。", "Create coupon": "创建优惠券", "Cancel": "取消", "Coupons are paid by Uniearn; runners always get the full delivery fee.": "优惠券由 Uniearn 承担，跑腿员始终拿全额跑腿费。", "New message": "新建通知", "Sent as a WeChat subscription message": "以微信订阅消息发送", "Segment": "用户分组", "All areas": "全部宿舍区", "Message": "通知内容", "Rules for news": "群发规则", "At most one news message per member a week.": "每位用户每周最多收到一条通知。", "Only members who turned on \"News from Uniearn\" (off by default).": "只发给开启了“Uniearn 通知”的用户（默认关闭）。", "At most 1 a week per member.": "每人每周最多1条。", "Order updates are never used for marketing.": "订单通知不能用来做营销。", "No rewards for inviting or sharing (WeChat bans them).": "不做邀请、分享奖励（微信规则禁止）。", "Sent": "已发送", "Area": "宿舍区", "Delivered to": "送达人数", "By": "发送人", "All opted in": "全部已开启通知用户", "One member": "单个用户", "Short and useful. No rewards for sharing or inviting.": "简短实用，不要写分享或邀请奖励。", "Order rules": "订单规则", "Used by grouping, timers and refunds": "用于拼单、计时和退款", "Grouping window": "拼单时间窗口", "Orders due within this many minutes of the earliest one can share a runner.": "与最早一单相差在这个时间内的订单可以由同一个跑腿员配送。", "min": "分钟", "Bags per trip": "单趟件数上限", "A group or trip never holds more than this.": "一次拼单或一趟配送不超过这个件数。", "bags": "件", "Close untaken takeaway": "无人接单外卖关闭时间", "Minutes after the food is due. Then a full refund.": "外卖送达时间后多少分钟关闭，并全额退款。", "Deliver within": "送达时限", "After pickup. Later counts against the runner's on-time record.": "从取货开始计算。超时会计入跑腿员准时记录。", "Student reply time": "用户回复时限", "If the runner can't get in. After this the lobby counts as delivered.": "跑腿员进不去楼时等待用户回复；超时放大堂即算送达。", "Report window, takeaway": "外卖申诉时限", "After delivery. Reports need a photo.": "从送达开始计算，申诉需要上传照片。", "\"My food is late\" move": "“外卖晚到”改时间", "Auto-confirm takeaway": "外卖自动确认", "Runner is paid if the student doesn't confirm.": "用户不确认时，到时间自动确认并给跑腿员入账。", "Auto-confirm parcel": "快递自动确认", "Auto-confirm task": "任务自动确认", "Mark expires after": "违规记录有效期", "days": "天", "Prompt \"Add ¥1–2\" after": "提示“加价¥1–2”的时间", "For low-fee orders nobody has taken.": "针对跑腿费低、没人接的订单。", "Open: Recommended, not decided.": "待定：建议开启，尚未决定。", "Task price cap": "任务价格上限", "Open: ¥50 cap not confirmed.": "待定：¥50 上限未确认。", "Open: Parcels: keep 15 min or allow longer (an older note said 45)?": "待定：快递保持15分钟，还是放宽（旧方案是45分钟）？", "Goals": "目标设置", "Numbers turn green when they meet the goal, red when they don't": "达到目标显示绿色，没达到显示红色", "Green at or above": "达到或高于为绿色", "Green at or below": "达到或低于为绿色", "Orders finished": "订单完成率", "Students who ordered again": "复购率", "Delivered within 15 min": "15分钟内送达", "Longest wait for a reply": "最久未回复时长", "Runner application waiting": "跑腿认证等待时长", "Coupons used": "优惠券使用率", "Official group QR": "官方群二维码", "Expired": "已过期", "Expires soon": "即将过期", "No current code": "暂无二维码", "WeChat group codes last 7 days. Upload a fresh one every week; the app shows it on \"Join our group\".": "微信群二维码有效期7天，请每周上传新的；小程序“加入官方群”页面会显示它。", "Upload new code": "上传新二维码", "Money and switches": "资金与开关", "Service fee": "服务费", "10% of the delivery fee, paid by the student on top. Free during the launch.": "按跑腿费的10%向用户额外收取。上线期间免收。", "Locked until the payment route is confirmed.": "确认支付方案前锁定。", "Post any task": "发布任意任务", "Phase 2. Off for the launch (takeaway and parcels only).": "二期功能。上线期间关闭（只做外卖和快递）。", "Runner check": "跑腿员认证方式", "How a student becomes a runner.": "学生如何成为跑腿员。", "Staff check the card by hand": "工作人员人工审核学生证", "Student API (coming later)": "学生身份接口（后续接入）", "Runner pay limit per trip": "跑腿员单趟金额上限", "View levels": "查看等级", "Pickup points": "取件点", "SIP campus": "园区校区", "Add point": "新增取件点", "Name": "名称", "Kind": "类型", "Shown in app": "小程序显示", "Gate": "校门", "Parcel station": "快递驿站", "New pickup point": "新取件点", "Dorm buildings": "宿舍楼", "Female": "女生楼", "Male": "男生楼", "Edit": "修改", "Students can choose girl or boy in the app; if they don't, the Members page uses this building setting and marks it “from dorm”. It's used for lobby drop-offs and member filters, never to rank people or set prices.": "学生可以在小程序里选择性别；没有选择的，用户管理页按这里的宿舍楼性别判断，并标注“按宿舍楼”。只用于大堂放置和用户筛选，不用于排序或定价。", "Rule changes": "规则修改记录", "No changes yet. Every change is logged here with who made it.": "暂无修改。每次修改都会记录在这里，包括修改人。", "Rule changes that affect members are announced in the app 14 days ahead.": "影响用户的规则变更需提前14天在小程序公告。", "Export log": "导出记录", "Admins only. Phones and student IDs stay masked in every export.": "只有管理员可以导出。导出的手机号和学号都会脱敏。", "Private details viewed": "隐私信息查看记录", "Nobody has opened a room number or full phone number. Each view is logged here (PIPL).": "还没有人查看过房间号或完整手机号。每次查看都会记录在这里（个人信息保护法）。", "Staff roles": "后台身份权限", "Can…": "可以…", "Reply to tickets": "回复客服消息", "Yes": "可以", "Refund and decide disputes": "退款和处理申诉", "Approve runners and give marks": "审核跑腿员、记违规", "Send news and goodwill points": "群发通知、补偿积分", "Export data": "导出数据", "See room or full phone (logged)": "查看房间号或完整手机号（有记录）", "Change rules and places": "修改规则和地点", "Only Admins can change rules. You can see them here.": "只有管理员可以修改规则，你可以在这里查看。", "Charge service fee": "收取服务费", "Pickup name": "取件点名称", "Dorm gender": "男女生楼", "×": "×", "%": "%", "h": "小时", "First order": "首单", "Timeline": "订单进度", "Posted & paid": "下单并支付", "Taken by runner": "跑腿员接单", "Delivered with photo": "拍照送达", "Confirmed, runner paid": "已确认收货，跑腿员已入账", "Auto-confirmed, runner paid": "自动确认收货，跑腿员已入账", "No chat yet. A chat opens when a runner takes the order.": "暂无聊天。跑腿员接单后才会开启聊天。", "Private between the student and runner. Staff can read it for support; this view is logged under Rules & setup. Phone numbers are masked in calls and chat.": "聊天只在用户和跑腿员之间。客服处理问题时可以查看，查看会记录在“规则设置”里。通话和聊天中的手机号均已隐藏。", "Deliver to": "送达地址", "None yet": "暂无", "The runner sees these only while the job is open. Staff views are logged.": "跑腿员只在订单进行中能看到这些信息。后台查看会被记录。", "Money": "资金", "Student paid": "用户实付", "Staff notes": "内部备注", "Add": "添加", "Mark as test order": "标记为测试单", "Hides it from every total.": "所有统计中都不再计入。", "Close": "关闭", "Add a note for the team": "给团队写备注", "Not set for this building": "该楼未设置", "Drop-off photo (sample)": "送达照片（示例）", "Actions": "操作", "This follows the refund rules and can't be undone.": "按退款规则执行，操作后不能撤回。", "Yes, refund": "确认退款", "Keep the order": "不取消", "Cancel · full refund": "取消 · 全额退款", "Cancel · 50% refund": "取消 · 退款50%", "Decide": "去处理", "See decision": "查看结果", "Tickets": "客服会话", "Order taken by the runner": "跑腿员已接单", "Delivered with a drop-off photo": "已拍照送达", "Confirmed by the student": "用户已确认收货", "runner paid": "跑腿员已入账", "Auto-confirmed": "自动确认收货", "Closed after review": "处理后关闭", "last 4 digits and seal checked": "已核对手机尾号和封签", "The runner cancelled": "跑腿员取消了", "order went back to the job hall": "订单已重新进入接单大厅", "Cancelled by the student": "用户已取消", "50% refunded, the runner keeps half": "退款50%，另一半给跑腿员", "student": "用户", "runner": "跑腿员", "all to the runner": "全部给跑腿员", "free at launch": "上线期间免收", "paid by Uniearn": "由 Uniearn 承担", "Female dorm": "女生楼", "Male dorm": "男生楼", "on time": "准时", "late": "晚到", "Summary": "概览", "Notes & actions": "备注与操作", "Member ID": "用户ID", "WeChat name": "微信昵称", "Campus": "校区", "XJTLU SIP": "西浦园区校区", "Found us via": "了解渠道", "Poster": "海报", "Booth": "摆摊", "Dorm group": "宿舍群", "Unknown": "未知", "Uses Uniearn as": "使用身份", "Student and Runner": "下单用户和跑腿员", "Contact & address": "联系方式和地址", "As a student": "作为下单用户", "Usually orders": "常下单时段", "As a runner": "作为跑腿员", "Certification": "认证", "Finished jobs": "完成跑腿单", "from students": "来自用户支付", "Wallet": "钱包", "Graduates": "毕业年份", "Membership": "会员", "Disputes": "申诉", "None.": "无。", "On time": "准时率", "Give mark": "记一次违规", "Remove": "撤销", "They cancelled": "本人取消", "They were": "身份", "With": "对方", "Last message": "最后一条消息", "Open an order to read its chat. Each chat you open is logged.": "打开订单才能查看聊天记录，每次查看都会被记录。", "To next level": "距离下一级", "When": "时间", "What": "内容", "Cancelled, refunded and reported orders earn nothing. Points have no cash value and never change pay or runner level.": "取消、退款和被投诉的订单不得积分。积分不能兑现，也不影响收入和跑腿员等级。", "No tickets.": "没有客服会话。", "No disputes.": "没有申诉。", "They reported": "本人发起", "Reported against them": "被申诉", "upheld": "申诉成立", "rejected": "申诉不成立", "open": "处理中", "Tags (staff only)": "标签（仅后台可见）", "Goodwill points": "补偿积分", "Give": "发放", "News message": "单独通知", "This member hasn't turned on \"News from Uniearn\".": "该用户没有开启“Uniearn 通知”。", "Already messaged in the last 7 days.": "近7天已经发过通知。", "Message to this member": "给该用户的通知", "Set automatically from orders": "根据订单自动设置", "Reason (required)": "原因（必填）", "Add a note": "添加备注", "Paused": "已暂停", "Never applied to run.": "从未申请成为跑腿员。", "Not a runner.": "不是跑腿员。", "First delivered order": "首单完成", "Added delivery details": "填写收货信息", "No points yet.": "还没有积分。", "No chats yet.": "暂无聊天。", "Morning": "上午", "Lunch (11–14)": "午餐（11–14点）", "Afternoon": "下午", "Dinner (17–20)": "晚餐（17–20点）", "Evening": "晚上", "Runner application": "跑腿员认证申请", "Manual check": "人工审核", "No student card photo uploaded.": "没有上传学生证照片。", "Ask the student to upload one in the app.": "请提醒学生在小程序里上传。", "Real name given": "填写的真实姓名", "Student ID typed": "填写的学号", "Expected graduation": "预计毕业", "certification ends then": "届时认证失效", "Check before approving": "通过前请核对", "Photo shows a current XJTLU student card (not a screenshot of someone else's)": "照片是本人有效的西浦学生证（不是别人的截图）", "Name on the card matches the real name given": "学生证上的姓名与填写的真实姓名一致", "Card is valid this academic year": "学生证本学年有效", "Student ID on the card matches the one typed in": "学生证上的学号与填写的学号一致", "Approve": "通过", "Photo unreadable": "照片看不清", "Not an XJTLU student card": "不是西浦学生证", "Name does not match": "姓名不一致", "Student ID does not match": "学号不一致", "Card expired": "学生证已过期", "Ask for a clearer photo": "请对方重新上传清晰照片", "Keeps it in the queue and messages the student.": "申请保留在待审核列表，并通知学生。", "Can't approve without a photo. Ask the student to upload one; it comes back to the queue when they do.": "没有照片不能通过。请学生上传，上传后会回到待审核列表。", "XJTLU · Student card (sample)": "西浦 · 学生证（示例）", "Checked": "审核", "Revoke certification": "撤销认证", "Student card photo (sample)": "学生证照片（示例）", "Graduated": "已毕业", "Revoked by staff": "后台撤销", "Name on the card": "姓名", "Valid until": "有效期至", "Name does not match WeChat profile": "姓名与微信资料不一致", "No photo uploaded": "未上传照片", "Student's photo": "用户上传的照片", "(sample)": "（示例）", "Runner's drop-off photo": "跑腿员的送达照片", "Delivery fee held": "暂存的跑腿费", "Decision": "处理结果", "Reason (shown to both)": "原因（双方可见）", "Refund to student": "退给用户", "Uphold · refund": "申诉成立 · 退款", "Reject · pay runner": "申诉不成立 · 给跑腿员入账", "e.g. Photo shows a different bag": "例如：照片中的袋子不是这一单", "Refund the affected part; the rest goes to the runner. Wrong bag: the runner also pays back the food, taken from their next payouts.": "只退有问题的部分，其余给跑腿员。拿错外卖的，跑腿员还要赔偿餐费，从之后的收入中扣除。", "Not received": "没收到", "Spilled": "洒了", "Upheld": "申诉成立", "Rejected · paid": "不成立 · 已入账", "Upheld · refunded": "成立 · 已退款", "Needs Admin role": "需要管理员身份", "Needs Admin or Operations role": "需要管理员或运营身份", "Needs Admin or Operations or Support role": "需要管理员、运营或客服身份", "TEST": "测试", "Open profile": "查看资料", "Uniearn": "Uniearn", "Uniearn Admin": "Uniearn 管理后台", "Takeaway, Parcel, Night market, Purchasing agent": "外卖代取、快递代取、夜市代购、代购", "Takeaway, Parcel": "外卖代取、快递代取", "Add a reason for both sides.": "请填写给双方看的原因。", "Add a reason.": "请填写原因。", "Certification revoked.": "已撤销认证。", "Coupon created.": "优惠券已创建。", "Coupon stopped.": "优惠券已停用。", "Decision sent to the student and runner.": "处理结果已通知用户和跑腿员。", "Enter how many points.": "请填写积分数量。", "Enter the balance in yuan.": "请输入余额（元）。", "Export logged. Downloads are off in this prototype.": "已记录导出。原型中不能真正下载。", "Goal saved.": "目标已保存。", "Mark removed.": "已撤销违规记录。", "Marked as test. Hidden from totals.": "已标记为测试单，不再计入统计。", "Message sent asking for a clearer photo.": "已通知学生重新上传清晰照片。", "New group code is live for 7 days.": "新群二维码已生效，有效期7天。", "Not enough in the operations account.": "运营账户余额不足。", "Order linked.": "已关联订单。", "Refund sent through WeChat Pay.": "已通过微信支付退款。", "Rejected. The money is back in their wallet.": "已驳回，钱已退回跑腿员钱包。", "Reply sent.": "已发送回复。", "Resolved.": "已解决。", "Saved. Members are told 14 days ahead if it affects them.": "已保存。如果影响用户，需要提前14天通知。", "Sent to 1 member.": "已发送给 1 位用户。", "Shown. This view is logged.": "已显示，这次查看已被记录。", "Up to 100 member IDs at a time.": "每次最多100个用户ID。", "Use a number of 0 or more.": "请输入0或以上的数字。", "Write a reply first.": "请先写回复内容。", "Write the message first.": "请先写通知内容。", "Write the note first.": "请先写备注。", "Sent and resolved.": "已发送并解决。", "Mark given.": "已记录违规。", "Mark given. Runner paused for 7 days.": "已记录违规，跑腿员暂停接单7天。", "Mark given. Runner is back to New.": "已记录违规，跑腿员降回新手。", "None left to send.": "券已经发完了。", "Everyone chosen already has it.": "选中的用户都已经有这张券。", "Locker location cleared.": "已清除外卖柜位置。", "Approved. They can take jobs now.": "已通过，现在可以接单了。", "Rejected. The student is told why and can apply again.": "已驳回，学生会收到原因，可以重新申请。", "Next one opened.": "已打开下一份。", "Queue is empty.": "全部审核完了。", "Give the coupon a name.": "请填写券名称。", "Enter the discount.": "请填写优惠金额。", "Percent off must be under 100.": "折扣比例需小于100。", "Set the most a percent coupon can take off.": "请设置折扣券最多减多少。", "Enter how many coupons.": "请填写发放数量。", "Choose at least one order type.": "至少选择一种订单类型。", "The end date must be on or after the start date.": "结束日期不能早于开始日期。", "Dispute": "申诉", "Grouped trip": "拼单配送", "last 4 on the bag": "外卖袋上的尾号", "Not yet": "还没回复", "limit none": "不限", "Expired by the system ·": "系统超时关闭 ·", "Expired by runner ·": "跑腿员取消 ·", "Cancelled by student ·": "用户取消 ·", "Cancelled by the system ·": "系统取消 ·", "Reply within 24 h. Money stays held until you decide.": "请在24小时内处理，处理前资金一直暂存。", "All have proof uploaded.": "都已上传学生证。", "Orders, 9–18 Oct (masked)": "订单，10月9–18日（脱敏）", "Members (masked)": "用户（脱敏）", "Orders (masked), current filters": "订单（脱敏），当前筛选", "Members (masked), current filters": "用户（脱敏），当前筛选", "Saved addresses (masked), current filters": "已保存地址（脱敏），当前筛选", "Added a pickup point": "新增取件点", "Uploaded a new group QR code": "上传了新的群二维码", "Post any task on": "开启“发布任意任务”", "Post any task off": "关闭“发布任意任务”", "today": "今天", "all time": "全部时间", "Orders, members and runners here are generated to look like the SIP pilot, so the team can agree on screens and numbers before the Mini Program backend is wired up. Times are China time; \"now\" is Thu 22 Oct, 12:10.": "这里的订单、用户和跑腿员是按园区校区试运营情况生成的示例数据，方便团队在小程序后端接入前先确定页面和指标。时间为北京时间，“现在”是10月22日（周四）12:10。", "\"% of\" = share of all orders at that fee orders that ended this way.": "“占”= 该价位所有订单中因这个原因结束的比例。", "\"% of\" = share of all that area's orders that ended this way.": "“占”= 该宿舍区所有订单中因这个原因结束的比例。", "\"% of\" = share of all that type's orders that ended this way.": "“占”= 该类型所有订单中因这个原因结束的比例。", "Product screenshot · felt board, 80 × 60 cm (sample)": "商品截图 · 毛毡板 80 × 60 厘米（示例）", "By building": "按楼栋", "Worst first": "取消最多的在前", "click a building to see only its orders": "点击楼栋只看这栋楼的订单", "Of its orders": "占该楼订单", "Usual pickup": "常用取件点", "Usual time": "常见时段", "Avg fee": "平均跑腿费", "Members there": "该楼用户数", "Show all buildings": "显示全部楼栋", "Red": "红色", "Green": "绿色"};
const ZP=[[/^Phase for (.+)$/,(m,a)=>tr(a)+'：所属阶段'],[/^(.+) on$/,(m,a)=>ZH[a]?ZH[a]+'：开关':m],[/^(.+) turned (on|off)$/,(m,a,b)=>ZH[a]?ZH[a]+(b==='on'?' 已开启':' 已关闭'):m],[/^(.+): (Launch|Phase 2|Phase 3|Later) → (Launch|Phase 2|Phase 3|Later)$/,(m,a,b,c)=>ZH[a]?ZH[a]+'：'+ZH[b]+' → '+ZH[c]:m],[/^Silver level: (\d+)\+ points in the last (\d+) months$/,'白银：近$2个月积分达到$1分及以上'],[/^Gold level: (\d+)\+ points in the last (\d+) months and cancel rate (\d+)% or less$/,'黄金：近$2个月积分达到$1分及以上，且取消率不超过$3%'],[/^Real so far: (\d+)%$/,'目前实际：$1%'],[/^Assumed coupon use rate: (.+)$/,'预计券使用率：$1'],[/^([✓!]) Orders per student, last 30 days$/,'$1 近30天人均下单数'],[/^([▲▼]) (\d+) since Oct 1$/,'$1 $2（自10月1日）'],[/^No change since Oct 1$/,'自10月1日无变化'],[/^From (\d+) delivered orders$/,'来自 $1 笔完成的订单'],[/^(\d+) students$/,'$1 人'],[/^Moved (up|down) \((\d+)\)$/,(m,a,n)=>(a==='up'?'升级':'降级')+'（'+n+'）'],[/^✓ Within the monthly cap \(¥(\S+)\)$/,'✓ 在每月上限内（¥$1）'],[/^! Over the monthly cap \(¥(\S+)\)$/,'! 超出每月上限（¥$1）'],[/^Silver (\d+) × (\d+) × ¥(\S+) ≈ ¥(\S+) · Gold (\d+) × (\d+) × ¥(\S+) ≈ ¥(\S+) · assumes (\d+)% are used\.( Halve the coupon value or the number of coupons\.)?$/,(m,a,b,c,d,e,f,g,h,r,x)=>'白银 '+a+' 人 × '+b+' 张 × ¥'+c+' ≈ ¥'+d+' · 黄金 '+e+' 人 × '+f+' 张 × ¥'+g+' ≈ ¥'+h+' · 按 '+r+'% 使用率估算。'+(x?'请把券面额或张数减半。':'')],
[/^Silver and Gold also get a badge and early access to new services \("Post any task" in Phase 2\)\. Gold gets help within (\d+) h and an invite to the student feedback group\.$/,'白银和黄金会员还有徽章和新服务抢先体验（二期“发布任意任务”）。黄金会员享受 $1 小时内客服回复，并受邀加入学生反馈群。'],
[/^About ¥(\S+) this month against a cap of ¥(\S+)\.$/,'本月约 ¥$1，上限为 ¥$2。'],[/^\(¥(\S+)\)$/,'（¥$1）'],[/^Silver at (\d+), Gold at (\d+) \(last (\d+) months\)$/,'满 $1 分升白银，满 $2 分升黄金（近 $3 个月）'],
[/^(Gold cancel rate limit|Winter school freeze|Silver coupons a month|Silver coupon value|Gold coupons a month|Gold coupon value|Member coupon minimum fee|Points for a ¥1 coupon|Gold welcome gift|Member coupon monthly cap): (.+)$/,(m,a,b)=>({'Gold cancel rate limit':'黄金取消率上限','Winter school freeze':'寒假不降级','Silver coupons a month':'白银每月券数','Silver coupon value':'白银券面额','Gold coupons a month':'黄金每月券数','Gold coupon value':'黄金券面额','Member coupon minimum fee':'会员券门槛','Points for a ¥1 coupon':'¥1券所需积分','Gold welcome gift':'黄金见面礼','Member coupon monthly cap':'会员券每月上限'})[a]+'：'+b.replace(/\bon\b/,'开').replace(/\boff\b/,'关')],[/^(Order delivered points|Job delivered points|First order bonus|Delivery details points|Same two students limit|Goodwill points a month|Points expiry|Silver level|Gold level|Points window|Drop one level a month|Silver free service fees|Gold free service fees|Gold priority help|Points for a free service fee): (.+)$/,(m,a,b)=>({'Order delivered points':'订单完成积分','Job delivered points':'跑腿完成积分','First order bonus':'首单奖励','Delivery details points':'填写收货信息积分','Same two students limit':'同一对用户限制','Goodwill points a month':'每月补偿积分','Points expiry':'积分有效期','Silver level':'白银等级','Gold level':'黄金等级','Points window':'积分统计周期','Drop one level a month':'每月最多降一级','Silver free service fees':'白银免服务费','Gold free service fees':'黄金免服务费','Gold priority help':'黄金优先客服','Points for a free service fee':'免服务费所需积分'})[a]+'：'+b.replace('on','开').replace('off','关')],[/^(.+) approved anyway\.$/,'$1 已强制通过。'],[/^Approved (U\d+) although an automatic check failed$/,'自动检查未通过，仍通过了 $1'],[/^(.+) approved\. They can take jobs now\.$/,'$1 已通过，现在可以接单了。'],[/^Application (pending|rejected|revoked)(?: \((.+)\))?$/,(m,a,b)=>'认证申请'+({pending:'待审核',rejected:'已驳回',revoked:'已撤销'})[a]+(b?'（'+tr(b)+'）':'')],[/^(\d+) of (\d+) to review$/,'第 $1 份，共 $2 份待审核'],[/^Oldest waiting (.*[^.])$/,'最久已等 $1'],[/^Your name is saved with the decision \((.+)\)\. Don't copy students' names or student IDs anywhere else\.$/,'审核结果会记录你的名字（$1）。不要把学生的姓名和学号复制到其他地方。'],[/^(\d+) orders$/,'$1 单'],[/^From ¥(\S+)$/,'满 ¥$1'],[/^([1-4]) · (Discount|Order types|Who gets it|Valid for)$/,(m,n,a)=>n+' · '+tr(a)],[/^Sends to ([\d,]+) members?$/,'将发给 $1 位用户'],
[/^(\d+) of them get a WeChat notice; everyone sees it in their coupon list\.$/,'其中 $1 人会收到微信通知；所有人都能在券包里看到。'],
[/^([\d,]+) coupons? · if all are used, Uniearn pays up to ¥(\S+)\. Runners always get the full delivery fee\.$/,'共 $1 张 · 全部使用的话，Uniearn 最多补贴 ¥$2。跑腿员始终拿全额跑腿费。'],
[/^Create and send to ([\d,]+)$/,'创建并发给 $1 人'],[/^Coupon created and sent to (\d+) members\.$/,'优惠券已创建，并发给了 $1 位用户。'],[/^(\d+) IDs? not found\.$/,'有 $1 个ID没找到。'],
[/^Created coupon (.+) and sent it to (\d+) members$/,'创建了优惠券 $1，并发给 $2 位用户'],
[/^(\d+) orders posted$/,'发布 $1 单'],[/^(\d+) done$/,'完成 $1'],[/^(\d+) in progress$/,'进行中 $1'],[/^(\d+) cancelled$/,'取消 $1'],[/^Cancel rate (\d+)%$/,'取消率 $1%'],
[/^Job delivered (UE\d+)$/,'跑腿完成 $1'],[/^Order delivered (UE\d+)$/,'订单完成 $1'],
[/^(\d+) · (\d+)% of (\d+)$/,'$1 单 · 占 $3 单的 $2%'],[/^¥(\S+) by WeChat Pay at (\S+)$/,'¥$1 · 微信支付 $2'],
[/^(.+?) · (Admin|Operations|Support|Guitar|Iris|Yuran|Yichen|Ops) viewed (.+)$/,(m,a,b,c)=>a+' · '+(ROLEZ[b]||b)+' 查看了'+c.replace(/^the chat on order (\S+)$/,'订单 $1 的聊天记录').replace(/^room and phone on (\S+)$/,'订单 $1 的房间号和手机号').replace(/^address (\S+)$/,'地址 $1').replace(/^profile (\S+)$/,'用户 $1 的资料')],
[/^(.+?) · (Admin|Operations|Support|Guitar|Iris|Yuran|Yichen|Ops): (.+?)(?: \(([\d,]+) rows\))?$/,(m,a,b,c,n)=>a+' · '+(ROLEZ[b]||b)+'：'+tr(c)+(n?'（'+n+' 条）':'')],
[/^(\d+) · (\d+)% cancelled$/,'$1 单 · 取消 $2%'],[/^Food due at the gate (\S+) \(latest time from the delivery app\)\.$/,'外卖预计 $1 到校门（按外卖平台显示的最晚时间）。'],
[/^(\d+) · (\d+) finished$/,'$1 单 · 完成 $2'],[/^Page (\d+) of (\d+)$/,'第 $1 / $2 页'],[/^posted (.+)$/,'$1下单'],
[/^([\d,]+) members · ([\d,]+) turned on "News from Uniearn" and can be messaged$/,'$1 位用户 · 其中 $2 位开启了“Uniearn 通知”，可以发送'],
[/^Locker location for (.+)$/,(m,a)=>trS(a)+' 的外卖柜位置'],[/^Set the locker for (.+)$/,(m,a)=>'设置 '+trS(a)+' 的外卖柜'],
[/^(\d+) by students$/,'用户取消 $1'],[/^(\d+) automatic$/,'自动关闭 $1'],[/^(\d+) by runners$/,'跑腿员取消 $1'],[/^(\d+) closed automatically$/,'自动关闭 $1'],
[/^(Orders|Jobs|Chats|Points|Support) \((\d+)\)$/,(m,a,n)=>({Orders:'订单',Jobs:'跑腿',Chats:'聊天',Points:'积分',Support:'客服'})[a]+'（'+n+'）'],
[/^Active marks \((\d+)\)$/,'当前违规记录（$1）'],[/^Orders that used it \((\d+)\)$/,'使用这张券的订单（$1）'],[/^Withdrawals \((\d+)\)$/,'提现审核（$1）'],
[/^Chat · (\d+) messages$/,'聊天记录 · $1 条'],[/^¥(\S+) held$/,'暂存 ¥$1'],[/^¥(\S+) to runner wallet$/,'入跑腿员钱包 ¥$1'],[/^Uniearn adds ¥(\S+)$/,'Uniearn 补贴 ¥$1'],[/^¥(\S+) refunded$/,'已退款 ¥$1'],
[/^joined (.+)$/,'$1 注册'],[/^last active (.+)$/,'最近活跃 $1'],[/^expires (.+)$/,'$1 到期'],[/^expired (.+)$/,'$1 已过期'],[/^(\d+) bags?$/,'$1 件'],
[/^Student asked for it by (.+?)(?: · (on time|late))?\.$/,(m,a,b)=>'用户要求 '+a+' 前送达'+(b?(b==='on time'?' · 准时':' · 晚到'):'')+'。'],
[/^Cancel and refund ¥(\S+) to the student\?$/,'取消订单，并退给用户 ¥$1？'],[/^Cancel and refund ¥(\S+)\? The runner keeps the other half\.$/,'取消订单并退款 ¥$1？另一半给跑腿员。'],
[/^(\d+) · (\d+) finished · (\d+) cancelled by them$/,'$1 单 · 完成 $2 · 本人取消 $3'],[/^Saved address (\S+)$/,'已保存地址 $1'],[/^Address (\S+)$/,'地址 $1'],[/^Valid until (\d+)$/,'有效期至 $1'],
[/^Last (\d+) days$/,'近 $1 天'],[/^\+([\d,]+) joined in the last (\d+) days$/,'近 $2 天新增 $1 人'],[/^last (\d+) days$/,'近 $1 天'],[/^\+([\d,]+) joined, (today|last (\d+) days)$/,(m,n,p,d)=>'新增 '+n+' 人，'+(p==='today'?'今天':'近 '+d+' 天')],
[/^Hour of day, (.+)$/,(m,a)=>'按小时，'+tr(a)],[/^new vs previous (.+)$/,'上一周期为 0'],[/^vs previous (\d+) days$/,'对比前 $1 天'],[/^([▲▼]) (\d+) pts$/,'$1 $2 个百分点'],
[/^orders · ¥(\S+) in delivery fees$/,'单 · 跑腿费合计 ¥$1'],[/^¥(\S+) off$/,'立减 ¥$1'],[/^orders from ¥(\S+)$/,'满 ¥$1 可用'],[/^no minimum$/,'无门槛'],[/^created by (\S+)$/,'创建人 $1'],
[/^Showing (\d+) of (\d+)\.$/,'显示 $1 / $2 条。'],[/^Rated (\d)★$/,'评分 $1★'],[/^limit ¥(\S+) a trip$/,'单趟上限 ¥$1'],[/^(.+) median$/,'中位数 $1'],[/^(\d+) left to auto-confirm$/,'$1 单未确认（自动确认）'],
[/^added (.+)$/,'$1 添加'],[/^applied (.+)$/,'$1 申请'],[/^waiting (.+)$/,'已等 $1'],[/^reported (.+), (.+) after delivery$/,'$1 申诉，送达后 $2'],[/^(.+) \(sample\)$/,(m,a)=>tr(a)+'（示例）'],
[/^goal ([≤≥]) (.+)$/,'目标 $1 $2'],[/^goal under (\d+) h$/,'目标 $1 小时内'],[/^([!✓]) Goal ([≤≥]) (.+)$/,'$1 目标 $2 $3'],
[/^! (\d+) waiting over (\d+) min$/,'! $1 单超过 $2 分钟没人接'],[/^(\d+) orders? waiting over (\d+) min for a runner$/,'$1 单超过 $2 分钟没人接'],
[/^Oldest posted (.+)\. Alert nearby runners or suggest "Add ¥1–2"\.$/,'最早一单是 $1下的。提醒附近的跑腿员，或建议用户加价 ¥1–2。'],
[/^(\d+) messages? waiting for a reply$/,'$1 条消息待回复'],[/^Oldest waiting (.+)\.$/,'最久已等 $1。'],[/^Uploaded (.+)\. WeChat group codes last 7 days\.$/,'$1 上传。微信群二维码有效期7天。'],[/^Uploaded ([^·]+)$/,'$1 上传'],
[/^(\d+) runner applications? to review$/,'$1 份跑腿员认证待审核'],[/^(\d+) without a student card photo yet \(can't be approved\)\.$/,'其中 $1 份还没上传学生证（暂不能通过）。'],
[/^(\d+) of (\d+) buildings have no food locker location$/,'$2 栋楼中有 $1 栋没设置外卖柜位置'],[/^(\d+) withdrawals? to review$/,'$1 笔提现待审核'],[/^¥(\S+) waiting to go to runners' WeChat balance\.$/,'¥$1 等待打款到跑腿员微信零钱。'],
[/^(\d+) runners? paused for 5 active marks$/,'$1 名跑腿员因累计5次违规被暂停'],[/^It has ¥(\S+) but runners are owed ¥(\S+)\. Move money in from the basic account\.$/,'账户只有 ¥$1，但应付跑腿员 ¥$2。请从基本账户转入。'],
[/^(\d+) open disputes?$/,'$1 个申诉待处理'],[/^(\d+) orders? in progress$/,'$1 单进行中'],[/^See all (\d+)$/,'查看全部 $1 单'],[/^By the day they were posted, last (\d+) days$/,'按下单日期，近 $1 天'],
[/^Delivered ≤(\d+) min$/,'≤$1 分钟送达'],[/^of (\d+) finished or cancelled orders$/,'占已结束的 $1 单'],[/^(\d+)% of all cancellations$/,'占全部取消的 $1%'],[/^Click a reason to see its orders, (.+)$/,(m,a)=>'点击原因查看对应订单，'+tr(a)],
[/^(\d+)% of certified$/,'占已认证的 $1%'],[/^Active, last (\d+) days$/,'近 $1 天活跃'],[/^(\d+) missing proof$/,'$1 份缺少照片'],[/^median time to a decision, (\d+) days$/,'近 $1 天审核用时中位数'],
[/^(\d+) addresses\. Phone and room are masked; Admins can show them one address at a time, and each view is logged\.$/,'共 $1 个地址。手机号和房间号已脱敏；管理员可以逐个查看，每次查看都会被记录。'],
[/^([\d,]+) orders · (.+)$/,(m,a,b)=>a+' 单 · '+tr(b)],[/^(\d+) withdrawals$/,'$1 笔提现'],[/^(\d+)% of paid$/,'占实付的 $1%'],[/^(\d+) orders not confirmed yet$/,'$1 单还没确认收货'],
[/^Runners are owed ¥(\S+) \(wallets plus withdrawals waiting\)\.(?: Move ¥(\S+) in from the basic account\.)?$/,(m,a,b)=>'应付跑腿员 ¥'+a+'（钱包余额加待审核提现）。'+(b?'请从基本账户转入 ¥'+b+'。':'')],
[/^Auto-confirm (.+)$/,'$1 自动确认'],[/^(\d+) starting later$/,'$1 张未开始'],[/^([!✓]) (\d+) of (\d+) · goal (\d+)%$/,'$1 $2 / $3 · 目标 $4%'],
[/^(\d+) of (\d+) finished, (.+)$/,(m,a,b,c)=>'已完成 '+b+' 单中有 '+a+' 单，'+tr(c)],[/^Paid by Uniearn, (.+)$/,(m,a)=>'由 Uniearn 承担，'+tr(a)],[/^Paid out, (.+)$/,(m,a)=>'已打款，'+tr(a)],
[/^(\d+) withdrawals to WeChat balance$/,'$1 笔提现到微信零钱'],[/^([\d,]+) in segment → ([\d,]+) opted in → ([\d,]+) already messaged this week$/,'分组内 $1 人 → 开启通知 $2 人 → 本周已发过 $3 人'],
[/^Sends to (\d+)$/,'将发送给 $1 人'],[/^Send to (\d+)$/,'发送给 $1 人'],[/^Once per order, until due \+ (\d+) min\.$/,'每单限一次，送达时间后 $1 分钟内可以改。'],[/^Phase (\d+)\.$/,'$1 期功能。'],
[/^(\d+) active marks: back to New\. (\d+): paused (\d+) days\.$/,'累计 $1 次降回新手，$2 次暂停接单 $3 天。'],[/^Orders, (\d+) days$/,'近 $1 天订单'],
[/^(\d+) buildings · D, A, C codes as in the live backend; Wen Hui codes to confirm$/,'共 $1 栋 · D、A、C 楼号与现有后台一致；文汇楼号待确认'],[/^(.+) goal$/,(m,a)=>tr(a)+' 目标'],
[/^Active runners, (\d+) days$/,'近 $1 天活跃跑腿员'],[/^New ¥(\d+) · Rising ¥(\d+) · Trusted ¥(\d+) · Top no limit$/,'新手 ¥$1 · 进阶 ¥$2 · 资深 ¥$3 · 金牌不限'],[/^Paused until (.+)$/,'暂停至 $1'],[/^paused until (.+)$/,'暂停至 $1'],
[/^Jobs delivered in the last (.+?)\. Earnings are the full delivery fees, credited to the runner's wallet when the student confirms\.$/,(m,a)=>tr(a)+'内完成的跑腿单。收入为全额跑腿费，用户确认收货后转入跑腿员钱包。'],
[/^(\d+)% of orders at ¥4 or less ended with no runner, against (\d+)% at ¥4\.50 and up\. The "Add ¥1–2" prompt after (\d+) minutes and new-job alerts to runners target these\.$/,'跑腿费 ¥4 及以下的订单有 $1% 没人接，¥4.50 及以上只有 $2%。$3 分钟后提示“加价 ¥1–2”、给跑腿员推送新单提醒，就是针对这类订单。'],
[/^¥(\d+) or less$/,'¥$1 及以下'],[/^(\d+) · newest first$/,'$1 单 · 最新在前'],[/^¥(\S+) \+ ¥(\S+) raised at (\S+)$/,'¥$1 + 加价 ¥$2（$3）'],[/^Reported: (.+) ·$/,(m,a)=>'申诉：'+tr(a)+' ·'],
[/^Reported to Uniearn: (.+)$/,(m,a)=>'已向 Uniearn 申诉：'+tr(a)],[/^(\d+) orders$/,'$1 单'],[/^(Upheld|Rejected) on (.+)$/,(m,a,b)=>(a==='Upheld'?'申诉成立':'申诉不成立')+' · '+b],
[/^(Guitar|Iris|Yuran|Yichen|Ops|Admin|Operations), (.+)$/,(m,a,b)=>(ROLEZ[a]||a)+'，'+b],
[/^Your name is saved with the decision \((.+)\)\. Don't save or copy the card photo anywhere else\.$/,'审核结果会记录你的名字（$1）。不要把学生证照片保存或转发到其他地方。'],
[/^Sent as (.+) through WeChat\. Never ask for or send full phone numbers here\.$/,'以 $1 的身份通过微信发送。不要在这里索要或发送完整手机号。'],
[/^¥(\S+) waiting to withdraw$/,'¥$1 待提现'],[/^Silver at (\d+), Gold at (\d+)$/,'满 $1 分升白银，满 $2 分升黄金'],[/^(\d+) open$/,'$1 个处理中'],
[/^Points, never money\. Up to (\d+) per member a month$/,'只发积分，不发钱。每位用户每月最多 $1 分'],[/^(\d+) left this month\.$/,'本月还可发 $1 分。'],
[/^(\d+) coupons?$/,'$1 张'],[/^Decisions are now saved as (.+)\.$/,'之后的操作会记录为 $1。'],[/^Now viewing as (.+)\.$/,(m,a)=>'当前身份：'+(ROLEZ[a]||a)+'。'],
[/^Refund must be between ¥0\.01 and ¥(\S+)\.$/,'退款金额需在 ¥0.01 到 ¥$1 之间。'],[/^¥(\S+) sent to the runner's WeChat balance\.$/,'¥$1 已打款到跑腿员微信零钱。'],[/^\+(\d+) points given\.$/,'已发放 $1 积分。'],
[/^Only (\d+) goodwill points left this month\.$/,'本月只能再发 $1 补偿积分。'],[/^Sent to (\d+) members\.$/,'已发送给 $1 位用户。'],[/^(.+?)\. (Next one opened|Queue is empty)\.$/,(m,a,b)=>tr(a+'.')+tr(b+'.')],
[/^Locker location saved for (.+)\.$/,(m,a)=>'已保存 '+trS(a)+' 的外卖柜位置。'],[/^Created coupon (.+)$/,'创建了优惠券 $1'],[/^Stopped coupon (.+)$/,'停用了优惠券 $1'],[/^Sent (.+) to (\d+) members$/,'把 $1 发给了 $2 位用户'],
[/^(.+) set to (Male|Female)$/,(m,a,b)=>trS(a)+' 设为'+(b==='Male'?'男生楼':'女生楼')],[/^(.+) (shown|hidden) in app$/,(m,a,b)=>trS(a)+(b==='shown'?' 在小程序显示':' 在小程序隐藏')],
[/^Food locker for (.+?): (.+)$/,(m,a,b)=>trS(a)+' 外卖柜：'+(b==='cleared'?'已清除':b)],[/^Goal for (.+?): (.+)$/,(m,a,b)=>tr(a)+' 目标：'+b],[/^Pickup renamed: (.+)$/,(m,a)=>'取件点改名：'+trS(a)],
[/^(Grouping window|Bags per trip|Close untaken takeaway|Deliver within|Student reply time|Report window, takeaway|"My food is late" move|Auto-confirm takeaway|Auto-confirm parcel|Auto-confirm task|Mark expires after|Prompt "Add ¥1–2" after|Task price cap): (.+)$/,(m,a,b)=>tr(a)+'：'+b.replace(/ min$/,' 分钟').replace(/ h$/,' 小时').replace(/ days$/,' 天').replace(/ bags$/,' 件')],
[/^Points, never money\. Up to (\d+) per member a month · (\d+) left this month\.$/,'只发积分，不发钱。每位用户每月最多 $1 分 · 本月还可发 $2 分。'],
[/^opened (.+)$/,'$1 发起'],[/^(\d+) cancelled or expired$/,'取消/超时 $1 单'],[/^([\d,]+) of ([\d,]+) members$/,'$2 位用户中的 $1 位'],[/^(\d+) of (\d+) who ordered$/,'下过单的 $2 人中有 $1 人'],
[/^of (\d+)$/,'共 $1 单'],[/^Dispute upheld: (.+)$/,(m,a)=>'申诉成立：'+tr(a)],[/^([!✓] )?Oldest ([^·]+)$/,(m,a,b)=>(a||'')+'最久 '+b],
[/^Focus on (.+)\.$/,(m,a)=>'重点关注：'+trS(a).replace(/, /g,'、')+'。'],[/^These (\d+) buildings have (\d+) of the (\d+) cancellations \((\d+)%\)\. Campus rate for this reason: (\d+)% of orders\.$/,'这 $1 栋楼占了 $3 单取消中的 $2 单（$4%）。全校因这个原因取消的订单占 $5%。'],
[/^: above the campus rate \((\d+)%\)\.$/,'：高于全校比例（$1%）。'],[/^: at or below it\.(?: (\d+) buildings? had none\.)?$/,(m,n)=>'：等于或低于全校比例。'+(n?' 另有 '+n+' 栋楼没有。':'')],
];
const ZSUB=[
[/North gate food locker/g,'北门外卖柜'],[/Hanlin parcel station/g,'翰林驿站'],[/Wencui station/g,'文萃驿站'],[/North gate/g,'北门'],[/South gate/g,'南门'],[/East gate/g,'东门'],
[/Wen Yuan/g,'文缘'],[/Wen Xing/g,'文星'],[/Wen Cui/g,'文萃'],[/Wen Hui/g,'文汇'],[/Purchasing agent/g,'代购'],[/Night market/g,'夜市代购'],[/Takeaway/g,'外卖代取'],[/Parcel/g,'快递代取'],
[/, room (\S+)/g,' $1 室'],[/(\d+) bags?/g,'$1 件'],[/\bFemale\b/g,'女生楼'],[/\bMale\b/g,'男生楼'],[/New pickup point/g,'新取件点'],
];
REASONS.forEach(r=>{ZH[r.k]=r.zh});
const OKW=/\b(?:Uniearn|API|PIPL|ID|UE\d+|[UTWCAM]\d+|Guitar|Iris|Yuran|Yichen|WeChat Pay|Shift|Enter)\b/g;
const isDone=t=>!/[A-Za-z]{2,}/.test(t.replace(OKW,''));
function trS(x){let t=x;for(const[re,v]of ZSUB)t=t.replace(re,v);return t}
function tr1(k){
  let r=ZH[k];if(r!=null)return r;
  for(const[re,f]of ZP){const m=k.match(re);if(m){r=typeof f==='function'?f(...m):k.replace(re,f);return r}}
  const t=trS(k);if(t!==k&&isDone(t))return t;
  return null}
function tr(x){
  if(LANG!=='zh'||x==null)return x;const raw=String(x),k=raw.trim();if(!k||!/[A-Za-z]/.test(k)||isDone(k))return x;
  let r=tr1(k);
  if(r==null&&/\s·\s|^·\s|\s·$/.test(k)){const lead=/^·\s*/.test(k)?'· ':'',trail=/\s*·$/.test(k)?' ·':'';const core=k.replace(/^·\s*/,'').replace(/\s*·$/,'');
    const parts=core.split(/\s+·\s+/).map(p=>{if(!p||isDone(p))return p;const q=tr1(p);return q==null?null:q});
    if(parts.every(p=>p!=null))r=lead+parts.join(' · ')+trail}
  return r==null?x:raw.replace(k,r)}
function trDom(root){
  if(LANG!=='zh'||!root)return;
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>{const p=n.parentElement;return!p||p.closest('[translate="no"],script,style')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT}});
  const L=[];while(w.nextNode())L.push(w.currentNode);
  L.forEach(n=>{const v=tr(n.nodeValue);if(v!==n.nodeValue)n.nodeValue=v});
  root.querySelectorAll('[placeholder],[title],[aria-label]').forEach(el=>{if(el.closest('[translate="no"]'))return;['placeholder','title','aria-label'].forEach(a=>{const v=el.getAttribute(a);if(v){const t=tr(v);if(t!==v)el.setAttribute(a,t)}})})}
function setLang(l){LANG=l;try{localStorage.setItem('uniearn-admin-lang',l)}catch(e){}document.documentElement.lang=l==='zh'?'zh-CN':'en';render();}

/* ============ icons ============ */
const IC={
 overview:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13h6V4H4zM14 20h6v-9h-6zM14 8h6V4h-6zM4 20h6v-3H4z"/></svg>',
 orders:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l-1 13H7z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>',
 cancels:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M9 9l6 6M15 9l-6 6"/></svg>',
 members:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.8-3.2 3-5 5.5-5s4.7 1.8 5.5 5"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.2c2.3.2 3.9 1.8 4.5 4.3"/></svg>',
 runners:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="14" cy="4.5" r="2"/><path d="M8 21l3-6 3 2v4M6 12l3-4h4l3 4 3 1M11 15l1-5"/></svg>',
 support:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/></svg>',
 addresses:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/></svg>',
 funds:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 5l5 6 5-6M6 12h12M6 16h12M12 11v9"/></svg>',
 coupons:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z"/><path d="M14 7v10" stroke-dasharray="2 2"/></svg>',
 messages:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16v12H4z"/><path d="M4 7l8 6 8-6"/></svg>',
 config:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
 x:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'};
const NAVZ={overview:['数据概览','校园运营情况和待处理事项'],orders:['订单管理','所有订单的进度和资金'],cancels:['取消分析','按原因查看订单为什么被取消'],members:['用户管理','用户运营：分组、积分、优质用户'],runners:['跑腿员管理','认证审核、排行和违规记录'],addresses:['地址与外卖柜','用户保存的收货地址和每栋楼的外卖柜位置'],support:['客服消息','用户和跑腿员发来的消息'],funds:['资金管理','钱包、提现、退款和优惠券补贴'],coupons:['会员与优惠券','会员等级和优惠券，统一预算'],messages:['群发通知','给开启通知的用户发订阅消息'],config:['规则设置','规则、地点、开关、群二维码和操作记录']};
const VIEWS=[
  ['overview','Overview','How the campus is doing and what needs attention'],
  ['orders','Orders','Every order, its timeline and money'],
  ['cancels','Cancellations','Why orders were cancelled, by reason'],
  ['members','Members','Member CRM: segments, points, good customers'],
  ['runners','Runners','Applications, rankings and marks'],
  ['addresses','Addresses & lockers','Saved delivery addresses and the food locker for each building'],
  ['support','Support','Messages from students and runners'],
  ['funds','Funds','Wallets, withdrawals, refunds and coupon cost'],
  ['coupons','Membership & coupons','Membership levels and coupons, one budget'],
  ['messages','News','Subscription messages to members who opted in'],
  ['config','Rules & setup','Rules, places, switches, group QR and logs']];

/* ============ permission helper ============ */
const CAN={refund:['admin','ops'],approve:['admin','ops'],export:['admin'],config:['admin'],reveal:['admin'],marks:['admin','ops'],news:['admin','ops'],goodwill:['admin','ops'],reply:['admin','ops','support'],dispute:['admin','ops']};
const can=a=>CAN[a].includes(ST.role);
const roleName={admin:'Admin',ops:'Operations',support:'Support'};
const dis=a=>can(a)?'':` disabled title="Needs ${CAN[a].map(r=>roleName[r]).join(' or ')} role"`;

/* ============ UI bits ============ */
const pill=s=>{const[l,c]=STATUS[s];return`<span class="pill ${c}">${l}</span>`};
const testPill=x=>x?' <span class="pill test">TEST</span>':'';
const uname=id=>{const u=UMAP[id];return u?esc(u.nick):'—'};
const who=id=>{const u=UMAP[id];if(!u)return'<span class="faint">—</span>';return`<div class="who"><span><button class="name" data-act="member:${u.id}" title="Open profile" translate="no">${esc(u.nick)}</button>${testPill(u.isTest)}</span><small>${u.id}</small></div>`};
const ulink=id=>{const u=UMAP[id];return u?`<button class="linkbtn" data-act="member:${u.id}" translate="no">${esc(u.nick)}</button> <span class="faint mono">${u.id}</span>`:'<span class="faint">—</span>'};
const maskPhone=p=>p.slice(0,3)+'****'+p.slice(-4);
const maskSid=s=>s.slice(0,2)+'****'+s.slice(-2);
const route=o=>`${esc(PU[o.pickup].name)} → ${esc(BLD[o.bld].name)}`;
function delta(cur,prev,{goodUp=true,fmt=v=>v,unit=''}={}){
  if(ST.range==='all')return'<span class="d">Since the pilot started</span>';
  if(prev==null||prev===0&&cur===0)return'<span class="d">no change</span>';
  if(!prev)return`<span class="d">new vs previous ${rangeBounds()[2]}</span>`;
  const d=cur-prev, up=d>0, good=up===goodUp, p=Math.round(Math.abs(d)/Math.abs(prev)*100);
  if(!d)return'<span class="d">same as previous</span>';
  return`<span class="d ${good?'d-good':'d-bad'}">${up?'▲':'▼'} ${unit==='pt'?Math.abs(d)+' pts':p+'%'} <span class="muted">vs previous ${ST.range==='today'?'day':rangeBounds()[2]}</span></span>`}
function toast(t){const r=document.getElementById('toast-root');r.innerHTML=`<div class="toast" role="status">${esc(tr(t))}</div>`;clearTimeout(toast.t);toast.t=setTimeout(()=>r.innerHTML='',2600)}

/* ============ charts ============ */
function niceStep(x){const p=10**Math.floor(Math.log10(x||1));return[1,2,5,10].map(m=>m*p).find(v=>v>=x)}
function roundTop(x,y,w,h,r){r=Math.min(r,h,w/2);if(h<=0)return'';return`M${x},${y+h}V${y+r}Q${x},${y} ${x+r},${y}H${x+w-r}Q${x+w},${y} ${x+w},${y+r}V${y+h}Z`}
function stackChart(cols,series,{W=720,H=220,label=c=>c.label,tip}={}){
  const pl=30,pr=6,pt=10,pb=24, n=cols.length;
  const tot=cols.map(c=>sum(series.map(s=>c[s.k])));
  const step=niceStep(Math.max(1,...tot)/4), max=step*Math.max(1,Math.ceil(Math.max(1,...tot)/step));
  const y=v=>pt+(H-pt-pb)*(1-v/max), bw=(W-pl-pr)/n, barW=Math.max(3,Math.min(28,bw*.64));
  let g='';
  for(let v=0;v<=max;v+=step){g+=`<line class="grid-l" x1="${pl}" x2="${W-pr}" y1="${y(v)}" y2="${y(v)}"/><text x="${pl-6}" y="${y(v)+4}" text-anchor="end">${v}</text>`}
  const every=Math.ceil(n/Math.max(2,Math.floor((W-pl)/64)));
  cols.forEach((c,i)=>{
    const x=pl+i*bw+(bw-barW)/2;let acc=0;const top=series.map(s=>c[s.k]).reduce((l,v,j)=>v>0?j:l,-1);
    series.forEach((s,j)=>{const v=c[s.k];if(!v)return;const y0=y(acc+v),h=y(acc)-y(acc+v);acc+=v;
      g+=j===top?`<path d="${roundTop(x,y0,barW,h,4)}" fill="${s.color}" stroke="var(--surface)" stroke-width="1.5"/>`:`<rect x="${x}" y="${y0}" width="${barW}" height="${h}" fill="${s.color}" stroke="var(--surface)" stroke-width="1.5"/>`});
    if(c.highlight)g+=`<text x="${x+barW/2}" y="${y(acc)-5}" text-anchor="middle" style="fill:var(--fg);font-weight:600">${acc}</text>`;
    if(i%every===0||i===n-1)g+=`<text x="${x+barW/2}" y="${H-6}" text-anchor="middle">${esc(label(c))}</text>`;
    g+=`<rect x="${pl+i*bw}" y="${pt}" width="${bw}" height="${H-pt-pb}" fill="transparent" data-tip="${esc(tip(c))}"/>`});
  g+=`<line class="axis" x1="${pl}" x2="${W-pr}" y1="${y(0)}" y2="${y(0)}"/>`;
  return`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Stacked bar chart">${g}</svg>`}
function hourChart(counts,W=720,color='var(--s-done)'){
  const H=210,pl=30,pr=6,pt=22,pb=24;const m=Math.max(1,...counts);const step=niceStep(m/4),max=step*Math.ceil(m/step);
  const y=v=>pt+(H-pt-pb)*(1-v/max),bw=(W-pl-pr)/24,barW=bw*.66;let g='';
  [[11,14,'Lunch'],[17,20,'Dinner']].forEach(([a,b,l])=>{g+=`<rect x="${pl+a*bw}" y="${pt}" width="${(b-a)*bw}" height="${H-pt-pb}" fill="var(--surface-2)"/><text x="${pl+a*bw+2}" y="${pt-8}" style="fill:var(--faint)">${l}</text>`});
  for(let v=0;v<=max;v+=step)g+=`<line class="grid-l" x1="${pl}" x2="${W-pr}" y1="${y(v)}" y2="${y(v)}"/><text x="${pl-6}" y="${y(v)+4}" text-anchor="end">${v}</text>`;
  const peak=counts.indexOf(m);
  counts.forEach((v,h)=>{const x=pl+h*bw+(bw-barW)/2;if(v)g+=`<path d="${roundTop(x,y(v),barW,y(0)-y(v),3)}" fill="${color}"/>`;
    if(h%(W<480?6:3)===0)g+=`<text x="${x+barW/2}" y="${H-6}" text-anchor="middle">${p2(h)}:00</text>`;
    g+=`<rect x="${pl+h*bw}" y="${pt}" width="${bw}" height="${H-pt-pb}" fill="transparent" data-tip="${esc(`<b>${p2(h)}:00–${p2(h)}:59</b><br>${v} orders posted`)}"/>`});
  g+=`<line class="axis" x1="${pl}" x2="${W-pr}" y1="${y(0)}" y2="${y(0)}"/>`;
  return`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Orders by hour of day">${g}</svg>`}
const SER=[{k:'done',label:'Done',color:'var(--s-done)'},{k:'live',label:'In progress',color:'var(--s-live)'},{k:'cancel',label:'Cancelled or expired',color:'var(--s-cancel)'}];
const legend=s=>`<div class="legend">${s.map(x=>`<span><i style="background:${x.color}"></i>${x.label}</span>`).join('')}</div>`;

/* ============ metrics ============ */
function stats(list){
  const real=list;
  const done=real.filter(o=>o.status==='confirmed'||o.status==='refunded');
  const cancel=real.filter(o=>o.cancelledBy);
  const live=real.filter(o=>LIVE.has(o.status));
  const taken=real.filter(o=>o.takenAt);
  const waits=taken.map(o=>(o.takenAt-o.postedAt)/MIN);
  const notTaken10=real.filter(o=>(o.takenAt?o.takenAt-o.postedAt:(o.cancelledAt||NOW)-o.postedAt)>10*MIN).length;
  const delivered=real.filter(o=>o.deliveredAt);
  const trips=new Set(delivered.map(o=>o.groupId||o.id)).size;
  const runners=new Set(delivered.map(o=>o.runner));
  return{n:real.length,done:done.length,cancel:cancel.length,live:live.length,
    doneRate:pct(done.length,real.length-live.length),cancelRate:pct(cancel.length,real.length-live.length),
    waitMed:median(waits),notTaken10,perTrip:trips?delivered.length/trips:null,runners:runners.size,
    fees:sum(done.map(o=>o.fee+o.offerRaised))}}
function activeRunners7(){const a=NOW-7*DAY;return new Set(ORDERS.filter(o=>(ST.showTest||!o.isTest)&&o.deliveredAt&&o.deliveredAt>=a).map(o=>o.runner)).size}

/* ============ VIEWS ============ */
function vOverview(){
  const B=rangeBounds(),list=scoped(B),s=stats(list);
  const PB=prevBounds(),ps=PB?stats(scoped(PB)):null;
  const members=USERS.filter(u=>ST.showTest||!u.isTest);
  const newMembers=members.filter(u=>u.joined>=B[0]&&u.joined<=B[1]).length;
  const prevNew=PB?members.filter(u=>u.joined>=PB[0]&&u.joined<=PB[1]).length:null;
  // attention
  const liveAll=ORDERS.filter(o=>baseFilter(o,{area:false,type:false})&&o.status==='posted');
  const slow=liveAll.filter(o=>NOW-o.postedAt>10*MIN);
  const disputes=ORDERS.filter(o=>o.status==='disputed'&&(ST.showTest||!o.isTest));
  const unreplied=TICKETS.filter(needsReply);
  const apps=APPS.filter(a=>a.status==='pending');
  const qrExp=ST.qr.uploadedAt+7*DAY<NOW;
  const paused=Object.keys(PAUSED).length;
  const noLoc=BUILDINGS.filter(b=>!b.lockerLoc).length;
  const att=[];
  if(slow.length)att.push(['crit',`${slow.length} order${slow.length>1?'s':''} waiting over 10 min for a runner`,`Oldest posted ${ago(Math.min(...slow.map(o=>o.postedAt)))}. Alert nearby runners or suggest "Add ¥1–2".`,'Open',`go:orders:slow`]);
  if(disputes.length)att.push(['crit',`${disputes.length} open dispute${disputes.length>1?'s':''}`,'Reply within 24 h. Money stays held until you decide.','Review','kgo:orders:disputed']);
  if(unreplied.length)att.push(['warn',`${unreplied.length} message${unreplied.length>1?'s':''} waiting for a reply`,`Oldest waiting ${fMin((NOW-Math.min(...unreplied.map(waitingSince)))/MIN)}.`,'Reply','go:support:tickets']);
  if(qrExp)att.push(['warn','Official group QR code has expired',`Uploaded ${fDay(ST.qr.uploadedAt)}. WeChat group codes last 7 days.`,'Upload new','go:config:qr']);
  if(apps.length)att.push(['info',`${apps.length} runner application${apps.length>1?'s':''} to review`,`Oldest waiting ${fMin((NOW-Math.min(...apps.map(a=>a.appliedAt)))/MIN)}.`,'Review','go:runners:apps']);
  if(noLoc)att.push(['info',`${noLoc} of ${BUILDINGS.length} buildings have no food locker location`,'Runners leaving lobby drop-offs there don\'t know where to put the bag.','Set','go:addresses:lockers']);
  const pw=WITHDRAWALS.filter(w=>w.status==='pending');if(pw.length)att.push(['warn',`${pw.length} withdrawal${pw.length>1?'s':''} to review`,`${Y0(sum(pw.map(w=>w.fen)))} waiting to go to runners' WeChat balance.`,'Review','go:funds:withdraw']);
  if(ST.opsBalance<opsNeed())att.push(['crit','Operations account is short',`It has ${Y0(ST.opsBalance)} but runners are owed ${Y0(opsNeed())}. Move money in from the basic account.`,'Check','go:funds:flow']);
  {const mc=memberCost();if(mc.total>MEMBER.monthlyCap)att.push(['warn','Member coupons are over the monthly cap',`About ${Y0(mc.total*100)} this month against a cap of ${Y0(MEMBER.monthlyCap*100)}.`,'Check','go:coupons:membership'])}
  if(paused)att.push(['info',`${paused} runner paused for 5 active marks`,'Paused runners can\'t take jobs for 7 days.','See','go:runners:marks']);
  // live now
  const PRI={posted:0,taken:1,picked:2,delivered:3};const liveNow=ORDERS.filter(o=>baseFilter(o)&&LIVE.has(o.status)&&o.status!=='disputed').sort((a,b)=>PRI[a.status]-PRI[b.status]||a.postedAt-b.postedAt);
  // day chart
  const days=[];const d0=ST.range==='today'?TODAY0-6*DAY:Math.max(B[0],Date.parse('2026-10-01T00:00:00+08:00'));
  for(let t=dayStart(d0);t<=TODAY0;t+=DAY){const L=ORDERS.filter(o=>baseFilter(o)&&o.postedAt>=t&&o.postedAt<t+DAY);
    days.push({t,label:fWDay(t),done:L.filter(o=>o.status==='confirmed'||o.status==='refunded').length,live:L.filter(o=>LIVE.has(o.status)).length,cancel:L.filter(o=>o.cancelledBy).length,highlight:t===TODAY0})}
  const hours=H24.map(h=>list.filter(o=>hourOf(o.postedAt)===h).length);
  const cw=document.getElementById('view').clientWidth||900, narrow=innerWidth<=900, fullW=Math.max(280,cw-34), halfW=narrow?fullW:Math.max(280,(cw-16)/2-34);
  // time per order by type
  const comp=list.filter(o=>o.status==='confirmed'&&o.deliveredAt);
  const segRow=(lab,L)=>{const f=(fn)=>{const v=L.map(fn).filter(x=>x!=null&&!isNaN(x));return[median(v),avg(v)]};
    const cells=[f(o=>(o.takenAt-o.postedAt)/MIN),f(o=>(o.pickedAt-o.takenAt)/MIN),f(o=>(o.deliveredAt-o.pickedAt)/MIN),f(o=>(o.deliveredAt-o.postedAt)/MIN),f(o=>o.confirmedBy==='student'?(o.confirmedAt-o.deliveredAt)/MIN:null)];
    const onTime=pct(L.filter(o=>o.deliveredAt-o.pickedAt<=15*MIN).length,L.length);
    const asked=L.filter(o=>o.askedBy);const byAsk=asked.length?pct(asked.filter(o=>o.deliveredAt<=o.askedBy).length,asked.length)+'%':'—';
    return`<tr><td>${lab}</td><td class="n">${L.length}</td>${cells.map(([m,a])=>`<td class="n"><b>${fMin(m)}</b> <span class="faint">· ${fMin(a)}</span></td>`).join('')}<td class="n ${L.length?(tone('onTime',onTime)==='good'?'g':'b'):''}">${L.length?onTime+'%':'—'}</td><td class="n">${byAsk}</td></tr>`};
  const tRows=TYPE_KEYS.map(k=>segRow(TYPES[k],comp.filter(o=>o.type===k))).join('')+segRow('<b>All types</b>',comp);
  // by area & type
  const byArea=AREAS.map(a=>{const L=list.filter(o=>o.area===a.id);const c=L.filter(o=>o.cancelledBy).length;return{a,n:L.length,c,done:L.filter(o=>o.status==='confirmed').length}});
  const maxA=Math.max(1,...byArea.map(x=>x.n));
  const byType=TYPE_KEYS.map(k=>{const L=list.filter(o=>o.type===k);return{k,n:L.length,fee:avg(L.map(o=>o.fee))}});
  const maxT=Math.max(1,...byType.map(x=>x.n));
  // cancel reasons
  const reasons={};list.filter(o=>o.cancelledBy).forEach(o=>{const k=o.cancelReason;reasons[k]=reasons[k]||{n:0,by:o.cancelledBy};reasons[k].n++});
  const rList=Object.entries(reasons).sort((a,b)=>b[1].n-a[1].n);const maxR=Math.max(1,...rList.map(r=>r[1].n));
  const byWho={system:'System',student:'Student',runner:'Runner'};
  const nrN=list.filter(o=>o.cancelReason===NO_RUNNER).length;const RR=reasonRows(list),maxRR=Math.max(1,...RR.map(r=>r.n));

  const realM=members.filter(u=>!u.isTest||ST.showTest);
  const ordered=realM.filter(u=>MS.get(u.id).orders>=1).length, again=realM.filter(u=>MS.get(u.id).orders>=2).length;
  const liveCount=k=>ORDERS.filter(o=>baseFilter(o)&&o.status===k).length;
  const box=(act,lab,val,sub,tn='')=>`<button class="kpi kpi-link ${tn}" data-act="${act}"><span class="lab">${lab}</span><span class="val num">${val}</span>${sub}</button>`;
  return`
  <div class="legend-goal"><span><i style="background:var(--good)"></i>Green: on target</span><span><i style="background:var(--crit)"></i>Red: needs work</span><span>Goals are set in Rules &amp; setup</span></div>
  <div class="strip-title"><h2>People</h2><span>All time · the date, area and type filters don't change these</span></div>
  <div class="kpis">
    ${box('kgo:members:all','Members',members.length.toLocaleString(),`<span class="d">+${members.filter(u=>u.joined>=NOW-7*DAY).length} joined in the last 7 days</span>`)}
    ${box('kgo:members:ordered','Ordered at least once',pct(ordered,realM.length)+'<small>%</small>',`<span class="d">${ordered} of ${realM.length.toLocaleString()} members</span>`)}
    ${box('kgo:members:repeat','Ordered again',pct(again,ordered)+'<small>%</small>',goalTxt('repeat',pct(again,ordered))+`<span class="d">${again} of ${ordered} who ordered</span>`,tone('repeat',pct(again,ordered)))}
    ${box('kgo:runners:certified','Certified runners',USERS.filter(u=>u.certified&&(ST.showTest||!u.isTest)).length,'<span class="d">Student check passed</span>')}
    ${box('kgo:runners:rank','Active runners, 7 days',activeRunners7(),goalTxt('active7',activeRunners7())+'<span class="d">At least one job delivered</span>',tone('active7',activeRunners7()))}
  </div>
  <div class="strip-title"><h2>Order status now</h2><span>Live, all dates · click a box to see those orders</span></div>
  <div class="kpis">
    ${(()=>{const sl=ORDERS.filter(o=>baseFilter(o)&&o.status==='posted'&&NOW-o.postedAt>10*MIN).length;return box('kgo:orders:posted:all','Waiting for a runner',liveCount('posted'),sl?`<span class="goal">! ${sl} waiting over 10 min</span>`:'<span class="goal">✓ None waiting over 10 min</span>',sl?'bad':'good')})()}
    ${box('kgo:orders:taken:all','Taken',liveCount('taken'),'<span class="pill info">Runner on the way</span>')}
    ${box('kgo:orders:picked:all','Picked up',liveCount('picked'),'<span class="pill info">Delivering</span>')}
    ${box('kgo:orders:delivered:all','Delivered, not confirmed',liveCount('delivered'),'<span class="pill info">Money held</span>')}
    ${box('kgo:orders:disputed','Disputed',liveCount('disputed'),liveCount('disputed')?'<span class="goal">! Decide within 24 h</span>':'<span class="goal">✓ None open</span>',liveCount('disputed')?'bad':'good')}
  </div>
  <div class="strip-title"><h2>${ST.range==='all'?'All time':ST.range==='today'?'Today':'Last '+rangeBounds()[2]}</h2><span>${ST.range==='all'?'Click a box to open the list':'Compared with the period before · click a box to open the list'}</span></div>
  <div class="kpis">
    ${box('kgo:orders:all','Orders',s.n,delta(s.n,ps?.n))}
    ${box('kgo:orders:done','Finished',s.doneRate+'<small>%</small>',goalTxt('doneRate',s.doneRate)+(ps?delta(s.doneRate,ps.doneRate,{unit:'pt'}):''),tone('doneRate',s.doneRate))}
    ${box('kgo:orders:ended','Cancelled or expired',s.cancelRate+'<small>%</small>',goalTxt('cancelRate',s.cancelRate)+(ps?delta(s.cancelRate,ps.cancelRate,{goodUp:false,unit:'pt'}):''),tone('cancelRate',s.cancelRate))}
    ${box('kgo:orders:slow','Median wait for a runner',fMin(s.waitMed),goalTxt('waitMed',s.waitMed)+(ps&&s.waitMed&&ps.waitMed?delta(Math.round(s.waitMed),Math.round(ps.waitMed),{goodUp:false}):''),tone('waitMed',s.waitMed))}
    ${box('kgo:orders:grouped','Orders per trip',s.perTrip?s.perTrip.toFixed(2):'—',goalTxt('perTrip',s.perTrip),tone('perTrip',s.perTrip))}
  </div>
  <div class="grid g-73">
    <section class="panel"><div class="panel-head"><h2>Needs attention</h2><span class="hint">Across the whole campus, live</span></div>
      <div class="attn">${att.length?att.map(([c,t,d,b,a])=>`<div class="attn-item ${c}"><div class="t"><b>${t}</b><span>${d}</span></div><button class="btn small" data-act="${a}">${b}</button></div>`).join(''):'<div class="attn-ok">Nothing needs attention right now.</div>'}</div>
    </section>
    <section class="panel"><div class="panel-head"><h2>Right now</h2><span class="hint">${liveNow.length} order${liveNow.length===1?'':'s'} in progress</span></div>
      ${liveNow.length?`<div class="live">${liveNow.slice(0,8).map(o=>`<button class="live-row" data-act="order:${o.id}"><span class="tt"><span>${TYPES[o.type]}${testPill(o.isTest)} <span class="faint">· ${o.bags} bag${o.bags>1?'s':''}</span></span><small>${route(o)}</small></span><span class="tt" style="align-items:flex-end;text-align:right">${pill(o.status)}<small>posted ${ago(o.postedAt)}</small></span></button>`).join('')}</div>${liveNow.length>8?`<button class="linkbtn" style="margin-top:8px" data-act="liveAll">See all ${liveNow.length}</button>`:''}`:'<div class="attn-ok">No orders in progress.</div>'}
    </section>
  </div>
  <div class="section-gap"></div>
  <section class="panel"><div class="panel-head"><h2>Orders per day</h2><span class="hint">By the day they were posted${ST.range==='today'?', last 7 days':''}</span></div>
    ${legend(SER)}${stackChart(days,SER,{W:fullW,tip:c=>`<b>${fDayW(c.t)}</b><br>${c.done} done · ${c.live} in progress · ${c.cancel} cancelled<br>Cancel rate ${pct(c.cancel,c.done+c.cancel)}%`})}
    <details class="nums"><summary>Show the numbers</summary><div class="tbl-wrap"><table><thead><tr><th>Day</th><th class="n">Done</th><th class="n">In progress</th><th class="n">Cancelled</th><th class="n">Cancel rate</th></tr></thead><tbody>${days.map(c=>`<tr><td>${fDayW(c.t)}</td><td class="n">${c.done}</td><td class="n">${c.live}</td><td class="n">${c.cancel}</td><td class="n">${pct(c.cancel,c.done+c.cancel)}%</td></tr>`).join('')}</tbody></table></div></details>
  </section>
  <div class="section-gap"></div>
  <div class="grid g2">
    <section class="panel"><div class="panel-head"><h2>When orders are posted</h2><span class="hint">Hour of day, ${rangeBounds()[2]}</span></div>${hourChart(hours,halfW)}</section>
    <section class="panel"><div class="panel-head"><h2>Why orders didn't finish</h2><span class="hint">${s.cancel} cancelled or expired</span></div>
      ${RR.length?`<div class="rlist">${RR.slice(0,5).map(r=>`<button class="rrow" data-act="creason:${esc(encodeURIComponent(r.k))}"><span>${esc(r.k)}<small>${whoText(r)}</small></span><span class="bar"><span style="width:${r.n/maxRR*100}%"></span></span><span class="v"><b>${r.n}</b> <span class="faint">· ${pct(r.n,s.cancel)}%</span></span><span class="chev">›</span></button>`).join('')}</div>
      <div class="row" style="justify-content:space-between;margin-top:10px">${nrN?`<span class="muted" style="font-size:12.5px"><b style="color:var(--fg)">${pct(nrN,s.cancel)}%</b> had no runner.</span>`:'<span></span>'}<button class="linkbtn" data-act="view:cancels">All reasons ›</button></div>`:'<div class="empty">No cancellations in this period.</div>'}
    </section>
  </div>
  <div class="section-gap"></div>
  <section class="panel"><div class="panel-head"><h2>Time per order</h2><span class="hint">Finished orders only. <b>Median</b> · average</span></div>
    <div class="tbl-wrap"><table><thead><tr><th>Type</th><th class="n">Orders</th><th class="n">Wait to be taken</th><th class="n">Pickup</th><th class="n">Delivery</th><th class="n">Total</th><th class="n">Student confirms</th><th class="n">Delivered ≤15 min</th><th class="n">By time asked</th></tr></thead><tbody>${tRows}</tbody></table></div>
    <p class="faint" style="margin:8px 0 0;font-size:12px">"By time asked" is for parcels, where the student picks a delivery time. One forgotten order can double an average, so judge by the median.</p>
  </section>
  <div class="section-gap"></div>
  <div class="grid g2">
    <section class="panel"><div class="panel-head"><h2>Dorm areas</h2><span class="hint">Orders and cancel rate</span></div>
      <div class="hbars">${byArea.map(x=>`<div class="hbar"><span>${areaL(x.a)}</span><div class="track"><span style="width:${x.n/maxA*100}%;background:var(--brand)"></span></div><span class="v">${x.n} · ${pct(x.c,x.n)}% cancelled</span></div>`).join('')}</div></section>
    <section class="panel"><div class="panel-head"><h2>Order types</h2><span class="hint">Orders and average delivery fee</span></div>
      <div class="hbars">${byType.map(x=>`<div class="hbar"><span>${TYPES[x.k]}</span><div class="track"><span style="width:${x.n/maxT*100}%;background:var(--brand)"></span></div><span class="v">${x.n} · ${x.fee?Y(x.fee):'—'}</span></div>`).join('')}</div></section>
  </div>`}

function orderFiltered(){
  const F=ST.orders,B=rangeBounds();
  let L=ORDERS.filter(o=>baseFilter(o)&&inRange(o,B));
  if(F.q){const q=F.q.toLowerCase();L=L.filter(o=>o.id.toLowerCase().includes(q)||UMAP[o.customer].nick.toLowerCase().includes(q)||(o.runner&&UMAP[o.runner].nick.toLowerCase().includes(q))||o.customer.toLowerCase().includes(q))}
  if(F.status==='live')L=L.filter(o=>LIVE.has(o.status));else if(F.status==='ended')L=L.filter(o=>o.cancelledBy);else if(F.status==='done')L=L.filter(o=>o.status==='confirmed'||o.status==='refunded');else if(F.status!=='all')L=L.filter(o=>o.status===F.status);
  if(F.pickup!=='all')L=L.filter(o=>o.pickup===F.pickup);
  if(F.cancelBy!=='all')L=L.filter(o=>o.cancelledBy===F.cancelBy);
  if(F.reason!=='all')L=L.filter(o=>o.cancelledBy&&o.cancelReason===F.reason);
  if(F.settle!=='all')L=L.filter(o=>settle(o)===F.settle);
  if(F.feeMin!=='')L=L.filter(o=>o.fee>=+F.feeMin*100);
  if(F.feeMax!=='')L=L.filter(o=>o.fee<=+F.feeMax*100);
  if(F.slow)L=L.filter(o=>(o.takenAt?o.takenAt-o.postedAt:(o.cancelledAt||NOW)-o.postedAt)>10*MIN);
  if(F.grouped)L=L.filter(o=>o.groupId);
  if(F.complaint)L=L.filter(o=>o.dispute||TICKETS.some(t=>t.order===o.id));
  L.sort((a,b)=>F.sort==='old'?a.postedAt-b.postedAt:F.sort==='fee'?b.fee-a.fee:b.postedAt-a.postedAt);
  return L}
function vOrders(){
  const F=ST.orders,L=orderFiltered(),per=40,pages=Math.max(1,Math.ceil(L.length/per));if(F.page>=pages)F.page=pages-1;
  const rows=L.slice(F.page*per,F.page*per+per);
  const opt=(v,l,cur)=>`<option value="${v}"${cur===v?' selected':''}>${l}</option>`;
  return`
  <div class="toolbar">
    <input class="grow" type="search" id="o-q" placeholder="Search order ID, member or runner" value="${esc(F.q)}" aria-label="Search orders">
    <select id="o-status" aria-label="Status">${opt('all','Any status',F.status)}${opt('live','In progress',F.status)}${opt('done','Finished',F.status)}${opt('ended','Cancelled or expired',F.status)}${Object.keys(STATUS).map(k=>opt(k,STATUS[k][0],F.status)).join('')}</select>
    <select id="o-pickup" aria-label="Pickup point">${opt('all','Any pickup point',F.pickup)}${PICKUPS.map(p=>opt(p.id,p.name,F.pickup)).join('')}</select>
    <select id="o-cancelBy" aria-label="Cancelled by">${opt('all','Cancelled by anyone',F.cancelBy)}${opt('student','Cancelled by student',F.cancelBy)}${opt('runner','Cancelled by runner',F.cancelBy)}${opt('system','Expired (system)',F.cancelBy)}</select>
    <select id="o-reason" aria-label="Cancel reason">${opt('all','Any cancel reason',F.reason)}${REASONS.filter(r=>!r.test||ST.showTest).map(r=>opt(r.k,r.k,F.reason)).join('')}</select>
    <select id="o-settle" aria-label="Settlement">${opt('all','Any settlement',F.settle)}${['Held','Credited','Refunded','Split'].map(s=>opt(s,SETTLE_LABEL[s],F.settle)).join('')}</select>
    <span class="row" style="gap:4px"><input type="number" id="o-feeMin" placeholder="¥ min" min="0" step="0.5" style="width:74px" value="${esc(F.feeMin)}" aria-label="Minimum fee"><span class="faint">–</span><input type="number" id="o-feeMax" placeholder="¥ max" min="0" step="0.5" style="width:74px" value="${esc(F.feeMax)}" aria-label="Maximum fee"></span>
    <label class="chk"><input type="checkbox" id="o-slow"${F.slow?' checked':''}> Not taken within 10 min</label>
    <label class="chk"><input type="checkbox" id="o-complaint"${F.complaint?' checked':''}> Has complaint</label>
    <label class="chk"><input type="checkbox" id="o-grouped"${F.grouped?' checked':''}> Grouped trips</label>
  </div>
  <div class="toolbar"><span class="muted"><b style="color:var(--fg)">${L.length}</b> orders · ${Y0(sum(L.map(o=>o.fee+o.offerRaised)))} in delivery fees</span>
    <span style="margin-left:auto" class="row"><select id="o-sort" aria-label="Sort">${opt('new','Newest first',F.sort)}${opt('old','Oldest first',F.sort)}${opt('fee','Highest fee',F.sort)}</select>
    <button class="btn small" data-act="export:orders"${dis('export')}>Export (masked)</button>
    <button class="btn small" data-act="clear:orders">Clear filters</button></span></div>
  <div class="tbl-wrap"><table><thead><tr><th>Order</th><th>Status</th><th>Posted</th><th>Type</th><th class="n">Delivery fee</th><th>Route</th><th class="n">Bags</th><th class="n">Wait</th><th>Student</th><th>Runner</th></tr></thead>
  <tbody>${rows.map(o=>{const w=o.takenAt?(o.takenAt-o.postedAt)/MIN:(o.status==='posted'?(NOW-o.postedAt)/MIN:null);
    return`<tr class="click${o.isTest?' is-test':''}" data-act="order:${o.id}"><td class="mono">${o.id}${testPill(o.isTest)}</td><td>${pill(o.status)}</td><td>${fDT(o.postedAt)}</td><td>${TYPES[o.type]}${o.groupId?' <span class="tag" title="Grouped with another order">Grouped</span>':''}</td><td class="n">${Y(o.fee+o.offerRaised)}${o.offerRaised?' <span class="tag">+¥1</span>':''}</td><td>${route(o)}</td><td class="n">${o.bags}</td><td class="n${w>10?' d-bad':''}">${w==null?'—':fMin(w)}${o.status==='posted'?' <span class="faint">so far</span>':''}</td><td>${who(o.customer)}</td><td>${o.runner?who(o.runner):'<span class="faint">—</span>'}</td></tr>`}).join('')||`<tr><td colspan="10"><div class="empty">No orders match these filters.</div></td></tr>`}</tbody></table></div>
  <div class="pager">${pages>1?`<button class="btn small" data-act="page:orders:-1"${F.page?'':' disabled'}>Previous</button><span>Page ${F.page+1} of ${pages}</span><button class="btn small" data-act="page:orders:1"${F.page<pages-1?'':' disabled'}>Next</button>`:''}</div>`}

function vMembers(){
  const F=ST.members;
  const pool0=USERS.filter(u=>(ST.showTest||!u.isTest)&&(ST.area==='all'||u.area===ST.area));
  const sexN=g=>pool0.filter(u=>sexOf(u).g===g).length;
  const pool=F.sex==='all'?pool0:pool0.filter(u=>sexOf(u).g===F.sex);
  const segCounts=SEGMENTS.map(([k,l,f])=>[k,l,pool.filter(u=>f(u,MS.get(u.id))).length]);
  const segF=SEGMENTS.find(s=>s[0]===F.seg)[2];
  let L=pool.filter(u=>segF(u,MS.get(u.id)));
  if(F.q){const q=F.q.toLowerCase();L=L.filter(u=>u.nick.toLowerCase().includes(q)||u.id.toLowerCase().includes(q))}
  const tabs=`<div class="tabs" role="tablist">${[['members','Member list'],['good','Good customers'],['watch','Watch list']].map(([k,l])=>`<button role="tab" aria-selected="${F.tab===k}" data-act="mtab:${k}">${l}</button>`).join('')}</div>`;
  const consented=L.filter(u=>u.consent).length;
  if(F.tab==='good'){
    const G=pool.map(u=>({u,s:MS.get(u.id)})).filter(x=>x.s.done>=2).map(x=>({...x,cr:x.s.cancelled/x.s.orders})).filter(x=>x.cr<.25&&!TICKETS.some(t=>t.user===x.u.id&&t.topic==='Runner was late'&&false))
      .sort((a,b)=>b.s.done-a.s.done||a.cr-b.cr).slice(0,30);
    return tabs+`<p class="muted" style="margin:0 0 12px">Most finished orders with a low cancel rate and no complaints. Use for thank-you messages, early testers and check-ins when they stop ordering. Staff only; never shown to members.</p>
    <div class="tbl-wrap"><table><thead><tr><th class="n">#</th><th>Member</th><th>Level</th><th class="n">Finished</th><th class="n">Cancel rate</th><th class="n">Fees paid</th><th>Last order</th><th>Favourite</th><th>Area</th><th class="n">Confirms in</th></tr></thead>
    <tbody>${G.map((x,i)=>`<tr class="click" data-act="member:${x.u.id}"><td class="n">${i+1}</td><td>${who(x.u.id)}</td><td>${levelPill(x.s.level)}</td><td class="n">${x.s.done}</td><td class="n">${Math.round(x.cr*100)}%</td><td class="n">${Y(x.s.fees)}</td><td>${x.s.last?ago(x.s.last):'—'}${x.s.last&&NOW-x.s.last>14*DAY?' <span class="pill warn">Stopped</span>':''}</td><td>${x.s.fav}</td><td>${AREA[x.u.area].en}</td><td class="n">${fMin(x.s.confMed)}</td></tr>`).join('')}</tbody></table></div>`}
  if(F.tab==='watch'){
    const W=pool.map(u=>({u,s:MS.get(u.id)})).filter(x=>x.s.orders>=3&&x.s.cancelled/x.s.orders>=.34||x.s.autoConf>=2).sort((a,b)=>b.s.cancelled-a.s.cancelled||b.s.autoConf-a.s.autoConf);
    const RW=activeRunners.map(r=>({r,c:ORDERS.filter(o=>o.runnerCancelled===r.id).length,m:MARKS.filter(m=>m.runner===r.id&&m.expiresAt>NOW).length})).filter(x=>x.c>=1&&x.m>=1||x.m>=2||x.c>=2);
    return tabs+`<p class="muted" style="margin:0 0 12px">Students who cancel a lot or never confirm (so runners wait for auto-confirm), and runners who cancel after taking jobs. A check-in comes first; marks and freezes follow the platform rules.</p>
    <section class="panel"><div class="panel-head"><h2>Students</h2><span class="hint">${W.length}</span></div><div class="tbl-wrap"><table><thead><tr><th>Member</th><th class="n">Orders</th><th class="n">Cancelled by them</th><th class="n">Left to auto-confirm</th><th>Last active</th><th>Why listed</th></tr></thead><tbody>${W.map(x=>`<tr class="click" data-act="member:${x.u.id}"><td>${who(x.u.id)}</td><td class="n">${x.s.orders}</td><td class="n">${x.s.cancelled}</td><td class="n">${x.s.autoConf}</td><td>${ago(x.u.lastActive)}</td><td>${x.s.orders>=3&&x.s.cancelled/x.s.orders>=.34?'<span class="pill warn">Cancels often</span> ':''}${x.s.autoConf>=2?'<span class="pill info">Slow to confirm</span>':''}</td></tr>`).join('')||'<tr><td colspan="6"><div class="empty">Nobody on the list.</div></td></tr>'}</tbody></table></div></section>
    <div class="section-gap"></div>
    <section class="panel"><div class="panel-head"><h2>Runners</h2><span class="hint">${RW.length}</span></div><div class="tbl-wrap"><table><thead><tr><th>Runner</th><th class="n">Cancelled after taking</th><th class="n">Active marks</th><th>Status</th></tr></thead><tbody>${RW.map(x=>`<tr class="click" data-act="runner:${x.r.id}"><td>${who(x.r.id)}</td><td class="n">${x.c}</td><td class="n">${x.m}</td><td>${PAUSED[x.r.id]>NOW?`<span class="pill crit">Paused until ${fDay(PAUSED[x.r.id])}</span>`:'<span class="pill good">Can take jobs</span>'}</td></tr>`).join('')||'<tr><td colspan="4"><div class="empty">Nobody on the list.</div></td></tr>'}</tbody></table></div></section>`}
  const sorters={active:(a,b)=>b.lastActive-a.lastActive,points:(a,b)=>MS.get(b.id).points-MS.get(a.id).points,orders:(a,b)=>MS.get(b.id).orders-MS.get(a.id).orders,joined:(a,b)=>b.joined-a.joined};
  L.sort(sorters[F.sort]);
  const per=40,pages=Math.max(1,Math.ceil(L.length/per));if(F.page>=pages)F.page=pages-1;
  return tabs+`<div class="chips" role="group" aria-label="Segments">${segCounts.map(([k,l,n])=>`<button class="chip" aria-pressed="${F.seg===k}" data-act="seg:${k}" data-tip="${esc(segHelp(k))}">${l} <b>${n.toLocaleString()}</b></button>`).join('')}</div>
  <div class="toolbar"><input class="grow" type="search" id="m-q" placeholder="Search nickname or member ID" value="${esc(F.q)}" aria-label="Search members">
    <div class="seg" role="group" aria-label="Girls or boys">${[['all',LANG==='zh'?'全部':'All',pool0.length],['Female',sexL('Female',1),sexN('Female')],['Male',sexL('Male',1),sexN('Male')]].map(([k,l,n])=>`<button aria-pressed="${F.sex===k}" data-act="msex:${k}" translate="no">${l} <b>${n.toLocaleString()}</b></button>`).join('')}</div>
    <select id="m-sort" aria-label="Sort">${[['active','Last active'],['points','Points'],['orders','Orders'],['joined','Newest members']].map(([v,l])=>`<option value="${v}"${F.sort===v?' selected':''}>Sort: ${l}</option>`).join('')}</select>
    <button class="btn small" data-act="newsTo:${F.seg}"${dis('news')}>Message this segment</button>
    <button class="btn small" data-act="export:members"${dis('export')}>Export (masked)</button></div>
  <p class="muted" style="margin:-4px 0 10px;font-size:12.5px">${L.length.toLocaleString()} members · ${consented.toLocaleString()} turned on "News from Uniearn" and can be messaged</p>
  ${(()=>{const d=L.filter(u=>!u.sexChosen).length;return d?`<p class="faint" style="margin:-6px 0 10px;font-size:12px" translate="no">${LANG==='zh'?`其中 ${d.toLocaleString()} 人没有选择性别，按宿舍楼判断（女生楼/男生楼）。`:`${d.toLocaleString()} of these didn't choose girl or boy in the app, so it's worked out from their dorm building.`}</p>`:''})()}
  <div class="tbl-wrap"><table><thead><tr><th>Member</th><th>Level</th><th class="n">Points</th><th class="n">Orders</th><th class="n">Jobs</th><th>Last active</th><th>Dorm</th><th translate="no">${LANG==='zh'?'性别':'Girl / boy'}</th><th>Tags</th><th>News</th></tr></thead>
  <tbody>${L.slice(F.page*per,F.page*per+per).map(u=>{const s=MS.get(u.id);return`<tr class="click${u.isTest?' is-test':''}" data-act="member:${u.id}"><td>${who(u.id)}</td><td>${levelPill(s.level)}</td><td class="n">${s.points}</td><td class="n">${s.orders}</td><td class="n">${s.jobs}</td><td>${ago(u.lastActive)}</td><td>${esc(BLD[u.bld].name)}</td><td translate="no">${sexCell(u)}</td><td>${[...u.tags].map(t=>`<span class="tag">${t}</span>`).join('')||'<span class="faint">—</span>'}</td><td>${u.consent?'<span class="pill good">On</span>':'<span class="pill plain">Off</span>'}</td></tr>`}).join('')||'<tr><td colspan="10"><div class="empty">No members in this segment.</div></td></tr>'}</tbody></table></div>
  <div class="pager">${pages>1?`<button class="btn small" data-act="page:members:-1"${F.page?'':' disabled'}>Previous</button><span>Page ${F.page+1} of ${pages}</span><button class="btn small" data-act="page:members:1"${F.page<pages-1?'':' disabled'}>Next</button>`:''}</div>`}
const levelPill=l=>l==='Gold'?'<span class="pill warn plain">Gold</span>':l==='Silver'?'<span class="pill info plain">Silver</span>':'<span class="pill plain">Member</span>';

function runnerStats(id,B){
  const J=ORDERS.filter(o=>o.runner===id&&o.deliveredAt&&(ST.showTest||!o.isTest)&&(!B||o.deliveredAt>=B[0]&&o.deliveredAt<=B[1]));
  const all=ORDERS.filter(o=>o.runner===id&&o.status==='confirmed'&&(ST.showTest||!o.isTest)).length;
  return{jobs:J.length,onTime:pct(J.filter(o=>o.deliveredAt-o.pickedAt<=15*MIN).length,J.length),del:median(J.map(o=>(o.deliveredAt-o.pickedAt)/MIN)),
    earned:sum(J.filter(o=>o.status==='confirmed').map(o=>o.fee+o.offerRaised)),cancels:ORDERS.filter(o=>o.runnerCancelled===id&&(!B||o.cancelledAt>=B[0])).length,
    last:Math.max(0,...ORDERS.filter(o=>o.runner===id&&o.deliveredAt).map(o=>o.deliveredAt))||null,total:all,
    marks:MARKS.filter(m=>m.runner===id&&m.expiresAt>NOW).length,rating:avg(J.filter(o=>o.rating).map(o=>o.rating))}}
function vRunners(){
  const F=ST.runners;
  const cert=USERS.filter(u=>u.certified&&(ST.showTest||!u.isTest));
  const act7=activeRunners7(); const never=cert.filter(u=>!ORDERS.some(o=>o.runner===u.id)).length;
  const pend=APPS.filter(a=>a.status==='pending');
  const head=`<div class="kpis">
    <div class="kpi"><span class="lab">Certified runners</span><span class="val num">${cert.length}</span><span class="d">XJTLU student check passed</span></div>
    <div class="kpi ${tone('active7',act7)}"><span class="lab">Active, last 7 days</span><span class="val num">${act7}</span>${goalTxt('active7',act7)}<span class="d">${pct(act7,cert.length)}% of certified</span></div>
    <div class="kpi"><span class="lab">Never ran a job</span><span class="val num">${never}</span><span class="d">Good targets for a first-job nudge</span></div>
    <div class="kpi"><span class="lab">Applications to check by hand</span><span class="val num">${pend.length}</span><span class="d">${pend.length?'Oldest waiting '+fMin((NOW-Math.min(...pend.map(a=>a.appliedAt)))/MIN):'None waiting'}</span></div></div>
  <div class="tabs" role="tablist">${[['apps','Applications'],['rank','Ranking'],['marks','Marks & pauses'],['levels','Levels']].map(([k,l])=>`<button role="tab" aria-selected="${F.tab===k}" data-act="rtab:${k}">${l}</button>`).join('')}</div>`;
  if(F.tab==='apps'){
    const L=APPS.filter(a=>F.appStatus==='all'||a.status===F.appStatus).filter(a=>ST.area==='all'||UMAP[a.user].area===ST.area).sort((a,b)=>F.appStatus==='pending'?a.appliedAt-b.appliedAt:(b.checkedAt||b.appliedAt)-(a.checkedAt||a.appliedAt));
    const pend=APPS.filter(a=>a.status==='pending'),ready=pend;
    const done7=APPS.filter(a=>a.checkedAt&&a.checkedAt>=NOW-7*DAY&&a.status!=='revoked');
    const turn=median(done7.map(a=>(a.checkedAt-a.appliedAt)/MIN));
    const pendCol=F.appStatus==='pending';
    const cnt=k=>APPS.filter(a=>k==='all'||a.status===k).length;
    return head+`<div class="chips">${[['pending','To review'],['approved','Approved'],['rejected','Rejected'],['revoked','Revoked'],['all','All']].map(([k,l])=>`<button class="chip" aria-pressed="${F.appStatus===k}" data-act="appst:${k}">${l} <b>${cnt(k)}</b></button>`).join('')}</div>
    <div class="verify"><div><b>One-click approval</b><span>The system checks the student ID format and duplicates. If both pass, approve with one click. No student card photo is needed. Automatic checking with a student API comes later.</span></div>
      <div class="vstats"><span><b>${ready.length}</b> to review</span><span class="${turn==null?'':tone('appWait',turn/60)==='good'?'d-good':'d-bad'}"><b>${fMin(turn)}</b> median time to a decision, 7 days</span></div>
      ${ready.length?`<button class="btn primary" data-act="app:${ready.sort((a,b)=>a.appliedAt-b.appliedAt)[0].id}"${dis('approve')}>Start reviewing (oldest first)</button>`:''}</div>
    <div class="tbl-wrap"><table><thead><tr><th>Applicant</th><th>${pendCol?'Waiting':'Applied'}</th><th>Dorm</th><th>Student ID</th><th>Status</th><th>${pendCol?'':'Checked by'}</th></tr></thead><tbody>${L.slice(0,60).map(a=>{const u=UMAP[a.user];return`<tr class="click" data-act="app:${a.id}"><td>${who(u.id)}</td><td>${pendCol?`<span class="${NOW-a.appliedAt>24*HR?'d-bad':''}">${fMin((NOW-a.appliedAt)/MIN)}</span>`:fDT(a.appliedAt)}</td><td>${esc(BLD[u.bld].name)} <span class="faint">· ${BLD[u.bld].gender}</span></td><td class="mono">${maskSid(u.sid)}</td><td>${appPill(a)}${a.override?' <span class="pill warn">Anyway</span>':''}</td><td>${a.status==='pending'?'<span class="row" style="gap:6px;flex-wrap:nowrap">'+(appOk(a)?'<button class="btn small primary" data-act="approve:'+a.id+'"'+dis('approve')+'>Approve</button>':'<span class="pill crit">Check failed</span><button class="btn small" data-act="approveAny:'+a.id+'"'+dis('approve')+'>Approve anyway</button>')+'<button class="btn small" data-act="app:'+a.id+'">Details</button></span>':`${esc(a.checkedBy||'—')} <span class="faint">${a.checkedAt?'· '+fDay(a.checkedAt):''}</span>`}</td></tr>`}).join('')||'<tr><td colspan="7"><div class="empty">Nothing here.</div></td></tr>'}</tbody></table></div>${L.length>60?`<p class="faint">Showing 60 of ${L.length}.</p>`:''}`}
  if(F.tab==='rank'){
    const B=rangeBounds();
    const L=cert.map(u=>({u,s:runnerStats(u.id,B)})).filter(x=>x.s.jobs>0&&(ST.area==='all'||x.u.area===ST.area)).sort((a,b)=>b.s.jobs-a.s.jobs||b.s.onTime-a.s.onTime);
    const totalJobs=sum(L.map(x=>x.s.jobs));
    return head+`<p class="muted" style="margin:0 0 12px">Jobs delivered in the last ${rangeBounds()[2]}. Earnings are the full delivery fees, credited to the runner's wallet when the student confirms.</p>
    <div class="tbl-wrap"><table><thead><tr><th class="n">#</th><th>Runner</th><th>Level</th><th class="n">Jobs</th><th class="n">Share</th><th class="n">Delivered ≤15 min</th><th class="n">Median delivery</th><th class="n">Rating</th><th class="n">Cancelled after taking</th><th class="n">Earned</th><th>Last job</th></tr></thead>
    <tbody>${L.map((x,i)=>`<tr class="click" data-act="runner:${x.u.id}"><td class="n">${i+1}</td><td>${who(x.u.id)}</td><td>${lvlPill(levelOf(x.s.total))}</td><td class="n">${x.s.jobs}</td><td class="n">${pct(x.s.jobs,totalJobs)}%</td><td class="n ${tone('onTime',x.s.onTime)==='good'?'g':'b'}">${x.s.onTime}%</td><td class="n">${fMin(x.s.del)}</td><td class="n">${x.s.rating?x.s.rating.toFixed(1):'—'}</td><td class="n${x.s.cancels?' d-bad':''}">${x.s.cancels}</td><td class="n">${Y(x.s.earned)}</td><td>${x.s.last?ago(x.s.last):'—'}${x.s.last&&NOW-x.s.last<7*DAY?'':' <span class="pill plain">Inactive</span>'}</td></tr>`).join('')||'<tr><td colspan="11"><div class="empty">No jobs in this period.</div></td></tr>'}</tbody></table></div>`}
  if(F.tab==='marks'){
    const M=MARKS.filter(m=>m.expiresAt>NOW).sort((a,b)=>b.givenAt-a.givenAt);
    return head+`<div class="box note" style="margin-bottom:12px">One mark per broken rule. Marks carry no money and expire after ${cfg('markExpiryDays')} days. 3 active marks send a runner back to New; 5 pause them for 7 days.</div>
    <div class="tbl-wrap"><table><thead><tr><th>Runner</th><th>Rule</th><th>Given</th><th>Expires</th><th class="n">Active marks</th><th>Status</th></tr></thead><tbody>${M.map(m=>{const n=MARKS.filter(x=>x.runner===m.runner&&x.expiresAt>NOW).length;return`<tr class="click" data-act="runner:${m.runner}"><td>${who(m.runner)}</td><td>${esc(m.rule)}</td><td>${fDT(m.givenAt)}</td><td>${fDay(m.expiresAt)}</td><td class="n">${n}</td><td>${PAUSED[m.runner]>NOW?`<span class="pill crit">Paused until ${fDay(PAUSED[m.runner])}</span>`:n>=3?'<span class="pill warn">Back to New</span>':'<span class="pill plain">Warning</span>'}</td></tr>`}).join('')||'<tr><td colspan="6"><div class="empty">No active marks.</div></td></tr>'}</tbody></table></div>`}
  // levels
  return head+`<div class="grid g2"><section class="panel"><div class="panel-head"><h2>Runner levels</h2><span class="hint">Pay limit per trip</span></div>
    <div class="tbl-wrap" style="border:0"><table><thead><tr><th>Level</th><th>Reached after</th><th class="n">Limit per trip</th><th class="n">Runners now</th></tr></thead><tbody>
    ${[['new','Student check',0],['rising','5 finished jobs',5],['trusted','10 finished jobs',10],['top','20 finished jobs',20]].map(([k,l])=>`<tr><td>${lvlPill(k)}</td><td>${l}</td><td class="n">${ST.levels[k]==null?'No limit':'¥'+ST.levels[k]}</td><td class="n">${cert.filter(u=>levelOf(runnerStats(u.id).total)===k).length}</td></tr>`).join('')}</tbody></table></div>
    <p class="faint" style="font-size:12px;margin:8px 0 0">Up to ${cfg('maxBags')} bags per trip at every level. Points and membership never change a runner's level.</p></section>
    <section class="panel"><div class="panel-head"><h2>Who can take what</h2></div><ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px;color:var(--muted)">
    <li>XJTLU students only, after staff check their real name and student ID.</li><li>Runners never see or take their own orders.</li><li>The job hall shows routes, prices and times. Room, full phone and pickup code unlock only after taking.</li><li>Runners who can't enter a building (male/female dorms) only see lobby drop-offs there.</li><li>Phase 2 tasks: Rising and above; over ¥15 Trusted and Top; over ¥25 Top only.</li></ul></section></div>`}
const lvlPill=k=>`<span class="pill ${k==='top'?'good':k==='trusted'?'info':'plain'}">${LEVEL_LABEL[k]}</span>`;
const appPill=a=>a.status==='pending'?'<span class="pill info">To review</span>':a.status==='approved'?'<span class="pill good">Approved</span>':a.status==='rejected'?`<span class="pill plain">Rejected</span>`:'<span class="pill warn">Revoked</span>';
const cfg=k=>ST.config.find(c=>c.k===k).v;
const ruleOn=k=>ST.config.find(c=>c.k===k).on;
const PHASES={launch:'Launch',p2:'Phase 2',p3:'Phase 3',later:'Later'};

function addrOrders(a){return ORDERS.filter(o=>o.customer===a.user&&o.bld===a.bld&&(ST.showTest||!o.isTest))}
function vAddresses(){
  const F=ST.addr,ed=can('config');
  const pool=ADDRS.filter(a=>(ST.showTest||!UMAP[a.user].isTest)&&(ST.area==='all'||BLD[a.bld].area===ST.area));
  const blds=BUILDINGS.filter(b=>ST.area==='all'||b.area===ST.area);
  const set=blds.filter(b=>b.lockerLoc).length;
  const head=`<div class="kpis">
    <div class="kpi"><span class="lab">Saved addresses</span><span class="val num">${pool.length}</span><span class="d">One per student, used on every order</span></div>
    <div class="kpi"><span class="lab">Added, last 7 days</span><span class="val num">${pool.filter(a=>a.createdAt>=NOW-7*DAY).length}</span><span class="d">New students ready to order</span></div>
    <div class="kpi"><span class="lab">Missing a room number</span><span class="val num">${pool.filter(a=>!a.room).length}</span><span class="d">Runner can only use the lobby</span></div>
    <div class="kpi"><span class="lab">Buildings with a locker set</span><span class="val num">${set}<small>/ ${blds.length}</small></span><span class="d">Where lobby drop-offs go</span></div></div>
  <div class="tabs" role="tablist">${[['list','Saved addresses'],['lockers','Food lockers by building']].map(([k,l])=>`<button role="tab" aria-selected="${F.tab===k}" data-act="atab:${k}">${l}</button>`).join('')}</div>`;
  if(F.tab==='lockers'){
    return head+`<div class="box note" style="margin-bottom:12px">Set the food locker once per building. Every saved address in that building uses it, and runners see it on the job card when the student chose lobby drop-off.</div>
    ${ed?'':'<p class="muted" style="margin:0 0 10px;font-size:12.5px">Only Admins can change locker locations.</p>'}
    <div class="tbl-wrap"><table><thead><tr><th>Building</th><th>Area</th><th>Dorm</th><th>Food locker location</th><th class="n">Addresses</th><th class="n">Lobby drop-off</th><th class="n">Orders, 30 days</th></tr></thead><tbody>${blds.map(b=>{const A=pool.filter(a=>a.bld===b.id);
      return`<tr><td>${esc(b.name)}</td><td>${areaL(b.area)}</td><td>${b.gender}</td><td>${ed?`<input type="text" id="lk-${b.id}" value="${esc(b.lockerLoc)}" placeholder="Not set: e.g. Lobby shelf, left of the door" aria-label="Locker location for ${esc(b.name)}" style="width:100%;min-width:240px">`:(b.lockerLoc?esc(b.lockerLoc):'<span class="pill warn">Not set</span>')}</td><td class="n">${A.length}</td><td class="n">${A.filter(a=>a.drop==='lobby').length}</td><td class="n">${ORDERS.filter(o=>o.bld===b.id&&!o.isTest&&o.postedAt>=TODAY0-29*DAY).length}</td></tr>`}).join('')}</tbody></table></div>`}
  let L=pool;
  if(F.q){const q=F.q.toLowerCase();L=L.filter(a=>{const u=UMAP[a.user];return u.nick.toLowerCase().includes(q)||u.id.toLowerCase().includes(q)||a.contact.toLowerCase().includes(q)||BLD[a.bld].code.toLowerCase().includes(q)||a.id===q})}
  if(F.bld!=='all')L=L.filter(a=>a.bld===F.bld);
  if(F.noRoom)L=L.filter(a=>!a.room);
  if(F.noLocker)L=L.filter(a=>!BLD[a.bld].lockerLoc);
  L=[...L].sort((a,b)=>b.createdAt-a.createdAt);
  const per=40,pages=Math.max(1,Math.ceil(L.length/per));if(F.page>=pages)F.page=pages-1;
  return head+`<div class="toolbar"><input class="grow" type="search" id="a-q" placeholder="Search member, contact name or building (e.g. D04)" value="${esc(F.q)}" aria-label="Search addresses">
    <select id="a-bld" aria-label="Building"><option value="all">All buildings</option>${blds.map(b=>`<option value="${b.id}"${F.bld===b.id?' selected':''}>${esc(b.name)}</option>`).join('')}</select>
    <label class="chk"><input type="checkbox" id="a-noRoom"${F.noRoom?' checked':''}> Missing room</label>
    <label class="chk"><input type="checkbox" id="a-noLocker"${F.noLocker?' checked':''}> Building has no locker set</label>
    <button class="btn small" data-act="export:addresses"${dis('export')}>Export (masked)</button></div>
  <p class="muted" style="margin:-4px 0 10px;font-size:12.5px">${L.length} addresses. Phone and room are masked; Admins can show them one address at a time, and each view is logged.</p>
  <div class="tbl-wrap"><table><thead><tr><th class="n">ID</th><th>Member</th><th>Contact name</th><th>Phone</th><th>Dorm</th><th>Room</th><th>Drop-off</th><th>Food locker</th><th class="n">Orders here</th><th>Added</th></tr></thead>
  <tbody>${L.slice(F.page*per,F.page*per+per).map(a=>{const b=BLD[a.bld],u=UMAP[a.user];return`<tr class="click${u.isTest?' is-test':''}" data-act="address:${a.id}"><td class="n mono">${a.id}</td><td>${who(a.user)}</td><td translate="no">${esc(a.contact)}</td><td class="mono">${maskPhone(u.phone)}</td><td>${esc(b.name)} <span class="faint">${areaL(b.area)}</span></td><td class="mono">${a.room?maskRoom(a.room):'<span class="pill warn">Missing</span>'}</td><td>${a.drop==='door'?'At the door':'Lobby'}</td><td class="wt" style="min-width:150px">${b.lockerLoc?esc(b.lockerLoc):'<span class="pill warn">Not set</span>'}</td><td class="n">${addrOrders(a).length}</td><td>${fDT(a.createdAt)}</td></tr>`}).join('')||'<tr><td colspan="10"><div class="empty">No addresses match.</div></td></tr>'}</tbody></table></div>
  <div class="pager">${pages>1?`<button class="btn small" data-act="page:addr:-1"${F.page?'':' disabled'}>Previous</button><span>Page ${F.page+1} of ${pages}</span><button class="btn small" data-act="page:addr:1"${F.page<pages-1?'':' disabled'}>Next</button>`:''}</div>`}

function reasonRows(list){
  const m={};list.filter(o=>o.cancelledBy).forEach(o=>{const k=o.cancelReason||'Other';const r=m[k]=m[k]||{k,n:0,student:0,system:0,runner:0,fen:0};r.n++;r[o.cancelledBy]=(r[o.cancelledBy]||0)+1;r.fen+=sum(o.refunds.map(x=>x.fen))});
  return Object.values(m).sort((a,b)=>b.n-a.n)}
function whoText(r){return[r.student?`${r.student} by students`:'',r.system?`${r.system} closed automatically`:'',r.runner?`${r.runner} by runners`:''].filter(Boolean).join(' · ')}
const FEE_BUCKETS=[[0,300,'¥3 or less'],[301,400,'¥3.50–4'],[401,500,'¥4.50–5'],[501,1e9,'Over ¥5']];
function vCancels(){
  const F=ST.cancel,B=rangeBounds(),list=scoped(B),PB=prevBounds(),prev=PB?scoped(PB):null;
  if(F.reason)return vCancelReason(F.reason,list,prev);
  const C=list.filter(o=>o.cancelledBy),fin=list.filter(o=>!LIVE.has(o.status)),pC=prev?prev.filter(o=>o.cancelledBy):null;
  const RR=reasonRows(list),pR=prev?reasonRows(prev):[];
  const nr=C.filter(o=>o.cancelReason===NO_RUNNER).length,ref=sum(C.map(o=>sum(o.refunds.map(r=>r.fen))));
  const rows=REASONS.filter(r=>!r.test||ST.showTest).map(m=>({m,r:RR.find(x=>x.k===m.k)||{k:m.k,n:0,student:0,system:0,runner:0,fen:0},p:(pR.find(x=>x.k===m.k)||{n:0}).n}))
    .concat(RR.filter(r=>!REASONS.some(m=>m.k===r.k)).map(r=>({m:{k:r.k,zh:'',who:''},r,p:0})))
    .sort((a,b)=>b.r.n-a.r.n);
  const max=Math.max(1,...rows.map(x=>x.r.n));
  return`<div class="kpis">
    <div class="kpi"><span class="lab">Cancelled or expired</span><span class="val num">${C.length}</span>${delta(C.length,pC?.length,{goodUp:false})}</div>
    <div class="kpi ${tone('cancelRate',pct(C.length,fin.length))}"><span class="lab">Cancel rate</span><span class="val num">${pct(C.length,fin.length)}<small>%</small></span>${goalTxt('cancelRate',pct(C.length,fin.length))}<span class="d">of ${fin.length} finished or cancelled orders</span></div>
    <button class="kpi kpi-link" data-act="creason:${encodeURIComponent(NO_RUNNER)}"><span class="lab">No one took the order</span><span class="val num">${nr}</span><span class="d">${pct(nr,C.length)}% of all cancellations</span></button>
    <div class="kpi"><span class="lab">Refunded</span><span class="val num">${Y0(ref)}</span><span class="d">Back to students' WeChat Pay</span></div></div>
  <section class="panel"><div class="panel-head"><h2>Cancel reasons</h2><span class="hint">Click a reason to see its orders, ${ST.range==='all'?'all time':'last '+rangeBounds()[2]}</span></div>
    <div class="tbl-wrap" style="border:0"><table><thead><tr><th>Reason</th><th>Student can pick it</th><th class="n">Orders</th><th style="min-width:120px">Share</th><th class="n">${prev?'Previous period':''}</th><th class="n">Refunded</th><th></th></tr></thead>
    <tbody>${rows.map(({m,r,p})=>`<tr class="click${r.n?'':' zero'}" data-act="creason:${esc(encodeURIComponent(m.k))}"><td><b style="font-weight:600">${esc(m.k)}</b><br><small class="faint">${r.n?whoText(r):esc(m.who)}</small></td><td>${m.app?'<span class="tag">In the app</span>':'<span class="faint">—</span>'}</td><td class="n"><b>${r.n}</b></td><td><span class="cbar"><span style="width:${r.n/max*100}%"></span></span><small class="faint">${pct(r.n,C.length)}%</small></td><td class="n">${prev?(p===r.n?'<span class="faint">same</span>':`${p} <span class="${r.n>p?'d-bad':'d-good'}">${r.n>p?'▲':'▼'}</span>`):''}</td><td class="n">${r.fen?Y(r.fen):'—'}</td><td class="chev">›</td></tr>`).join('')}</tbody></table></div>
    <p class="faint" style="font-size:12px;margin:10px 0 0">Students pick one reason on the cancel screen; "Other" asks for a short note. "No one took the order" also counts orders that closed automatically with no runner (${cfg('closeAfterDueMin')} min after takeaway was due).</p></section>`}
function bldTable(O,list,k){
  const mode=(arr)=>{const m={};arr.forEach(x=>m[x]=(m[x]||0)+1);return Object.entries(m).sort((a,b)=>b[1]-a[1])[0]};
  const campus=pct(O.length,list.length);
  const rows=BUILDINGS.filter(b=>ST.area==='all'||b.area===ST.area).map(b=>{const all=list.filter(o=>o.bld===b.id),c=O.filter(o=>o.bld===b.id);
    const pu=mode(c.map(o=>o.pickup)),hr=mode(c.map(o=>HOUR_BUCKET(hourOf(o.postedAt))));
    return{b,n:c.length,all:all.length,rate:pct(c.length,all.length),pu:pu?PU[pu[0]].name:'—',hr:hr?hr[0]:'—',fee:c.length?avg(c.map(o=>o.fee)):null,mem:USERS.filter(u=>u.bld===b.id&&!u.isTest).length}});
  const hit=rows.filter(r=>r.n>0).sort((a,b)=>b.n-a.n||b.rate-a.rate),none=rows.length-hit.length,max=Math.max(1,...hit.map(r=>r.n));
  const top=hit.slice(0,3).reduce((t,r)=>t+r.n,0);
  return`<section class="panel"><div class="panel-head"><h2>By building</h2><span class="hint">Worst first · click a building to see only its orders</span></div>
    ${hit.length>=3?`<div class="box note" style="margin-bottom:12px"><span><b style="color:var(--fg)">Focus on ${hit.slice(0,3).map(r=>esc(r.b.name)).join(', ')}.</b> These 3 buildings have ${top} of the ${O.length} cancellations (${pct(top,O.length)}%). Campus rate for this reason: ${campus}% of orders.</span></div>`:''}
    <div class="tbl-wrap"><table><thead><tr><th class="n">#</th><th>Building</th><th class="n">Cancelled</th><th style="min-width:110px"></th><th class="n">Of its orders</th><th>Usual pickup</th><th>Usual time</th><th class="n">Avg fee</th><th class="n">Members there</th></tr></thead>
    <tbody>${hit.map((r,i)=>`<tr class="click${ST.cancel.bld===r.b.id?' sel':''}" data-act="cbld:${r.b.id}"><td class="n">${i+1}</td><td><b style="font-weight:600">${esc(r.b.name)}</b><br><small class="faint">${areaL(r.b.area)} · ${r.b.gender}</small></td><td class="n"><b>${r.n}</b></td><td><span class="cbar"><span style="width:${r.n/max*100}%"></span></span></td><td class="n ${r.rate>campus?'b':'g'}">${r.rate}% <span class="faint" style="font-weight:400">of ${r.all}</span></td><td>${esc(r.pu)}</td><td>${r.hr}</td><td class="n">${r.fee==null?'—':Y(r.fee)}</td><td class="n">${r.mem}</td></tr>`).join('')}</tbody></table></div>
    <p class="faint" style="font-size:12px;margin:8px 0 0"><span class="d-bad" style="font-weight:600">Red</span>: above the campus rate (${campus}%). <span class="d-good" style="font-weight:600">Green</span>: at or below it.${none?` ${none} building${none>1?'s':''} had none.`:''}</p></section>`}
function vCancelReason(k,list,prev){
  const m=REASONS.find(r=>r.k===k)||{k,zh:'',who:''};
  const O=list.filter(o=>o.cancelledBy&&o.cancelReason===k).sort((a,b)=>b.cancelledAt-a.cancelledAt);
  if(ST.cancel.bld&&!O.some(o=>o.bld===ST.cancel.bld))ST.cancel.bld=null;
  const OF=ST.cancel.bld?O.filter(o=>o.bld===ST.cancel.bld):O;
  const allC=list.filter(o=>o.cancelledBy).length,P=prev?prev.filter(o=>o.cancelledBy&&o.cancelReason===k).length:null;
  const waits=O.map(o=>(o.cancelledAt-o.postedAt)/MIN),ref=sum(O.map(o=>sum(o.refunds.map(r=>r.fen))));
  const r=reasonRows(O)[0]||{student:0,system:0,runner:0};
  const hours=H24.map(h=>O.filter(o=>hourOf(o.postedAt)===h).length);
  const cw=document.getElementById('view').clientWidth||900,narrow=innerWidth<=900,halfW=narrow?Math.max(280,cw-34):Math.max(280,(cw-16)/2-34);
  const split=(groups,label)=>{const rows=groups.map(([g,f])=>{const all=list.filter(f),n=O.filter(f).length;return{g,n,all:all.length,rate:pct(n,all.length)}});const mx=Math.max(1,...rows.map(x=>x.n));
    return`<div class="hbars">${rows.map(x=>`<div class="hbar"><span>${esc(x.g)}</span><div class="track"><span style="width:${x.n/mx*100}%;background:var(--s-cancel)"></span></div><span class="v">${x.n} · ${x.rate}% of ${x.all}</span></div>`).join('')}</div><p class="faint" style="font-size:12px;margin:8px 0 0">"% of" = share of all ${label} orders that ended this way.</p>`};
  const fees=FEE_BUCKETS.map(([a,b,l])=>[l,o=>o.fee>=a&&o.fee<=b]);
  const rate=f=>{const all=list.filter(f);return all.length?O.filter(f).length/all.length:0},lo=rate(o=>o.fee<=400),hi=rate(o=>o.fee>400);
  const insight=k===NO_RUNNER&&O.length&&lo>hi?`<div class="box note" style="margin-bottom:16px"><span><b style="color:var(--fg)">Low fees go untaken.</b> ${Math.round(lo*100)}% of orders at ¥4 or less ended with no runner, against ${Math.round(hi*100)}% at ¥4.50 and up. The "Add ¥1–2" prompt after ${cfg('lowFeePrompt')} minutes and new-job alerts to runners target these.</span></div>`:'';
  return`<div class="row" style="margin-bottom:12px;justify-content:space-between"><button class="linkbtn" data-act="cback">‹ All cancel reasons</button><button class="btn small" data-act="corders:${esc(encodeURIComponent(k))}">Open these in Orders</button></div>
  <div style="margin-bottom:14px"><h2 class="page-title" style="font-size:21px">${esc(m.k)}</h2><p class="page-sub">${esc(m.who)} · ${ST.range==='all'?'all time':'last '+rangeBounds()[2]}${ST.area!=='all'?' · '+AREA[ST.area].en:''}${ST.type!=='all'?' · '+TYPES[ST.type]:''}</p></div>
  <div class="kpis">
    <div class="kpi"><span class="lab">Orders</span><span class="val num">${O.length}</span>${delta(O.length,P,{goodUp:false})}</div>
    <div class="kpi"><span class="lab">Share of cancellations</span><span class="val num">${pct(O.length,allC)}<small>%</small></span><span class="d">of ${allC}</span></div>
    <div class="kpi"><span class="lab">Time before cancelling</span><span class="val num">${fMin(median(waits))}</span><span class="d">Median, posted → cancelled</span></div>
    <div class="kpi"><span class="lab">Refunded</span><span class="val num">${Y0(ref)}</span><span class="d">${r.student} by students · ${r.system} automatic · ${r.runner} by runners</span></div></div>
  ${insight}
  ${O.length?`<section class="panel"><div class="panel-head"><h2>When these orders were posted</h2></div>${hourChart(hours,Math.max(280,cw-34),'var(--s-cancel)')}</section>
  <div class="section-gap"></div>
  ${bldTable(O,list,k)}
  <div class="section-gap"></div>
  <div class="grid g3">
    <section class="panel"><div class="panel-head"><h2>By delivery fee</h2></div>${split(fees,'orders at that fee')}</section>
    <section class="panel"><div class="panel-head"><h2>By dorm area</h2></div>${split(AREAS.map(a=>[areaL(a),o=>o.area===a.id]),'that area\'s')}</section>
    <section class="panel"><div class="panel-head"><h2>By order type</h2></div>${split(TYPE_KEYS.map(t=>[TYPES[t],o=>o.type===t]),'that type\'s')}</section></div>
  <div class="section-gap"></div>
  <section class="panel" id="reason-orders"><div class="panel-head"><h2>Order list</h2><span class="hint">${OF.length} · newest first</span>${ST.cancel.bld?`<span class="right"><span class="tag" style="margin:0">${esc(BLD[ST.cancel.bld].name)}</span><button class="linkbtn" data-act="cbld:">Show all buildings</button></span>`:''}</div>
    <div class="tbl-wrap"><table><thead><tr><th>Order</th><th>Posted</th><th>Cancelled</th><th class="n">Waited</th><th>Type</th><th class="n">Delivery fee</th><th>Route</th><th>Cancelled by</th>${O.some(o=>o.cancelNote)?'<th>Note</th>':''}<th>Student</th></tr></thead>
    <tbody>${OF.map(o=>`<tr class="click${o.isTest?' is-test':''}" data-act="order:${o.id}"><td class="mono">${o.id}${testPill(o.isTest)}</td><td>${fDT(o.postedAt)}</td><td>${fDT(o.cancelledAt)}</td><td class="n">${fMin((o.cancelledAt-o.postedAt)/MIN)}</td><td>${TYPES[o.type]}</td><td class="n">${Y(o.fee+o.offerRaised)}${o.offerRaised?' <span class="tag">+¥1</span>':''}</td><td>${route(o)}</td><td>${o.cancelledBy==='system'?'Automatic':o.cancelledBy==='runner'?'Runner':'Student'}${o.cancelStage==='taken'?' <span class="faint">after taken</span>':''}</td>${O.some(x=>x.cancelNote)?`<td translate="no">${o.cancelNote?'“'+esc(o.cancelNote)+'”':''}</td>`:''}<td>${who(o.customer)}</td></tr>`).join('')}</tbody></table></div></section>`
  :'<div class="empty panel">No orders were cancelled for this reason in this period. Try a longer date range.</div>'}`}

function vSupport(){
  const F=ST.support;
  const disputes=ORDERS.filter(o=>o.dispute&&(ST.showTest||!o.isTest)).sort((a,b)=>(a.dispute.status==='open'?0:1)-(b.dispute.status==='open'?0:1)||b.dispute.reportedAt-a.dispute.reportedAt);
  const openT=TICKETS.filter(t=>t.status==='open');
  const replied=TICKETS.filter(t=>t.firstReplyAt);
  const head=`<div class="kpis">
    ${(()=>{const W=TICKETS.filter(needsReply),old=W.length?(NOW-Math.min(...W.map(waitingSince)))/MIN:0;return`<div class="kpi ${W.length?tone('replyWait',old):'good'}"><span class="lab">Waiting for a reply</span><span class="val num">${W.length}</span>${W.length?goalTxt('replyWait',old).replace('Goal','Oldest '+fMin(old)+' · goal'):'<span class="goal">✓ Everyone answered</span>'}</div>`})()}
    ${(()=>{const m=median(replied.map(t=>(t.firstReplyAt-t.createdAt)/MIN));return`<div class="kpi ${tone('firstReply',m)}"><span class="lab">Median first reply</span><span class="val num">${fMin(m)}</span>${goalTxt('firstReply',m)}</div>`})()}</div></div>`;
  return head+inboxHTML()}
function inboxHTML(){
  const F=ST.support;
  const boxes=[['need','To reply',t=>needsReply(t)],['all','All',t=>true]];
  const bf=boxes.find(b=>b[0]===F.box)[2];
  let L=TICKETS.filter(bf);
  if(F.q){const q=F.q.toLowerCase();L=L.filter(t=>UMAP[t.user].nick.toLowerCase().includes(q)||t.user.toLowerCase().includes(q)||t.topic.toLowerCase().includes(q)||t.thread.some(m=>(m.text||'').toLowerCase().includes(q))||(t.order||'').toLowerCase().includes(q))}
  L.sort((a,b)=>F.box==='need'?waitingSince(a)-waitingSince(b):lastMsg(b).at-lastMsg(a).at);
  const t=TICKETS.find(x=>x.id===F.sel);
  const list=`<div class="ib-list"><div class="ib-filters"><div class="seg" role="group" aria-label="Inbox">${boxes.map(([k,l,f])=>`<button aria-pressed="${F.box===k}" data-act="sbox:${k}">${l} ${k==='need'?'<b>'+TICKETS.filter(f).length+'</b>':''}</button>`).join('')}</div>
    <input type="search" id="s-q" placeholder="Search name, message or order" value="${esc(F.q)}" aria-label="Search conversations"></div>
    <div class="ib-items">${L.map(x=>{const u=UMAP[x.user],m=lastMsg(x),nr=needsReply(x);return`<button class="ib-item" data-act="ssel:${x.id}" aria-current="${x.id===F.sel}"><b>${nr?'<span class="dot-new" aria-label="Needs reply"></span> ':''}<span translate="no">${esc(u.nick)}</span></b><span class="t">${nr?'<span class="d-bad">'+fMin((NOW-waitingSince(x))/MIN)+'</span>':fDT(m.at)}</span><span class="pre">${m.from==='staff'?(LANG==='zh'?'我：':'You: '):''}${(m.img||(m.imgs||[]).length)&&!m.text?(LANG==='zh'?'[图片]':'[Image]'):'<span translate="no">'+esc(m.text)+'</span>'}</span><span class="meta"><span class="tag" style="margin:0">${esc(x.topic)}</span>${x.role==='runner'?'<span class="tag" style="margin:0">Runner</span>':''}${x.order?'<span class="mono">'+x.order+'</span>':''}</span></button>`}).join('')||'<div class="empty">Nothing here.</div>'}</div></div>`;
  if(!t)return`<div class="inbox">${list}<div class="ib-chat"><div class="ib-empty">Pick a conversation on the left.</div></div><div class="ib-side"><p class="muted" style="margin:0">Member and order details show here.</p></div></div>`;
  const u=UMAP[t.user],s=MS.get(u.id),o=t.order?OMAP[t.order]:null,recent=ORDERS.filter(x=>(x.customer===u.id||x.runner===u.id)&&(ST.showTest||!x.isTest)).slice(-5).reverse();
  const others=TICKETS.filter(x=>x.user===u.id&&x.id!==t.id);
  const chat=`<div class="ib-chat"><div class="ib-head"><button class="btn small ib-back" data-act="ssel:">‹ Back</button><div style="min-width:0;flex:1"><h3><button class="linkbtn" style="font-size:16px" data-act="member:${u.id}" translate="no">${esc(u.nick)}</button>${testPill(u.isTest)}</h3><span class="faint" style="font-size:12px"><span class="mono">${t.id}</span> · opened ${fDT(t.createdAt)} · ${t.role==='runner'?'runner':'student'}</span></div></div>
    <div class="ib-msgs" id="ib-msgs">${t.thread.map(m=>`<div class="bubble ${m.from==='staff'?'staff':''}"><span class="from">${m.from==='staff'?'Uniearn · <span translate="no">'+esc(m.by||'Team')+'</span>':'<span translate="no">'+esc(u.nick)+'</span>'}</span>${m.img?`<div class="ph" style="aspect-ratio:4/3;width:200px;max-width:100%;font-size:12px;margin:2px 0">${esc(m.img)}</div>`:''}${(m.imgs||[]).length?`<span class="b-imgs">${m.imgs.map((x,i)=>`<button type="button" class="b-img" data-act="zoom:${t.id}:${t.thread.indexOf(m)}:${i}" aria-label="Open picture"><img src="${x.url}" alt="${esc(x.name)}"></button>`).join('')}</span>`:''}${m.text?'<span translate="no">'+esc(m.text)+'</span>':''}<small>${fDT(m.at)}</small></div>`).join('')}</div>
    <div class="ib-compose"><div class="ib-quick" aria-label="Quick replies">${QUICKS().map(([l],i)=>`<button class="btn small" data-act="quick:${i}">${l}</button>`).join('')}</div>
      <textarea id="s-reply" rows="2" placeholder="${LANG==='zh'?'回复 '+esc(u.nick)+' · Enter 发送，Shift+Enter 换行':'Reply to '+esc(u.nick)+' · Enter to send, Shift+Enter for a new line'}">${esc(F.draft||'')}</textarea>
      ${(F.att||[]).length?`<div class="att-row">${F.att.map((x,i)=>`<span class="att"><img src="${x.url}" alt="${esc(x.name)}"><button type="button" class="att-x" data-act="attDel:${i}" aria-label="Remove picture">×</button></span>`).join('')}</div>`:''}
      <div class="row" style="justify-content:space-between;flex-wrap:nowrap;align-items:flex-start"><span class="faint" style="font-size:12px">Sent as ${esc(ST.me)} through WeChat. Never ask for or send full phone numbers here.</span><span class="row" style="flex:none"><label class="btn small"${can('reply')?'':' aria-disabled="true"'}><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M20.5 16l-5-5-8 8"/></svg>Picture<input type="file" id="s-file" accept="image/*" multiple hidden${can('reply')?'':' disabled'}></label><button class="btn primary small" data-act="send:${t.id}"${dis('reply')}>Send</button></span></div></div></div>`;
  const side=`<div class="ib-side">
    <div class="side-card"><h4>Member info</h4><div class="row" style="gap:6px">${levelPill(s.level)}${u.certified?'<span class="tag">Runner</span>':''}${u.tags.has('Needs help')?'<span class="pill warn plain">Needs help</span>':''}</div>
      <dl class="dl"><dt>Orders</dt><dd>${s.orders} · ${s.done} finished</dd><dt>Jobs</dt><dd>${s.jobs}</dd><dt>Dorm</dt><dd>${esc(BLD[u.bld].name)}</dd><dt>Phone</dt><dd class="mono">${maskPhone(u.phone)}</dd><dt>Joined</dt><dd>${fDay(u.joined)}</dd><dt>Last active</dt><dd>${ago(u.lastActive)}</dd></dl>
      <button class="linkbtn" data-act="member:${u.id}">Open full profile ›</button></div>
    <div class="side-card"><h4>Linked order</h4>${o?`<button class="live-row" style="padding:4px 0;border:0" data-act="order:${o.id}"><span class="tt"><span class="mono">${o.id}</span><small>${TYPES[o.type]} · ${Y(o.fee)} · ${route(o)}</small></span>${pill(o.status)}</button><button class="linkbtn" style="font-size:12px" data-act="unlink:${t.id}">Unlink</button>`
      :(recent.length?`<label class="field">Link one of their orders<select id="s-link"><option value="">Choose an order</option>${recent.map(x=>`<option value="${x.id}">${x.id} · ${TYPES[x.type]} · ${fDT(x.postedAt)}</option>`).join('')}</select></label>`:'<p class="muted" style="margin:0;font-size:12.5px">No orders to link.</p>')}</div>
    <div class="side-card"><h4>This conversation</h4><dl class="dl"><dt>Status</dt><dd>${needsReply(t)?'<span class="pill crit">Needs reply</span>':'<span class="pill good">Replied</span>'}</dd><dt>First reply</dt><dd>${t.firstReplyAt?fMin((t.firstReplyAt-t.createdAt)/MIN)+' · '+esc(t.repliedBy||''):'<span class="d-bad">Not yet · '+fMin((NOW-t.createdAt)/MIN)+'</span>'}</dd><dt>Messages</dt><dd>${t.thread.length}</dd></dl>
      ${s.level==='Gold'?'<p class="faint" style="margin:0;font-size:12px">Gold member: reply within 2 h.</p>':''}</div>
    ${others.length?`<div class="side-card"><h4>Earlier conversations</h4>${others.map(x=>`<button class="linkbtn" style="font-size:12.5px;font-weight:500" data-act="ssel:${x.id}">${esc(x.topic)} · ${fDay(x.createdAt)}</button>`).join('')}</div>`:''}
  </div>`;
  return`<div class="inbox has-sel">${list}${chat}${side}</div>`}

function opsNeed(){const w=activeRunners.concat(USERS.filter(u=>u.isTest&&u.certified)).map(r=>wallet(r.id));return sum(w.map(x=>Math.max(0,x.balance)))+sum(w.map(x=>x.frozen))}
function vFunds(){
  const F=ST.funds,pendW=WITHDRAWALS.filter(w=>w.status==='pending');
  const tabs=`<div class="tabs" role="tablist">${[['flow','Money flow'],['withdraw',`Withdrawals${pendW.length?' ('+pendW.length+')':''}`],['wallets','Runner wallets']].map(([k,l])=>`<button role="tab" aria-selected="${F.tab===k}" data-act="ftab:${k}">${l}</button>`).join('')}</div>`;
  const need=opsNeed(),bal=ST.opsBalance,ok=bal>=need;
  const opsCard=`<div class="ops ${ok?'good':'bad'}"><div><span class="lab">Operations account</span><b class="num">${Y0(bal)}</b></div>
    <div class="ops-msg"><b>${ok?'✓ Enough to pay runners':'! Not enough to pay runners'}</b><span>Runners are owed ${Y0(need)} (wallets plus withdrawals waiting). ${ok?'':'Move '+Y0(need-bal)+' in from the basic account.'}</span></div>
    <label class="field" style="flex:0 0 auto">Balance now (¥)<input type="number" id="ops-bal" min="0" step="0.01" value="${(bal/100).toFixed(2)}" style="width:120px"></label></div>`;
  if(F.tab==='withdraw'){
    const B=rangeBounds(),done=WITHDRAWALS.filter(w=>w.status!=='pending'&&w.at>=B[0]).sort((a,b)=>b.at-a.at);
    const paidW=done.filter(w=>w.status==='paid'),t2p=median(paidW.map(w=>(w.doneAt-w.at)/MIN));
    const oldest=pendW.length?Math.max(...pendW.map(w=>NOW-w.at))/MIN:0;
    return tabs+`<div class="kpis">
      <div class="kpi ${oldest>24*60?'bad':'good'}"><span class="lab">Waiting for review</span><span class="val num">${pendW.length}</span><span class="goal">${pendW.length?(oldest>24*60?'! ':'✓ ')+'Oldest '+fMin(oldest)+' · goal under 24 h':'✓ Nothing waiting'}</span></div>
      <div class="kpi"><span class="lab">Amount waiting</span><span class="val num">${Y0(sum(pendW.map(w=>w.fen)))}</span><span class="d">Frozen in runner wallets</span></div>
      <div class="kpi"><span class="lab">Paid out, ${ST.range==='all'?'all time':rangeBounds()[2]}</span><span class="val num">${Y0(sum(paidW.map(w=>w.fen)))}</span><span class="d">${paidW.length} withdrawals to WeChat balance</span></div>
      <div class="kpi ${t2p==null?'':t2p<=24*60?'good':'bad'}"><span class="lab">Median time to pay</span><span class="val num">${fMin(t2p)}</span><span class="goal">${t2p==null?'':t2p<=24*60?'✓ ':'! '}Goal: within 24 h</span></div>
      </div>${opsCard}
    <section class="panel"><div class="panel-head"><h2>To review</h2><span class="hint">Oldest first. Approving sends the money from the operations account to the runner's WeChat balance.</span></div>
      <div class="tbl-wrap"><table><thead><tr><th>ID</th><th>Runner</th><th class="n">Amount</th><th>Requested</th><th class="n">Waiting</th><th class="n">Wallet after</th><th class="n">Jobs</th><th></th></tr></thead><tbody>${pendW.sort((a,b)=>a.at-b.at).map(w=>{const wl=wallet(w.runner);return`<tr><td class="mono">${w.id}</td><td>${who(w.runner)}</td><td class="n"><b>${Y(w.fen)}</b></td><td>${fDT(w.at)}</td><td class="n ${NOW-w.at>24*HR?'d-bad':''}">${fMin((NOW-w.at)/MIN)}</td><td class="n">${Y(wl.balance)}</td><td class="n">${runnerStats(w.runner).total}</td><td><span class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn small primary" data-act="wpay:${w.id}"${can('refund')?(bal>=w.fen?'':' disabled title="Not enough in the operations account"'):dis('refund')}>Approve and pay</button><button class="btn small" data-act="wrej:${w.id}"${dis('refund')}>Reject</button></span></td></tr>`}).join('')||'<tr><td colspan="8"><div class="empty">No withdrawals waiting.</div></td></tr>'}</tbody></table></div>
      <p class="faint" style="font-size:12px;margin:8px 0 0">Check the amount matches the runner's finished jobs. Rejecting returns the money to their wallet and tells them why.</p></section>
    <div class="section-gap"></div>
    <section class="panel"><div class="panel-head"><h2>History</h2><span class="hint">${done.length}</span></div>
      <div class="tbl-wrap" style="max-height:420px"><table><thead><tr><th>ID</th><th>Runner</th><th class="n">Amount</th><th>Requested</th><th>Result</th><th>Checked by</th></tr></thead><tbody>${done.slice(0,60).map(w=>`<tr><td class="mono">${w.id}</td><td>${who(w.runner)}</td><td class="n">${Y(w.fen)}</td><td>${fDT(w.at)}</td><td>${w.status==='paid'?`<span class="pill good">Paid to WeChat balance</span> <span class="faint">${fDT(w.doneAt)}</span>`:`<span class="pill crit">Rejected</span> <span class="faint">${esc(w.reason||'')}</span>`}</td><td>${esc(w.by||'—')}</td></tr>`).join('')||'<tr><td colspan="6"><div class="empty">None in this period.</div></td></tr>'}</tbody></table></div></section>`}
  if(F.tab==='wallets'){
    const rs=USERS.filter(u=>u.certified&&(ST.showTest||!u.isTest)).map(u=>({u,w:wallet(u.id)})).filter(x=>x.w.earned>0).sort((a,b)=>b.w.balance+b.w.frozen-(a.w.balance+a.w.frozen));
    return tabs+`<div class="kpis">
      <div class="kpi"><span class="lab">In runner wallets</span><span class="val num">${Y0(sum(rs.map(x=>x.w.balance)))}</span><span class="d">Not withdrawn yet</span></div>
      <div class="kpi"><span class="lab">Frozen for withdrawal</span><span class="val num">${Y0(sum(rs.map(x=>x.w.frozen)))}</span><span class="d">Waiting for review</span></div>
      <div class="kpi"><span class="lab">Paid out, all time</span><span class="val num">${Y0(sum(rs.map(x=>x.w.paidOut)))}</span><span class="d">To WeChat balance</span></div>
      </div>${opsCard}
    <div class="tbl-wrap"><table><thead><tr><th>Runner</th><th class="n">Wallet balance</th><th class="n">Frozen</th><th class="n">Earned, all time</th><th class="n">Withdrawn</th><th>Last withdrawal</th><th>Last job</th></tr></thead><tbody>${rs.map(x=>`<tr class="click" data-act="runner:${x.u.id}"><td>${who(x.u.id)}</td><td class="n"><b>${Y(x.w.balance)}</b></td><td class="n">${x.w.frozen?Y(x.w.frozen):'—'}</td><td class="n">${Y(x.w.earned)}</td><td class="n">${Y(x.w.paidOut)}</td><td>${x.w.lastW?fDT(x.w.lastW.doneAt):'—'}</td><td>${runnerStats(x.u.id).last?ago(runnerStats(x.u.id).last):'—'}</td></tr>`).join('')}</tbody></table></div>`}
  const B=rangeBounds(),L=scoped(B);
  const M=L.map(o=>({o,m:money(o)}));
  const paid=sum(M.map(x=>x.m.paid)),released=sum(M.map(x=>x.m.released)),refunded=sum(M.map(x=>x.m.refunded)),subsidy=sum(M.map(x=>x.m.subsidy));
  const heldNow=ORDERS.filter(o=>baseFilter(o)&&LIVE.has(o.status));
  const heldSum=sum(heldNow.map(o=>money(o).held));
  const wxFee=Math.round(paid*.006);
  const wOut=WITHDRAWALS.filter(w=>w.status==='paid'&&w.doneAt>=B[0]);
  const days=[];for(let t=dayStart(Math.max(B[0],Date.parse('2026-10-01T00:00:00+08:00')));t<=TODAY0;t+=DAY){const D=M.filter(x=>x.o.postedAt>=t&&x.o.postedAt<t+DAY);const Wd=WITHDRAWALS.filter(w=>w.status==='paid'&&w.doneAt>=t&&w.doneAt<t+DAY);if(!D.length&&!Wd.length)continue;days.push({t,n:D.length,paid:sum(D.map(x=>x.m.paid)),sub:sum(D.map(x=>x.m.subsidy)),rel:sum(D.map(x=>x.m.released)),ref:sum(D.map(x=>x.m.refunded)),out:sum(Wd.map(w=>w.fen))})}
  const reasons={};L.forEach(o=>o.refunds.forEach(r=>{const k=r.reason.startsWith('Dispute')?'Dispute upheld':r.reason.startsWith('Cancelled by staff')?'Cancelled by staff':r.reason;reasons[k]=(reasons[k]||0)+r.fen}));
  const rl=Object.entries(reasons).sort((a,b)=>b[1]-a[1]),mx=Math.max(1,...rl.map(r=>r[1]));
  const steps=[['Student pays','WeChat Pay, when posting'],['Basic account','Held until confirmed'],['Operations account','Uniearn moves money in'],['Runner wallet','Credited on confirm'],['WeChat balance','After withdrawal review']];
  return tabs+`<div class="flow" aria-label="How money moves">${steps.map(([a,b],i)=>`<div class="fstep"><b>${a}</b><span>${b}</span></div>${i<steps.length-1?'<span class="farrow" aria-hidden="true">→</span>':''}`).join('')}</div>
  <div class="kpis">
    <div class="kpi"><span class="lab">Paid by students</span><span class="val num">${Y0(paid)}</span><span class="d">${L.length} orders · ${ST.range==='all'?'all time':rangeBounds()[2]}</span></div>
    <div class="kpi"><span class="lab">Credited to runner wallets</span><span class="val num">${Y0(released)}</span><span class="d">Full delivery fee on every finished job</span></div>
    <div class="kpi"><span class="lab">Withdrawn to WeChat balance</span><span class="val num">${Y0(sum(wOut.map(w=>w.fen)))}</span><span class="d">${wOut.length} withdrawals</span></div>
    <div class="kpi"><span class="lab">Refunded</span><span class="val num">${Y0(refunded)}</span><span class="d">${pct(refunded,paid)}% of paid</span></div>
    <div class="kpi"><span class="lab">Coupon cost</span><span class="val num">${Y0(subsidy)}</span><span class="d">Paid by Uniearn so runners get the full fee</span></div>
    <div class="kpi"><span class="lab">Held right now</span><span class="val num">${Y0(heldSum)}</span><span class="d">${heldNow.length} orders not confirmed yet</span></div>
    <div class="kpi"><span class="lab">Service fee revenue</span><span class="val num">¥0</span><span class="d">Free during launch (10% later)</span></div>
    <div class="kpi"><span class="lab">WeChat Pay fee (0.6%)</span><span class="val num">${Y0(wxFee)}</span><span class="d">Paid by Uniearn</span></div>
    </div>${opsCard}
  <div class="grid g-73">
    <section class="panel"><div class="panel-head"><h2>Daily totals</h2><span class="hint">Orders by the day they were posted; withdrawals by the day paid</span></div>
      <div class="tbl-wrap" style="max-height:420px"><table><thead><tr><th>Day</th><th class="n">Orders</th><th class="n">Students paid</th><th class="n">Coupon cost</th><th class="n">To wallets</th><th class="n">Refunded</th><th class="n">Withdrawn</th></tr></thead><tbody>${days.reverse().map(d=>`<tr><td>${fDayW(d.t)}</td><td class="n">${d.n}</td><td class="n">${Y(d.paid)}</td><td class="n">${d.sub?Y(d.sub):'—'}</td><td class="n">${Y(d.rel)}</td><td class="n">${d.ref?Y(d.ref):'—'}</td><td class="n">${d.out?Y(d.out):'—'}</td></tr>`).join('')}</tbody></table></div></section>
    <section class="panel"><div class="panel-head"><h2>Refunds by reason</h2></div>
      ${rl.length?`<div class="hbars">${rl.map(([k,v])=>`<div class="hbar"><span>${esc(k)}</span><div class="track"><span style="width:${v/mx*100}%;background:var(--s-cancel)"></span></div><span class="v">${Y(v)}</span></div>`).join('')}</div>`:'<div class="empty">No refunds.</div>'}</section></div>
  <div class="section-gap"></div>
  <section class="panel"><div class="panel-head"><h2>Held right now</h2><span class="hint">Goes to the runner's wallet when confirmed</span></div>
    <div class="tbl-wrap"><table><thead><tr><th>Order</th><th>Status</th><th>Runner</th><th class="n">Held</th><th>Goes to wallet</th></tr></thead><tbody>${heldNow.map(o=>{const auto=o.type==='parcel'?cfg('autoParcel'):cfg('autoTakeaway');return`<tr class="click" data-act="order:${o.id}"><td class="mono">${o.id}${testPill(o.isTest)}</td><td>${pill(o.status)}</td><td>${o.runner?who(o.runner):'<span class="faint">No runner yet</span>'}</td><td class="n">${Y(money(o).held)}</td><td>${o.status==='delivered'?'Auto-confirm '+fDT(o.deliveredAt+auto*HR):o.status==='disputed'?'After a decision':o.status==='posted'?'Refunded if no runner':'After delivery and confirm'}</td></tr>`}).join('')||'<tr><td colspan="5"><div class="empty">Nothing held.</div></td></tr>'}</tbody></table></div></section>`}

/* ================= Coupons ================= */
const couponStatus=c=>c.stopped?'stopped':c.from>NOW?'scheduled':c.to<NOW?'ended':c.claims.length>=c.total&&c.how==='collect'?'gone':'active';
const C_STATUS={active:['Running','good'],scheduled:['Starts later','info'],ended:['Ended','plain'],stopped:['Stopped','crit'],gone:['All collected','warn']};
const cDesc=c=>LANG==='zh'?(c.kind==='amount'?'立减'+Y0(c.off):((100-c.off)/10)+'折'+(c.cap?'，最多减'+Y0(c.cap):''))+(c.min?' · 满'+Y0(c.min)+'可用':' · 无门槛'):(c.kind==='amount'?`${Y0(c.off)} off`:`${c.off}% off${c.cap?', up to '+Y0(c.cap):''}`)+(c.min?` · orders from ${Y0(c.min)}`:' · no minimum');
function levelAt(u,t){
  const since=t-MEMBER.windowMonths*30*DAY,mine=ORDERS.filter(o=>o.customer===u.id&&!o.isTest&&o.postedAt<=t);
  const done=mine.filter(o=>o.status==='confirmed'&&o.confirmedAt<=t),jobs=ORDERS.filter(o=>o.runner===u.id&&!o.isTest&&o.status==='confirmed'&&o.confirmedAt<=t);
  const inW=o=>o.confirmedAt>=since,canc=mine.filter(o=>o.cancelledBy==='student'&&o.cancelledAt<=t).length;
  const pts=done.filter(inW).length*MEMBER.order+jobs.filter(inW).length*MEMBER.job+(done.length&&inW(done[0])?MEMBER.first:0)+(mine.length?MEMBER.details:0)+sum(u.goodwill.filter(g=>g.at<=t&&g.at>=since).map(g=>g.pts));
  return{pts,level:levelFor(pts,mine.length?Math.round(canc/mine.length*100):0)}}
const LV=['Member','Silver','Gold'];
function vRewards(){
  const F=ST.rewards;
  const tabs=`<div class="tabs" role="tablist">${[['membership','Membership'],['coupons','Coupons']].map(([k,l])=>`<button role="tab" aria-selected="${F.tab===k}" data-act="rwtab:${k}">${l}</button>`).join('')}</div>`;
  if(F.tab==='coupons')return tabs+vCoupons();
  const real=USERS.filter(u=>!u.isTest),m0=Date.parse('2026-10-01T00:00:00+08:00');
  const now=new Map(real.map(u=>[u.id,MS.get(u.id).level])),then=new Map(real.map(u=>[u.id,levelAt(u,m0).level]));
  const cnt=(M,l)=>[...M.values()].filter(x=>x===l).length;
  const moved=real.map(u=>({u,a:then.get(u.id),b:now.get(u.id)})).filter(x=>x.a!==x.b);
  const up=moved.filter(x=>LV.indexOf(x.b)>LV.indexOf(x.a)),down=moved.filter(x=>LV.indexOf(x.b)<LV.indexOf(x.a));
  const mc=memberCost(),ok=mc.total<=MEMBER.monthlyCap;
  // points earned this month
  const conf=ORDERS.filter(o=>!o.isTest&&o.status==='confirmed'&&o.confirmedAt>=m0);
  const ptsMonth=conf.length*MEMBER.order+conf.filter(o=>o.runner).length*MEMBER.job;
  // do members order more? orders in last 30 days per member, by level
  const d30=NOW-30*DAY,per=l=>{const us=real.filter(u=>now.get(u.id)===l&&(l!=='Member'||MS.get(u.id).orders>0));const n=sum(us.map(u=>ORDERS.filter(o=>o.customer===u.id&&!o.isTest&&o.postedAt>=d30).length));return{us:us.length,avg:us.length?n/us.length:0}};
  const P={Gold:per('Gold'),Silver:per('Silver'),Member:per('Member')},mx=Math.max(1,...Object.values(P).map(x=>x.avg));
  // weekly trend
  const weeks=[3,2,1,0].map(k=>{const end=k===0?NOW:dayStart(NOW)-k*7*DAY,start=end-7*DAY;const lv=new Map(real.map(u=>[u.id,k===0?now.get(u.id):levelAt(u,end).level]));
    const ords=ORDERS.filter(o=>!o.isTest&&o.postedAt>=start&&o.postedAt<end),byLv=l=>ords.filter(o=>lv.get(o.customer)===l).length;
    return{end,S:cnt(lv,'Silver'),G:cnt(lv,'Gold'),oS:byLv('Silver'),oG:byLv('Gold'),oM:byLv('Member'),cost:Math.round(cnt(lv,'Silver')*MEMBER.silverCoupons*MEMBER.silverCouponOff*MEMBER.useRate/100/4.3+cnt(lv,'Gold')*MEMBER.goldCoupons*MEMBER.goldCouponOff*MEMBER.useRate/100/4.3)}});
  const lvDelta=l=>{const d=cnt(now,l)-cnt(then,l);return d?`<span class="d ${d>0?'d-good':'d-bad'}">${d>0?'▲':'▼'} ${Math.abs(d)} since Oct 1</span>`:'<span class="d">No change since Oct 1</span>'};
  const mover=(x)=>`<tr class="click" data-act="member:${x.u.id}"><td>${who(x.u.id)}</td><td>${levelPill(x.a)} → ${levelPill(x.b)}</td><td class="n">${MS.get(x.u.id).points}</td><td class="n">${MS.get(x.u.id).orders} · ${MS.get(x.u.id).jobs}</td></tr>`;
  return tabs+`<div class="kpis">
    <button class="kpi kpi-link" data-act="kgo:members:silver"><span class="lab">Silver members</span><span class="val num">${cnt(now,'Silver')}</span>${lvDelta('Silver')}</button>
    <button class="kpi kpi-link" data-act="kgo:members:gold"><span class="lab">Gold members</span><span class="val num">${cnt(now,'Gold')}</span>${lvDelta('Gold')}</button>
    <div class="kpi"><span class="lab">Points earned this month</span><span class="val num">${ptsMonth.toLocaleString()}</span><span class="d">From ${conf.length} delivered orders</span></div>
    <div class="kpi ${P.Silver.avg>P.Member.avg?'good':'bad'}"><span class="lab">Silver order more than others</span><span class="val num">${P.Member.avg?(P.Silver.avg/P.Member.avg).toFixed(1):'—'}<small>×</small></span><span class="goal">${P.Silver.avg>P.Member.avg?'✓':'!'} Orders per student, last 30 days</span></div></div>
  <div class="ops ${ok?'good':'bad'}" style="margin-bottom:16px"><div><span class="lab">Member coupons this month</span><b class="num">${Y0(mc.total*100)}</b></div>
    <div class="ops-msg"><b>${ok?'✓ Within the monthly cap':'! Over the monthly cap'} (${Y0(MEMBER.monthlyCap*100)})</b><span>Silver ${mc.nS} × ${MEMBER.silverCoupons} × ¥${MEMBER.silverCouponOff} ≈ ${Y0(mc.cS*100)} · Gold ${mc.nG} × ${MEMBER.goldCoupons} × ¥${MEMBER.goldCouponOff} ≈ ${Y0(mc.cG*100)} · assumes ${MEMBER.useRate}% are used.${ok?'':' Halve the coupon value or the number of coupons.'}</span></div>
    <label class="field" style="flex:0 0 auto">Assumed use rate (%)<input type="number" min="0" max="100" step="5" id="mem-useRate" value="${MEMBER.useRate}"${can('config')?'':' disabled'} style="width:90px"><span class="faint" style="font-size:11.5px">${realUseRate()==null?'No coupon data yet':'Real so far: '+realUseRate()+'%'}</span></label>
    <button class="btn small" data-act="rwtab:coupons">See all coupons</button></div>
  <div class="grid g2">
    <section class="panel"><div class="panel-head"><h2>Do members order more?</h2><span class="hint">Orders per student, last 30 days</span></div>
      <div class="hbars">${[['Gold','Gold'],['Silver','Silver'],['Member','Member, ordered at least once']].map(([k,l])=>`<div class="hbar"><span>${levelPill(k)}<br><small class="faint">${P[k].us} students</small></span><div class="track"><span style="width:${P[k].avg/mx*100}%;background:${k==='Member'?'var(--line-strong)':'var(--brand)'}"></span></div><span class="v">${P[k].avg.toFixed(1)}</span></div>`).join('')}</div>
      <p class="faint" style="font-size:12px;margin:10px 0 0">If Silver and Gold don't order clearly more than other students, the perks aren't changing behaviour. Then cut the coupons and keep the free perks.</p></section>
    <section class="panel"><div class="panel-head"><h2>Last 4 weeks</h2><span class="hint">Levels at the end of each week</span></div>
      <div class="tbl-wrap" style="border:0"><table><thead><tr><th>Week ending</th><th class="n">Silver</th><th class="n">Gold</th><th class="n">Silver + Gold orders</th><th class="n">Others</th><th class="n">Coupon cost</th></tr></thead>
      <tbody>${weeks.map(w=>`<tr><td>${fDay(w.end)}</td><td class="n">${w.S}</td><td class="n">${w.G}</td><td class="n">${w.oS+w.oG}</td><td class="n">${w.oM}</td><td class="n">${Y0(w.cost*100)}</td></tr>`).join('')}</tbody></table></div>
      <p class="faint" style="font-size:12px;margin:8px 0 0">Coupon cost is the weekly share of the monthly estimate. Sample data covers October only.</p></section></div>
  <div class="section-gap"></div>
  <section class="panel"><div class="panel-head"><h2>Moved this month</h2><span class="hint">Since Oct 1 · checked again on the 1st</span></div>
    <div class="grid g2" style="gap:16px">
      <div><h3 class="mh">Moved up (${up.length})</h3>${up.length?`<div class="tbl-wrap" style="max-height:280px"><table><thead><tr><th>Member</th><th>Level</th><th class="n">Points</th><th class="n">Orders · jobs</th></tr></thead><tbody>${up.map(mover).join('')}</tbody></table></div>`:'<p class="muted" style="margin:0">Nobody yet.</p>'}
        ${up.some(x=>x.b==='Gold')&&MEMBER.goldGift?`<p class="faint" style="font-size:12px;margin:8px 0 0">New Gold members get the plush keychain. Hand it out in person or post it to their dorm.</p>`:''}</div>
      <div><h3 class="mh">Moved down (${down.length})</h3>${down.length?`<div class="tbl-wrap" style="max-height:280px"><table><thead><tr><th>Member</th><th>Level</th><th class="n">Points</th><th class="n">Orders · jobs</th></tr></thead><tbody>${down.map(mover).join('')}</tbody></table></div>`:`<p class="muted" style="margin:0">${MEMBER.winterFreeze&&[0,1].includes(cn(NOW).getUTCMonth())?'Nobody. In January and February nobody drops a level.':'Nobody.'}</p>`}</div></div></section>
  <div class="section-gap"></div>
  ${membershipRules()}`}
function vCoupons(){
  const used=c=>c.claims.filter(x=>x.order),sub=c=>sum(used(c).map(x=>OMAP[x.order].coupon.fen));
  const run=COUPONS.filter(c=>couponStatus(c)==='active');
  const allClaims=sum(COUPONS.map(c=>c.claims.length)),allUsed=sum(COUPONS.map(c=>used(c).length)),rate=pct(allUsed,allClaims);
  const B=rangeBounds(),L=scoped(B),withC=L.filter(o=>o.coupon&&o.status==='confirmed'),fin=L.filter(o=>o.status==='confirmed');
  return`<div class="kpis">
    <div class="kpi"><span class="lab">Running now</span><span class="val num">${run.length}</span><span class="d">${COUPONS.filter(c=>couponStatus(c)==='scheduled').length} starting later</span></div>
    <div class="kpi"><span class="lab">Collected or sent</span><span class="val num">${allClaims}</span><span class="d">All coupons, all time</span></div>
    <div class="kpi ${rate>=goal('couponUse')?'good':'bad'}"><span class="lab">Use rate</span><span class="val num">${rate}<small>%</small></span><span class="goal">${rate>=goal('couponUse')?'✓':'!'} ${allUsed} of ${allClaims} · goal ${goal('couponUse')}%</span></div>
    <div class="kpi"><span class="lab">Orders with a coupon</span><span class="val num">${pct(withC.length,fin.length)}<small>%</small></span><span class="d">${withC.length} of ${fin.length} finished, ${ST.range==='all'?'all time':rangeBounds()[2]}</span></div>
    <div class="kpi"><span class="lab">Coupon cost</span><span class="val num">${Y0(sum(withC.map(o=>o.coupon.fen)))}</span><span class="d">Paid by Uniearn, ${ST.range==='all'?'all time':rangeBounds()[2]}</span></div></div>
  <div class="box note" style="margin-bottom:16px"><span><b style="color:var(--fg)">Runners always get the full delivery fee.</b> The student pays less; Uniearn pays the difference, shown as coupon cost in Funds. Students collect coupons in the app's coupon centre, or staff send them to chosen members.</span></div>
  <section class="panel"><div class="panel-head"><h2>Coupons</h2><span class="right"><button class="btn primary small" data-act="newCoupon"${dis('news')}>New coupon</button></span></div>
    <div class="tbl-wrap"><table><thead><tr><th>Coupon</th><th>Discount</th><th>Valid dates</th><th>Status</th><th class="n">Collected</th><th class="n">Used</th><th class="n">Use rate</th><th class="n">Cost to Uniearn</th></tr></thead>
    <tbody>${COUPONS.slice().sort((a,b)=>b.from-a.from).map(c=>{const st=couponStatus(c),u=used(c).length,r=pct(u,c.claims.length);return`<tr class="click" data-act="coupon:${c.id}"><td><b style="font-weight:600" translate="no">${esc(cName(c))}</b><br><small class="faint">${c.types.length===4?'All order types':c.types.map(t=>TYPES[t]).join(', ')}${c.firstOnly?' · first order only':''} · ${c.how==='collect'?'collect in the app':'sent by staff'}</small></td><td class="wt" style="min-width:140px">${cDesc(c)}</td><td>${fDay(c.from)} – ${fDay(c.to)}</td><td><span class="pill ${C_STATUS[st][1]}">${C_STATUS[st][0]}</span></td><td class="n">${c.claims.length} <span class="faint">/ ${c.total}</span></td><td class="n">${u}</td><td class="n ${c.claims.length?(r>=goal('couponUse')?'d-good':'d-bad'):''}">${c.claims.length?r+'%':'—'}</td><td class="n">${Y(sub(c))}</td></tr>`}).join('')}</tbody></table></div></section>`}
function dCoupon(c){
  const st=couponStatus(c),U=c.claims.filter(x=>x.order).map(x=>OMAP[x.order]).sort((a,b)=>b.postedAt-a.postedAt),cost=sum(U.map(o=>o.coupon.fen));
  const segOpts=SEGMENTS.map(([k,l])=>`<option value="${k}">${l}</option>`).join('');
  return`<div class="drawer-head"><div><h3 translate="no">${esc(cName(c))}</h3><p>${cDesc(c)} · ${c.how==='collect'?'collect in the app':'sent by staff'} · created by ${esc(c.createdBy)}</p></div><button class="x" data-act="close" aria-label="Close">${IC.x}</button></div>
  <div class="drawer-body">
    <div class="row"><span class="pill ${C_STATUS[st][1]}">${C_STATUS[st][0]}</span><span class="tag">${fDT(c.from)} – ${fDT(c.to)}</span></div>
    <div class="stats">${[['Quantity',c.total],['Collected',c.claims.length],['Used',U.length],['Use rate',c.claims.length?pct(U.length,c.claims.length)+'%':'—'],['Cost to Uniearn',Y(cost)]].map(([l,v])=>`<div class="stat"><span>${l}</span><b>${v}</b></div>`).join('')}</div>
    <dl class="dl"><dt>Order types</dt><dd>${c.types.map(t=>TYPES[t]).join(', ')}</dd><dt>Minimum fee</dt><dd>${c.min?Y(c.min):'No minimum'}</dd><dt>Per student</dt><dd>1 coupon${c.firstOnly?' · first order only':''}</dd><dt>Who pays</dt><dd>Uniearn. The runner still gets the full delivery fee.</dd></dl>
    ${st==='active'||st==='scheduled'?`<div class="sec"><h4>Send to members</h4><div class="row"><select id="cp-seg" style="flex:1">${segOpts}</select><button class="btn small" data-act="sendCoupon:${c.id}"${dis('news')}>Send</button></div>
      <label class="field" style="margin-top:8px">Or member IDs (up to 100, separated by commas or spaces)<textarea id="cp-ids" rows="2" placeholder="U10146, U10318"></textarea></label>
      <p class="faint" style="font-size:12px;margin:6px 0 0">Members who already have this coupon are skipped. Never ask students to share or invite friends to get a coupon.</p></div>`:''}
    <div class="sec"><h4>Orders that used it (${U.length})</h4>${U.length?`<div class="tbl-wrap"><table><tbody>${U.slice(0,40).map(o=>`<tr class="click" data-act="order:${o.id}"><td class="mono">${o.id}</td><td>${fDT(o.postedAt)}</td><td>${who(o.customer)}</td><td class="n">${Y(o.fee)} <span class="faint">−${Y(o.coupon.fen)}</span></td></tr>`).join('')}</tbody></table></div>`:'<p class="muted" style="margin:0">Not used yet.</p>'}</div>
    ${st==='active'||st==='scheduled'?`<button class="btn danger small" style="align-self:flex-start" data-act="stopCoupon:${c.id}"${dis('news')}>Stop this coupon</button><p class="faint" style="font-size:12px;margin:-10px 0 0">Collected coupons can't be used after you stop it.</p>`:''}
  </div>`}
const NC_TPL=[
  {k:'newbie',zh:'新人首单立减2元',en:'New member · ¥2 off first order',f:{kind:'amount',off:'2',min:'0',firstOnly:true,how:'collect',total:'300',days:30,types:TYPE_KEYS.slice()}},
  {k:'lunch',zh:'午餐满4减1元',en:'Lunch · ¥1 off orders from ¥4',f:{kind:'amount',off:'1',min:'4',how:'collect',total:'200',days:7,types:['takeaway']}},
  {k:'half',zh:'5折券，最多减10元',en:'50% off, up to ¥10',f:{kind:'percent',off:'50',cap:'10',min:'0',how:'send',sendBy:'group',seg:'repeat',days:14,types:TYPE_KEYS.slice()}},
  {k:'back',zh:'回归用户立减2元',en:'Come back · ¥2 off',f:{kind:'amount',off:'2',min:'0',how:'send',sendBy:'group',seg:'risk',days:7,types:TYPE_KEYS.slice()}}];
const ncDay=ms=>{const d=cn(ms);return d.getUTCFullYear()+'-'+p2(d.getUTCMonth()+1)+'-'+p2(d.getUTCDate())};
function ncDefaults(){return{kind:'amount',off:'2',cap:'',min:'0',firstOnly:false,types:TYPE_KEYS.slice(),how:'collect',total:'100',from:ncDay(NOW),to:ncDay(NOW+6*DAY),days:7,name:'',nameEn:'',sendBy:'group',seg:'active',area:'all',picked:[],q:''}}
function ncAuto(f){const off=+f.off||0;
  if(f.kind==='percent'){const z=(100-off)/10;return{zh:(f.firstOnly?'首单':'')+(Number.isInteger(z)?z:z.toFixed(1))+'折券'+(f.min>0?'（满'+f.min+'元）':''),en:(f.firstOnly?'First order: ':'')+off+'% off'+(+f.cap?', up to ¥'+f.cap:'')}}
  return{zh:(f.firstOnly?'新人首单':'')+(+f.min>0?'满'+f.min+'减'+off+'元':'立减'+off+'元'),en:(f.firstOnly?'New member: ':'')+'¥'+off+' off'+(+f.min>0?' orders from ¥'+f.min:'')}}
function ncRecipients(f){
  if(f.sendBy==='pick')return f.picked.map(id=>UMAP[id]).filter(Boolean);
  const sf=SEGMENTS.find(x=>x[0]===f.seg)[2];return USERS.filter(u=>!u.isTest&&(f.area==='all'||u.area===f.area)&&sf(u,MS.get(u.id)))}
function ncCoupon(f){const off=+f.off||0;return{kind:f.kind,off:f.kind==='amount'?Math.round(off*100):Math.round(off),cap:f.kind==='percent'?Math.round((+f.cap||0)*100):null,min:Math.round((+f.min||0)*100)}}
function dNewCoupon(){
  const f=drawer.form=drawer.form||ncDefaults();
  const auto=ncAuto(f),nm=LANG==='zh'?(f.name||auto.zh):(f.nameEn||auto.en);
  const rec=f.how==='send'?ncRecipients(f):[],qty=f.how==='send'?rec.length:Math.max(0,Math.round(+f.total||0));
  const cc=ncCoupon(f),per=cc.kind==='amount'?cc.off:(cc.cap||0),maxCost=per*qty;
  const chip=(act,on,label,tip)=>`<button type="button" class="chip" aria-pressed="${on}" data-act="${act}"${tip?` data-tip="${esc(tip)}"`:''}>${label}</button>`;
  const segRows=SEGMENTS.filter(x=>!['all'].includes(x[0])).map(([k,l])=>{const n=USERS.filter(u=>!u.isTest&&(f.area==='all'||u.area===f.area)&&SEGMENTS.find(x=>x[0]===k)[2](u,MS.get(u.id))).length;return chip('ncSeg:'+k,f.sendBy==='group'&&f.seg===k,`${l} <b>${n.toLocaleString()}</b>`,segHelp(k))}).join('');
  const found=f.q.trim()?USERS.filter(u=>!u.isTest&&!f.picked.includes(u.id)&&(u.nick.toLowerCase().includes(f.q.toLowerCase())||u.id.toLowerCase().includes(f.q.toLowerCase()))).slice(0,6):[];
  const picker=f.how!=='send'?'':`<div class="nc-who">
      <div class="seg" role="group" aria-label="Choose recipients by"><button type="button" aria-pressed="${f.sendBy==='group'}" data-act="ncBy:group">A group of members</button><button type="button" aria-pressed="${f.sendBy==='pick'}" data-act="ncBy:pick">Pick members</button></div>
      ${f.sendBy==='group'?`<div class="chips" style="margin:0">${segRows}</div>
        <label class="field" style="max-width:240px">Dorm area<select id="nc-area"><option value="all">All dorm areas</option>${AREAS.map(a=>`<option value="${a.id}"${f.area===a.id?' selected':''}>${areaL(a)}</option>`).join('')}</select></label>`
      :`<input type="search" id="nc-q" placeholder="Search name or member ID" value="${esc(f.q)}" aria-label="Search members to add">
        ${found.length?`<div class="nc-found">${found.map(u=>`<button type="button" class="live-row" data-act="ncAdd:${u.id}"><span class="tt"><span translate="no">${esc(u.nick)}</span><small>${u.id} · ${esc(BLD[u.bld].name)}</small></span><span class="linkbtn">+ Add</span></button>`).join('')}</div>`:(f.q.trim()?'<p class="faint" style="margin:0;font-size:12.5px">No one found.</p>':'')}
        <label class="field">Or paste member IDs (separated by commas or spaces)<textarea id="nc-ids" rows="2" placeholder="U10146, U10318"></textarea></label>
        ${f.picked.length?`<div class="row" style="gap:6px">${f.picked.map(id=>`<span class="tag" style="display:inline-flex;gap:6px;align-items:center;margin:0"><span translate="no">${esc(UMAP[id].nick)}</span> <button type="button" class="linkbtn" data-act="ncDel:${id}" aria-label="Remove">×</button></span>`).join('')}</div>`:''}`}
      <div class="nc-count ${rec.length?'':'empty'}"><b>Sends to ${rec.length.toLocaleString()} member${rec.length===1?'':'s'}</b><span>${rec.filter(u=>u.consent).length} of them get a WeChat notice; everyone sees it in their coupon list.</span></div>
    </div>`;
  const preview=`<div class="nc-preview" aria-label="What students see"><div class="cp-l"><b>${f.kind==='amount'?'¥'+(+f.off||0):(LANG==='zh'?((100-(+f.off||0))/10)+'折':(+f.off||0)+'% off')}</b><span>${+f.min>0?(LANG==='zh'?'满'+f.min+'元可用':'orders from ¥'+f.min):(LANG==='zh'?'无门槛':'no minimum')}</span></div><div class="cp-r"><b translate="no">${esc(nm)}</b><span>${f.types.length===4?'All order types':f.types.map(t=>TYPES[t]).join(', ')}${f.firstOnly?' · first order only':''}</span><span>${fDay(Date.parse(f.from+'T00:00:00+08:00'))} – ${fDay(Date.parse(f.to+'T00:00:00+08:00'))}</span></div></div>`;
  return`<div class="drawer-head"><div><h3>New coupon</h3><p>Pick a template or fill in the four steps. Names are filled in for you.</p></div><button class="x" data-act="close" aria-label="Close">${IC.x}</button></div>
  <div class="drawer-body"><form id="nc-form" style="display:flex;flex-direction:column;gap:18px" novalidate onsubmit="return false">
    <div class="sec"><h4>Start from a template</h4><div class="chips" style="margin:0">${NC_TPL.map(t=>chip('ncTpl:'+t.k,f.tpl===t.k,LANG==='zh'?t.zh:t.en)).join('')}</div></div>
    <div class="sec"><h4>1 · Discount</h4>
      <div class="row" style="align-items:flex-end">
        <div class="seg" role="group" aria-label="Discount type"><button type="button" aria-pressed="${f.kind==='amount'}" data-act="ncKind:amount">Amount off</button><button type="button" aria-pressed="${f.kind==='percent'}" data-act="ncKind:percent">Percent off</button></div>
        <label class="field" style="width:110px">${f.kind==='percent'?'Percent off (%)':'Amount off (¥)'}<input type="number" id="nc-off" min="0.1" step="${f.kind==='percent'?5:0.5}" value="${esc(f.off)}"></label>
        ${f.kind==='percent'?`<label class="field" style="width:120px">Most off (¥)<input type="number" id="nc-cap" min="0.5" step="0.5" value="${esc(f.cap)}"></label>`:''}</div>
      <div class="field" style="margin-top:10px">Minimum delivery fee<div class="row" style="gap:6px">${['0','3','4','5'].map(v=>chip('ncMin:'+v,String(+f.min)===v,v==='0'?'No minimum':'From ¥'+v)).join('')}<input type="number" id="nc-min" min="0" step="0.5" value="${esc(f.min)}" style="width:80px" aria-label="Minimum delivery fee"></div></div>
      <label class="chk" style="margin-top:8px"><input type="checkbox" id="nc-first"${f.firstOnly?' checked':''}> First order only</label></div>
    <div class="sec"><h4>2 · Order types</h4><div class="row" style="gap:6px">${TYPE_KEYS.map(k=>chip('ncType:'+k,f.types.includes(k),TYPES[k])).join('')}</div></div>
    <div class="sec"><h4>3 · Who gets it</h4>
      <div class="nc-how">
        <button type="button" class="nc-opt" aria-pressed="${f.how==='collect'}" data-act="ncHow:collect"><b>Students collect it</b><span>Shows in the app's coupon centre until it runs out.</span></button>
        <button type="button" class="nc-opt" aria-pressed="${f.how==='send'}" data-act="ncHow:send"><b>Send to chosen members</b><span>Goes straight into their coupon list.</span></button></div>
      ${f.how==='collect'?`<label class="field" style="max-width:200px;margin-top:10px">How many coupons<input type="number" id="nc-total" min="1" step="10" value="${esc(f.total)}"></label>`:picker}</div>
    <div class="sec"><h4>4 · Valid for</h4><div class="row" style="gap:6px">${[3,7,14,30].map(d=>chip('ncDays:'+d,f.days===d,d+' days')).join('')}</div>
      <div class="row" style="margin-top:8px"><label class="field" style="flex:1 1 140px">Starts<input type="date" id="nc-from" value="${f.from}"></label><label class="field" style="flex:1 1 140px">Ends<input type="date" id="nc-to" value="${f.to}"></label></div></div>
    <div class="sec"><h4>Preview · what students see</h4>${preview}
      <p class="faint" style="font-size:12px;margin:8px 0 0">${qty?`${qty.toLocaleString()} coupon${qty===1?'':'s'} · if all are used, Uniearn pays up to ${Y0(maxCost)}. Runners always get the full delivery fee.`:'Choose who gets it to see the cost.'}</p>
      <details class="nums" style="margin-top:6px"${f.name||f.nameEn?' open':''}><summary>Edit names</summary><div class="row" style="margin-top:8px"><label class="field" style="flex:1 1 180px">Name in Chinese (students see it in the Chinese app)<input type="text" id="nc-name" maxlength="20" lang="zh-CN" value="${esc(f.name)}" placeholder="${LANG==='zh'?esc(auto.zh):'Filled in for you'}"></label><label class="field" style="flex:1 1 180px">Name in English<input type="text" id="nc-name-en" maxlength="40" value="${esc(f.nameEn)}" placeholder="${esc(auto.en)}"></label></div></details></div>
    <div class="row"><button class="btn primary" type="button" data-act="createCoupon"${dis('news')}>${f.how==='send'?`Create and send to ${rec.length.toLocaleString()}`:'Create coupon'}</button><button class="btn" type="button" data-act="close">Cancel</button></div>
  </form></div>`}

const newsTpl=()=>LANG==='zh'?['南门取件点已开放，下单时可以选择“南门”。','中午12点单量大，11:45前下单更容易被接哦～','翰林驿站有快递？下个单，顺路的跑腿员帮你送上楼。','好久没下单啦？你保存的宿舍地址还在，随时可以下单。']:['South gate pickups are open. Choose South gate when you post.','Lunch gets busy at 12:00. Post by 11:45 to get a runner faster.','Parcel at Hanlin station? Post it and a runner going your way brings it up.','Haven\'t ordered in a while? Your saved dorm route is still there.'];
let NEWS={seg:'active',area:'all',text:''};
function newsReach(){const segF=SEGMENTS.find(s=>s[0]===NEWS.seg)[2];
  const inSeg=USERS.filter(u=>!u.isTest&&(NEWS.area==='all'||u.area===NEWS.area)&&segF(u,MS.get(u.id)));
  const opted=inSeg.filter(u=>u.consent);const fresh=opted.filter(u=>!u.lastNews||NOW-u.lastNews>=7*DAY);return{inSeg,opted,fresh}}
function vMessages(){
  const r=newsReach();
  const tpl=newsTpl();
  return`<div class="grid g-73"><section class="panel"><div class="panel-head"><h2>New message</h2><span class="hint">Sent as a WeChat subscription message</span></div>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div class="row"><label class="field" style="flex:1 1 160px">Segment<select id="n-seg">${SEGMENTS.map(([k,l])=>`<option value="${k}"${NEWS.seg===k?' selected':''}>${l}</option>`).join('')}</select></label>
        <label class="field" style="flex:1 1 160px">Dorm area<select id="n-area"><option value="all">All areas</option>${AREAS.map(a=>`<option value="${a.id}"${NEWS.area===a.id?' selected':''}>${a.en}</option>`).join('')}</select></label></div>
      <label class="field">Message <span class="faint">${NEWS.text.length}/120</span><textarea id="n-text" rows="3" maxlength="120" placeholder="Short and useful. No rewards for sharing or inviting.">${esc(NEWS.text)}</textarea></label>
      <div class="row">${tpl.map((t,i)=>`<button class="btn small" data-act="tpl:${i}">${esc(t.slice(0,28))}…</button>`).join('')}</div>
      <div class="box"><div class="row" style="justify-content:space-between"><span class="muted">${r.inSeg.length.toLocaleString()} in segment → ${r.opted.length} opted in → ${r.opted.length-r.fresh.length} already messaged this week</span><b class="num">Sends to ${r.fresh.length}</b></div></div>
      <div class="row"><button class="btn primary" data-act="sendNews"${!can('news')?dis('news'):(!NEWS.text.trim()||!r.fresh.length?' disabled':'')}>Send to ${r.fresh.length}</button><span class="faint" style="font-size:12px">At most one news message per member a week.</span></div>
    </div></section>
    <section class="panel"><div class="panel-head"><h2>Rules for news</h2></div><ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px;color:var(--muted)">
      <li>Only members who turned on "News from Uniearn" (off by default).</li><li>At most 1 a week per member.</li><li>Order updates are never used for marketing.</li><li>No rewards for inviting or sharing (WeChat bans them).</li><li>Coupons are paid by Uniearn; runners always get the full delivery fee.</li></ul></section></div>
  <div class="section-gap"></div>
  <section class="panel"><div class="panel-head"><h2>Sent</h2></div><div class="tbl-wrap"><table><thead><tr><th>Sent</th><th>Segment</th><th>Area</th><th>Message</th><th class="n">Delivered to</th><th>By</th></tr></thead><tbody>${ST.newsLog.map(n=>`<tr><td>${fDT(n.at)}</td><td>${n.seg}</td><td>${n.area==='all'?'All':AREA[n.area].en}</td><td class="wt" translate="no">${esc(n.text)}</td><td class="n">${n.sent}</td><td>${n.by}</td></tr>`).join('')}</tbody></table></div></section>`}

function realUseRate(){const c=COUPONS.reduce((a,x)=>a+x.claims.length,0),u=COUPONS.reduce((a,x)=>a+x.claims.filter(y=>y.order).length,0);return c?Math.round(u/c*100):null}
function memberCost(){const real=USERS.filter(u=>!u.isTest),nS=real.filter(u=>MS.get(u.id).level==='Silver').length,nG=real.filter(u=>MS.get(u.id).level==='Gold').length;
  const ur=MEMBER.useRate/100,cS=Math.round(nS*MEMBER.silverCoupons*MEMBER.silverCouponOff*ur),cG=Math.round(nG*MEMBER.goldCoupons*MEMBER.goldCouponOff*ur);return{nS,nG,cS,cG,total:cS+cG}}
function membershipRules(){
  const ed=can('config'),real=USERS.filter(u=>!u.isTest),cnt=l=>real.filter(u=>MS.get(u.id).level===l).length;
  const row=(k,label,help,unit,step=1)=>`<div class="cfg"><div class="l"><b>${label}</b>${help?`<span>${help}</span>`:''}</div><div class="in"><input type="number" min="0" step="${step}" id="mem-${k}" value="${MEMBER[k]}"${ed?'':' disabled'} aria-label="${label}"><span class="muted">${unit}</span></div></div>`;
  const sw=(k,label,help)=>`<div class="cfg"><div class="l"><b>${label}</b>${help?`<span>${help}</span>`:''}</div><div class="in"><label class="switch"><input type="checkbox" id="mem-${k}"${MEMBER[k]?' checked':''}${ed?'':' disabled'} aria-label="${label}"></label></div></div>`;
  const changed=Object.keys(MEMBER).some(k=>MEMBER[k]!==MEMBER_DEF[k]);
  const mc=memberCost(),ok=mc.total<=MEMBER.monthlyCap;
  return`<section class="panel" id="membership"><div class="panel-head"><h2>Membership rules</h2><span class="hint">Free for everyone. Points have no cash value and never change pay or runner level.</span>${ed&&changed?'<span class="right"><button class="btn small" data-act="memReset">Back to the agreed rules</button></span>':''}</div>
    ${ed?'':'<div class="box note" style="margin-bottom:12px">Only Admins can change membership rules. You can see them here.</div>'}
    <div class="grid g3" style="gap:20px">
      <div><h3 class="mh">Earning points</h3>
        ${row('order','Order delivered','Student, after they confirm','points')}
        ${row('job','Job delivered','Runner, after the student confirms','points')}
        ${row('first','First order bonus','Once per member','points')}
        ${row('details','Delivery details added','Once per member','points')}
        <h3 class="mh" style="margin-top:14px">Limits</h3>
        ${row('pairWeek','Same two students','Orders between them count at most this many times a week','times')}
        ${row('goodwill','Goodwill points','Most staff can give one member in a month','points')}
        ${row('expiryMonths','Points expire after','','months')}
        <h3 class="mh" style="margin-top:14px">Never earns points</h3>
        <ul class="mlist"><li>Cancelled, refunded or reported orders</li><li>Inviting or sharing (WeChat bans rewards for this)</li><li>Fake or self orders: points removed, account may be frozen</li></ul></div>
      <div><h3 class="mh">Levels</h3>
        <div class="tbl-wrap" style="border:0"><table><thead><tr><th>Level</th><th class="n">Points needed</th><th class="n">Members now</th></tr></thead><tbody>
          <tr><td>${levelPill('Member')}</td><td class="n">0</td><td class="n">${cnt('Member').toLocaleString()}</td></tr>
          <tr><td>${levelPill('Silver')}</td><td class="n"><input type="number" min="1" id="mem-silver" value="${MEMBER.silver}"${ed?'':' disabled'} aria-label="Silver points" style="width:80px;text-align:right"></td><td class="n">${cnt('Silver')}</td></tr>
          <tr><td>${levelPill('Gold')}</td><td class="n"><input type="number" min="2" id="mem-gold" value="${MEMBER.gold}"${ed?'':' disabled'} aria-label="Gold points" style="width:80px;text-align:right"></td><td class="n">${cnt('Gold')}</td></tr></tbody></table></div>
        ${row('goldMaxCancel','Gold: cancel rate at most','Gold is for good customers, not only heavy ones','%')}
        ${row('windowMonths','Points counted over','Rolling window; levels are checked on the 1st of each month','months')}
        ${sw('dropOne','Drop at most one level a month','A Gold member who stops ordering goes to Silver first, not straight to Member.')}
        ${sw('winterFreeze','No level drops in winter school','January and February, when most students are away.')}</div>
      <div><h3 class="mh">Perks during the launch</h3>
        ${row('silverCoupons','Silver: coupons a month','Paid by Uniearn; the runner still gets the full fee','coupons')}
        ${row('silverCouponOff','Silver: each coupon','','¥ off',0.5)}
        ${row('goldCoupons','Gold: coupons a month','','coupons')}
        ${row('goldCouponOff','Gold: each coupon','','¥ off',0.5)}
        ${row('couponMinFee','Member coupons work on orders from','Stops members posting ¥3 orders nobody takes','¥',0.5)}
        ${row('swapLaunchPts','Swap points for a ¥1 coupon','Any member','points')}
        ${sw('goldGift','Gold welcome gift','A plush keychain from the launch merch, once')}
        ${row('monthlyCap','Monthly cap for member coupons','Turns red above this','¥')}
        <p class="faint" style="font-size:12px;margin:6px 0 0">Silver and Gold also get a badge and early access to new services (\"Post any task\" in Phase 2). Gold gets help within ${MEMBER.goldHelpH} h and an invite to the student feedback group.</p>
        <h3 class="mh" style="margin-top:14px">Perks after the service fee starts</h3>
        ${row('silverFree','Silver: free service fee','Orders a month; replaces the coupons','orders')}
        ${row('goldFree','Gold: free service fee','Orders a month; replaces the coupons','orders')}
        ${row('goldHelpH','Gold: priority help','Support replies within','h')}
        ${row('swapPts','Swap points for a free service fee','Any member, one order','points')}</div></div>
    <p class="faint" style="font-size:12px;margin:12px 0 0">Changes that affect members are announced in the app 14 days before they start. Every change is saved in Rule changes.</p></section>`}
function vConfig(){
  const ed=can('config');
  const qrDays=(ST.qr.uploadedAt+7*DAY-NOW)/DAY;
  return`${ed?'':'<div class="box note" style="margin-bottom:16px">Only Admins can change rules. You can see them here.</div>'}
  <div class="grid g2">
  ${(()=>{const RF=ST.ruleF||'all',C=ST.config,nOn=C.filter(c=>c.on).length;
    const fl=[['all','All',C.length],['on','On',nOn],['off','Off',C.length-nOn],...Object.entries(PHASES).map(([k,l])=>[k,l,C.filter(c=>c.ph===k).length]).filter(x=>x[2])];
    const L=C.filter(c=>RF==='all'||(RF==='on'?c.on:RF==='off'?!c.on:c.ph===RF));
    return`<section class="panel"><div class="panel-head"><h2>Order rules</h2><span class="hint">Turn a rule off to try a phase without it. Off rules are kept, not deleted.</span></div>
    <div class="chips" role="group" aria-label="Show rules" style="margin-bottom:4px">${fl.map(([k,l,n])=>`<button class="chip" aria-pressed="${RF===k}" data-act="ruleF:${k}">${l} <b>${n}</b></button>`).join('')}</div>
    ${L.map(c=>`<div class="cfg rule${c.on?'':' off'}"><div class="l"><div class="rule-h"><b>${c.label}</b><select id="cfgph-${c.k}" aria-label="Phase for ${esc(c.label)}"${ed?'':' disabled'} class="ph-sel ph-${c.ph}">${Object.entries(PHASES).map(([k,l])=>`<option value="${k}"${c.ph===k?' selected':''}>${l}</option>`).join('')}</select>${c.on?'':'<span class="pill plain">Off</span>'}</div><span>${esc(c.help)}</span>${c.open?`<br><span class="open">Open: ${esc(c.open)}</span>`:''}</div>
      <div class="in">${c.v!=null?`<input type="number" min="0" id="cfg-${c.k}" value="${c.v}"${ed&&c.on?'':' disabled'} aria-label="${esc(c.label)}"><span class="muted">${c.unit}</span>`:''}
      <label class="switch"><input type="checkbox" id="cfgon-${c.k}"${c.on?' checked':''}${ed?'':' disabled'} aria-label="${esc(c.label)} on"></label></div></div>`).join('')||'<div class="empty">No rules here.</div>'}
  </section>`})()}
  <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
  <section class="panel"><div class="panel-head"><h2>Goals</h2><span class="hint">Numbers turn green when they meet the goal, red when they don't</span></div>
    ${ST.goals.map(g=>`<div class="cfg"><div class="l"><b>${g.label}</b><span>${g.dir==='min'?'Green at or above':'Green at or below'}</span></div><div class="in"><input type="number" min="0" step="${g.k==='perTrip'?0.1:1}" id="goal-${g.k}" value="${g.v}"${ed?'':' disabled'} aria-label="${g.label} goal"><span class="muted">${g.unit||'×'}</span></div></div>`).join('')}</section>
  <section class="panel" id="qr"><div class="panel-head"><h2>Official group QR</h2>${qrDays<0?'<span class="pill crit">Expired</span>':qrDays<2?'<span class="pill warn">Expires soon</span>':'<span class="pill good">Valid</span>'}</div>
    <div class="row" style="align-items:flex-start;gap:14px">${ST.qr.img?`<img src="${ST.qr.img}" alt="Group QR code" style="width:110px;height:110px;object-fit:cover;border-radius:8px;border:1px solid var(--line)">`:'<div class="ph" style="width:110px;aspect-ratio:1">No current code</div>'}
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:8px"><span class="muted">Uploaded ${fDT(ST.qr.uploadedAt)} · ${qrDays<0?'expired '+fDay(ST.qr.uploadedAt+7*DAY):'expires '+fDT(ST.qr.uploadedAt+7*DAY)}</span>
    <span class="faint" style="font-size:12px">WeChat group codes last 7 days. Upload a fresh one every week; the app shows it on "Join our group".</span>
    <label class="btn small" style="align-self:flex-start"${ed?'':' aria-disabled="true"'}>Upload new code<input type="file" id="qr-file" accept="image/*" hidden${ed?'':' disabled'}></label></div></div></section>
  <section class="panel"><div class="panel-head"><h2>Money and switches</h2></div>
    <div class="cfg"><div class="l"><b>Service fee</b><span>10% of the delivery fee, paid by the student on top. Free during the launch.</span><br><span class="open">Locked until the payment route is confirmed.</span></div><div class="in"><label class="switch"><input type="checkbox" disabled${ST.serviceFeeOn?' checked':''} aria-label="Charge service fee"></label></div></div>
    <div class="cfg"><div class="l"><b>Post any task</b><span>Phase 2. Off for the launch (takeaway and parcels only).</span></div><div class="in"><label class="switch"><input type="checkbox" id="feat-tasks"${ST.features.tasks?' checked':''}${ed?'':' disabled'} aria-label="Post any task"></label></div></div>
    <div class="cfg"><div class="l"><b>Runner check</b><span>How a student becomes a runner.</span></div><div class="in"><select id="verify-mode" aria-label="Runner check"${ed?'':' disabled'}><option value="manual" selected>Staff check name and student ID by hand</option><option value="api" disabled>Student API (coming later)</option></select></div></div>
    <div class="cfg"><div class="l"><b>Runner pay limit per trip</b><span>New ¥${ST.levels.new} · Rising ¥${ST.levels.rising} · Trusted ¥${ST.levels.trusted} · Top no limit</span></div><div class="in"><button class="linkbtn" data-act="go:runners:levels">View levels</button></div></div>
  </section></div></div>
  <div class="section-gap"></div>
  <section class="panel"><div class="panel-head"><h2>Membership rules</h2><span class="hint">Levels, points, perks and the monthly coupon cap now live on Membership & coupons → Membership.</span><span class="right"><button class="btn small" data-act="go:coupons:membership">Open Membership & coupons</button></span></div></section>
  <div class="section-gap"></div>
  <div class="grid g2">
  <section class="panel"><div class="panel-head"><h2>Pickup points</h2><span class="hint">SIP campus</span>${ed?'<span class="right"><button class="btn small" data-act="addPickup">Add point</button></span>':''}</div>
    <div class="tbl-wrap" style="border:0"><table><thead><tr><th>Name</th><th>Kind</th><th class="n">Orders, 30 days</th><th>Shown in app</th></tr></thead><tbody>${PICKUPS.map(p=>`<tr><td>${ed?`<input type="text" id="pu-${p.id}" value="${esc(p.name)}" aria-label="Pickup name" style="width:100%;min-width:160px">`:esc(p.name)}</td><td>${p.kind}</td><td class="n">${ORDERS.filter(o=>o.pickup===p.id&&!o.isTest&&o.postedAt>=TODAY0-29*DAY).length}</td><td><label class="switch"><input type="checkbox" id="pua-${p.id}"${p.active?' checked':''}${ed?'':' disabled'} aria-label="Shown in app"></label></td></tr>`).join('')}</tbody></table></div></section>
  <section class="panel"><div class="panel-head"><h2>Dorm buildings</h2><span class="hint">22 buildings · D, A, C codes as in the live backend; Wen Hui codes to confirm</span></div>
    <div class="tbl-wrap" style="border:0;max-height:330px"><table><thead><tr><th>Building</th><th>Area</th><th>Dorm</th><th>Food locker</th><th class="n">Members</th></tr></thead><tbody>${BUILDINGS.map(b=>`<tr><td>${b.name}</td><td>${areaL(b.area)}</td><td>${ed?`<select id="bg-${b.id}" aria-label="Dorm gender"><option${b.gender==='Female'?' selected':''}>Female</option><option${b.gender==='Male'?' selected':''}>Male</option></select>`:b.gender}</td><td>${b.lockerLoc?'Set':'<span class="faint">Not set</span>'} <button class="linkbtn" data-act="go:addresses:lockers">Edit</button></td><td class="n">${USERS.filter(u=>u.bld===b.id&&!u.isTest).length}</td></tr>`).join('')}</tbody></table></div>
    <p class="faint" style="font-size:12px;margin:8px 0 0">Students can choose girl or boy in the app; if they don't, the Members page uses this building setting and marks it “from dorm”. It's used for lobby drop-offs and member filters, never to rank people or set prices.</p></section></div>
  <div class="section-gap"></div>
  <div class="grid g3">
  <section class="panel"><div class="panel-head"><h2>Rule changes</h2></div>${ST.changeLog.length?`<ul style="margin:0;padding-left:18px;color:var(--muted);font-size:13px">${ST.changeLog.map(c=>`<li>${fDT(c.at)} · ${roleName[c.by]}: ${esc(c.what)}</li>`).join('')}</ul>`:'<p class="muted" style="margin:0">No changes yet. Every change is logged here with who made it.</p>'}<p class="faint" style="font-size:12px;margin:8px 0 0">Rule changes that affect members are announced in the app 14 days ahead.</p></section>
  <section class="panel"><div class="panel-head"><h2>Export log</h2></div><ul style="margin:0;padding-left:18px;color:var(--muted);font-size:13px;display:flex;flex-direction:column;gap:4px">${ST.exportLog.map(e=>`<li>${fDT(e.at)} · ${e.by}: ${esc(e.what)} (${e.rows.toLocaleString()} rows)</li>`).join('')}</ul><p class="faint" style="font-size:12px;margin:8px 0 0">Admins only. Phones and student IDs stay masked in every export.</p></section>
  <section class="panel"><div class="panel-head"><h2>Private details viewed</h2></div>${ST.accessLog.length?`<ul style="margin:0;padding-left:18px;color:var(--muted);font-size:13px">${ST.accessLog.map(a=>`<li>${fDT(a.at)} · ${roleName[a.by]} viewed ${esc(a.what)}</li>`).join('')}</ul>`:'<p class="muted" style="margin:0">Nobody has opened a room number or full phone number. Each view is logged here (PIPL).</p>'}</section></div>
  <div class="section-gap"></div>
  <section class="panel"><div class="panel-head"><h2>Staff roles</h2></div><div class="tbl-wrap" style="border:0"><table><thead><tr><th>Can…</th><th>Admin</th><th>Operations</th><th>Support</th></tr></thead><tbody>
    ${[['Reply to tickets','reply'],['Refund and decide disputes','refund'],['Approve runners and give marks','approve'],['Send news and goodwill points','news'],['Export data','export'],['See room or full phone (logged)','reveal'],['Change rules and places','config']].map(([l,k])=>`<tr><td>${l}</td>${['admin','ops','support'].map(r=>`<td>${CAN[k].includes(r)?'<span class="pill good plain">Yes</span>':'<span class="faint">—</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`}

/* ============ drawers ============ */
function dOrder(o){
  if(chatFor(o).length&&!VIEWED_CHATS.has(o.id)){VIEWED_CHATS.add(o.id);ST.accessLog.unshift({at:NOW,by:ST.role,what:'the chat on order '+o.id})}
  const m=money(o),c=UMAP[o.customer];
  const steps=[['Posted & paid',o.postedAt],['Taken by runner',o.takenAt],['Picked up',o.pickedAt],['Delivered with photo',o.deliveredAt],[o.confirmedBy==='auto'?'Auto-confirmed, runner paid':'Confirmed, runner paid',o.confirmedAt]];
  let prev=o.postedAt;
  const tl=steps.map(([l,t],i)=>{const g=t&&i?`<span class="gap">+${fMin((t-prev)/MIN)}</span>`:'';if(t)prev=t;return`<li class="${t?'done':''}"><span class="dot"></span><span>${l}${i===2&&t?' <span class="faint">· last 4 digits and seal checked</span>':''}</span><span class="muted num">${t?fDT(t):'—'} ${g}</span></li>`}).join('')
    +(o.cancelledBy?`<li class="bad"><span class="dot"></span><span>${o.status==='expired'?'Expired':'Cancelled'} by ${o.cancelledBy==='system'?'the system':o.cancelledBy} · <button class="linkbtn" data-act="creason:${esc(encodeURIComponent(o.cancelReason))}">${esc(o.cancelReason)}</button>${o.cancelNote?' · <span translate="no">“'+esc(o.cancelNote)+'”</span>':''}</span><span class="muted">${fDT(o.cancelledAt)}</span></li>`:'')
    +(o.dispute?`<li class="bad"><span class="dot"></span><span>Reported: ${o.dispute.type} · <button class="linkbtn" data-act="dispute:${o.id}">${o.dispute.status==='open'?'Decide':'See decision'}</button></span><span class="muted">${fDT(o.dispute.reportedAt)}</span></li>`:'');
  const revealed=drawer.reveal;
  const canFull=LIVE.has(o.status)&&o.status!=='disputed'&&!o.takenAt, canHalf=o.status==='taken'&&!o.pickedAt;
  const ticket=TICKETS.filter(t=>t.order===o.id);
  return`<div class="drawer-head"><div><h3 class="mono" style="font-family:var(--font-mono)">${o.id}${testPill(o.isTest)}</h3><p>${TYPES[o.type]} · ${route(o)}</p></div><button class="x" data-act="close" aria-label="Close">${IC.x}</button></div>
  <div class="drawer-body">
    <div class="row">${pill(o.status)}${o.groupId?'<span class="tag">Grouped trip · '+ORDERS.filter(x=>x.groupId===o.groupId).length+' orders</span>':''}${o.isFirst?'<span class="tag">First order</span>':''}${o.rating?`<span class="tag">Rated ${o.rating}★</span>`:''}</div>
    <div class="sec"><h4>Timeline</h4><ul class="timeline">${tl}</ul>
      ${o.type==='takeaway'?`<p class="faint" style="font-size:12px;margin:0">Food due at the gate ${fHM(o.dueAt)} (latest time from the delivery app).</p>`:o.askedBy?`<p class="faint" style="font-size:12px;margin:0">Student asked for it by ${fDT(o.askedBy)}${o.deliveredAt?(o.deliveredAt<=o.askedBy?' · on time':' · late'):''}.</p>`:''}</div>
    <div class="sec"><h4>Chat · ${chatFor(o).filter(x=>x.from!=='sys').length} messages</h4>${chatHTML(o)}
      <p class="faint" style="font-size:12px;margin:6px 0 0">Private between the student and runner. Staff can read it for support; this view is logged under Rules &amp; setup. Phone numbers are masked in calls and chat.</p></div>
    <div class="sec"><h4>People</h4><dl class="dl">
      <dt>Student</dt><dd>${ulink(c.id)}</dd>
      <dt>Phone</dt><dd><span class="mono">${revealed?c.phone:maskPhone(c.phone)}</span> <span class="faint">· last 4 on the bag</span></dd>
      <dt>Deliver to</dt><dd>${esc(BLD[o.bld].name)}, room ${revealed?c.room:maskRoom(c.room)} <span class="faint">· ${BLD[o.bld].gender} dorm</span></dd>
      <dt>Food locker</dt><dd>${BLD[o.bld].lockerLoc?esc(BLD[o.bld].lockerLoc):'<span class="faint">Not set for this building</span>'}</dd>
      <dt>Runner</dt><dd>${o.runner?ulink(o.runner):(o.runnerCancelled?ulink(o.runnerCancelled)+' <span class="faint">(cancelled)</span>':'<span class="faint">None yet</span>')}</dd></dl>
      ${revealed?'':`<div class="row" style="margin-top:8px"><button class="btn small" data-act="reveal:${o.id}"${dis('reveal')}>Show room and full phone</button><span class="faint" style="font-size:12px">The runner sees these only while the job is open. Staff views are logged.</span></div>`}</div>
    <div class="sec"><h4>Money</h4><dl class="dl">
      <dt>Delivery fee</dt><dd>${Y(o.fee)}${o.offerRaised?` + ${Y(o.offerRaised)} raised at ${fHM(o.raisedAt)}`:''} <span class="faint">· all to the runner</span></dd>
      <dt>Service fee</dt><dd>${Y(o.svc)} <span class="faint">· free at launch</span></dd>
      ${o.coupon?`<dt>Coupon</dt><dd>−${Y(o.coupon.fen)} · <button class="linkbtn" data-act="coupon:${o.coupon.id}">${esc(cName(CMAP[o.coupon.id]))}</button> <span class="faint">· paid by Uniearn</span></dd>`:''}
      <dt>Student paid</dt><dd>${Y(m.paid)} by WeChat Pay at ${fHM(o.paidAt)}</dd>
      <dt>Settlement</dt><dd>${SETTLE_LABEL[settle(o)]}${m.held?' · '+Y(m.held)+' held':''}${m.released?' · '+Y(m.released)+' to runner wallet':''}${m.refunded?' · '+Y(m.refunded)+' refunded':''}${m.subsidy?' · Uniearn adds '+Y(m.subsidy):''}</dd>
      ${o.refunds.map(r=>`<dt>Refund</dt><dd>${Y(r.fen)} · ${esc(r.reason)} · ${fDT(r.at)}</dd>`).join('')}</dl></div>
    ${canFull||canHalf?`<div class="sec"><h4>Actions</h4>${drawer.confirm?`<div class="confirm"><b>${drawer.confirm==='full'?`Cancel and refund ${Y(m.paid)} to the student?`:`Cancel and refund ${Y(Math.round(m.paid/2))}? The runner keeps the other half.`}</b><span>This follows the refund rules and can't be undone.</span><div class="row"><button class="btn danger" data-act="doRefund:${o.id}:${drawer.confirm}">Yes, refund</button><button class="btn" data-act="noConfirm">Keep the order</button></div></div>`
      :`<div class="row">${canFull?`<button class="btn" data-act="askRefund:full"${dis('refund')}>Cancel · full refund</button>`:''}${canHalf?`<button class="btn" data-act="askRefund:half"${dis('refund')}>Cancel · 50% refund</button>`:''}</div>`}</div>`:''}
    ${ticket.length?`<div class="sec"><h4>Tickets</h4>${ticket.map(t=>`<button class="linkbtn" data-act="ticket:${t.id}">${t.id} · ${t.topic}</button>`).join('<br>')}</div>`:''}
    <div class="sec"><h4>Staff notes</h4>${o.notes.map(n=>`<p style="margin:0 0 6px;font-size:13px"><span translate="no">${esc(n.text)}</span> <span class="faint">· ${roleName[n.by]}, ${fDT(n.at)}</span></p>`).join('')}
      <div class="row"><input type="text" id="note-text" placeholder="Add a note for the team" style="flex:1"><button class="btn small" data-act="note:order:${o.id}">Add</button></div></div>
    ${!o.isTest?`<div class="sec"><button class="linkbtn" data-act="markTest:${o.id}">Mark as test order</button> <span class="faint" style="font-size:12px">Hides it from every total.</span></div>`:''}
  </div>`}
const HOUR_BUCKET=h=>h<11?'Morning':h<14?'Lunch (11–14)':h<17?'Afternoon':h<20?'Dinner (17–20)':'Evening';
function pointsLog(u){
  const L=[],C=ORDERS.filter(o=>o.customer===u.id&&o.status==='confirmed'&&(ST.showTest||!o.isTest)),J=ORDERS.filter(o=>o.runner===u.id&&o.status==='confirmed'&&(ST.showTest||!o.isTest));
  const a=ADDRS.find(x=>x.user===u.id);if(a&&C.length)L.push({at:a.createdAt,pts:MEMBER.details,what:'Added delivery details'});
  C.forEach((o,i)=>{L.push({at:o.confirmedAt,pts:MEMBER.order,what:'Order delivered '+o.id});if(i===0)L.push({at:o.confirmedAt+1,pts:MEMBER.first,what:'First delivered order'})});
  J.forEach(o=>L.push({at:o.confirmedAt,pts:MEMBER.job,what:'Job delivered '+o.id}));
  u.goodwill.forEach(g=>L.push({at:g.at,pts:g.pts,what:'Goodwill: '+g.reason}));
  return L.sort((x,y)=>y.at-x.at)}
function dMember(u){
  const s=MS.get(u.id),tab=drawer.tab||'summary',rev=drawer.reveal,vis=o=>ST.showTest||!o.isTest||u.isTest;
  const asC=ORDERS.filter(o=>o.customer===u.id&&vis(o)).reverse();
  const asR=ORDERS.filter(o=>(o.runner===u.id||o.runnerCancelled===u.id)&&vis(o)).reverse();
  const chats=[...asC,...asR].filter(o=>chatFor(o).length).sort((a,b)=>b.postedAt-a.postedAt);
  const tks=TICKETS.filter(t=>t.user===u.id),disp=ORDERS.filter(o=>o.dispute&&(o.customer===u.id||o.runner===u.id));
  const addr=ADDRS.find(a=>a.user===u.id),app=APPS.find(a=>a.user===u.id),rs=runnerStats(u.id),marks=MARKS.filter(m=>m.runner===u.id&&m.expiresAt>NOW);
  const b=BLD[u.bld],lvl=levelOf(rs.total);
  const hrs={};asC.forEach(o=>{const k=HOUR_BUCKET(hourOf(o.postedAt));hrs[k]=(hrs[k]||0)+1});const usual=Object.entries(hrs).sort((a,b)=>b[1]-a[1])[0];
  const month0=Date.parse('2026-10-01T00:00:00+08:00'),gwLeft=MEMBER.goodwill-sum(u.goodwill.filter(g=>g.at>=month0).map(g=>g.pts));
  const canNews=u.consent&&(!u.lastNews||NOW-u.lastNews>=7*DAY);
  const tabs=[['summary','Summary'],['orders',`Orders (${asC.length})`],['jobs',`Jobs (${asR.length})`],['chats',`Chats (${chats.length})`],['points',`Points (${s.points})`],['support',`Support (${tks.length+disp.length})`],['actions','Notes & actions']];
  const otable=(L,runnerCol)=>L.length?`<div class="tbl-wrap"><table><thead><tr><th>Order</th><th>Status</th><th>Posted</th><th>Type</th><th class="n">Delivery fee</th><th>Route</th><th>${runnerCol?'Student':'Runner'}</th></tr></thead><tbody>${L.map(o=>`<tr class="click" data-act="order:${o.id}"><td class="mono">${o.id}</td><td>${pill(o.status)}${o.runnerCancelled===u.id?' <span class="tag">They cancelled</span>':''}</td><td>${fDT(o.postedAt)}</td><td>${TYPES[o.type]}</td><td class="n">${Y(o.fee+o.offerRaised)}</td><td>${route(o)}</td><td>${runnerCol?who(o.customer):(o.runner?who(o.runner):'<span class="faint">—</span>')}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted" style="margin:0">None.</p>';
  let body='';
  if(tab==='summary')body=`<div class="cards">
    <div class="box"><div class="sec"><h4>Account</h4><dl class="dl"><dt>Member ID</dt><dd class="mono">${u.id}</dd><dt>WeChat name</dt><dd translate="no">${esc(u.nick)}</dd><dt>Campus</dt><dd>XJTLU SIP</dd><dt>Joined</dt><dd>${fDT(u.joined)}</dd><dt translate="no">${LANG==='zh'?'性别':'Girl / boy'}</dt><dd translate="no">${(()=>{const x=sexOf(u);return sexL(x.g)+' <span class="faint">· '+(x.src==='chosen'?(LANG==='zh'?'本人在小程序里选择':'chosen by the student'):(LANG==='zh'?'没有选择，按宿舍楼判断':'not chosen; from dorm building'))+'</span>'})()}</dd><dt>Found us via</dt><dd>${u.source}</dd><dt>Last active</dt><dd>${ago(u.lastActive)}</dd><dt>Uses Uniearn as</dt><dd>${[asC.length?'Student':'',u.certified?'Runner':''].filter(Boolean).join(' and ')||'Not used yet'}</dd><dt>News</dt><dd>${u.consent?'Turned on':'Off'}${u.lastNews?' · last sent '+ago(u.lastNews):''}</dd></dl></div></div>
    <div class="box"><div class="sec"><h4>Contact & address</h4><dl class="dl"><dt>Phone</dt><dd class="mono">${rev?u.phone:maskPhone(u.phone)}</dd><dt>Student ID</dt><dd class="mono">${rev?u.sid:maskSid(u.sid)}</dd><dt>Contact name</dt><dd translate="no">${addr?esc(addr.contact):'—'}</dd><dt>Building</dt><dd>${esc(b.name)} · ${areaL(b.area)} · ${b.gender}</dd><dt>Room</dt><dd class="mono">${addr&&addr.room?(rev?addr.room:maskRoom(addr.room)):'—'}</dd><dt>Drop-off</dt><dd>${u.dropPref==='door'?'At the door':'Lobby'}</dd><dt>Food locker</dt><dd>${b.lockerLoc?esc(b.lockerLoc):'<span class="faint">Not set</span>'}</dd></dl>
      ${addr?`<button class="linkbtn" data-act="address:${addr.id}">Saved address ${addr.id}</button>`:''}
      ${rev?'':`<div class="row" style="margin-top:6px"><button class="btn small" data-act="reveal:profile ${u.id}"${dis('reveal')}>Show full phone, student ID and room</button></div>`}</div></div>
    <div class="box"><div class="sec"><h4>As a student</h4><dl class="dl"><dt>Orders</dt><dd>${s.orders} · ${s.done} finished · ${s.cancelled} cancelled by them</dd><dt>Cancel rate</dt><dd>${s.orders?pct(s.cancelled,s.orders)+'%':'—'}</dd><dt>Fees paid</dt><dd>${Y(s.fees)}</dd><dt>Favourite</dt><dd>${s.fav}</dd><dt>Usually orders</dt><dd>${usual?usual[0]:'—'}</dd><dt>First order</dt><dd>${asC.length?fDT(asC[asC.length-1].postedAt):'—'}</dd><dt>Last order</dt><dd>${s.last?fDT(s.last):'—'}</dd><dt>Confirms in</dt><dd>${fMin(s.confMed)} median · ${s.autoConf} left to auto-confirm</dd></dl></div></div>
    <div class="box"><div class="sec"><h4>As a runner</h4>${u.certified||asR.length?`<dl class="dl"><dt>Certification</dt><dd>${app?appPill(app):'—'}${app&&app.checkedAt?' · '+fDay(app.checkedAt):''}</dd><dt>Level</dt><dd>${lvlPill(lvl)} · limit ${ST.levels[lvl]==null?'none':'¥'+ST.levels[lvl]+' a trip'}</dd><dt>Finished jobs</dt><dd>${rs.total}</dd><dt>Delivered ≤15 min</dt><dd>${rs.jobs?rs.onTime+'%':'—'}</dd><dt>Earned</dt><dd>${Y(rs.earned)} <span class="faint">from students</span></dd><dt>Wallet</dt><dd>${Y(wallet(u.id).balance)}${wallet(u.id).frozen?' · '+Y(wallet(u.id).frozen)+' waiting to withdraw':''}</dd><dt>Active marks</dt><dd>${marks.length}${PAUSED[u.id]>NOW?' · paused until '+fDay(PAUSED[u.id]):''}</dd><dt>Graduates</dt><dd>${app?app.grad:'—'}</dd></dl>`:`<p class="muted" style="margin:0">${app?'Application '+app.status+(app.reason?' ('+esc(app.reason)+')':''):'Never applied to run.'}</p>`}</div></div>
    <div class="box"><div class="sec"><h4>Membership</h4><dl class="dl"><dt>Level</dt><dd>${levelPill(s.level)}</dd><dt>Points</dt><dd>${s.points} <span class="faint">· Silver at ${MEMBER.silver}, Gold at ${MEMBER.gold} (last ${MEMBER.windowMonths} months)</span></dd><dt>Tags</dt><dd>${[...u.tags].map(t=>`<span class="tag">${t}</span>`).join('')||'—'}</dd></dl></div></div>
    <div class="box"><div class="sec"><h4>Support</h4><dl class="dl"><dt>Tickets</dt><dd>${tks.length} · ${tks.filter(t=>t.status==='open').length} open</dd><dt>Disputes</dt><dd>${disp.length}</dd><dt>Staff notes</dt><dd>${u.notes.length}</dd></dl></div></div></div>`;
  else if(tab==='orders')body=otable(asC,false);
  else if(tab==='jobs')body=(u.certified||asR.length?`<div class="stats" style="margin-bottom:12px">${[['Jobs',rs.total],['On time',rs.jobs?rs.onTime+'%':'—'],['Median delivery',fMin(rs.del)],['Rating',rs.rating?rs.rating.toFixed(1)+'★':'—'],['Cancelled after taking',rs.cancels],['Earned',Y(rs.earned)]].map(([l,v])=>`<div class="stat"><span>${l}</span><b>${v}</b></div>`).join('')}</div>
    <div class="sec"><h4>Active marks (${marks.length})</h4>${marks.map(m=>`<div class="row" style="justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)"><span>${esc(m.rule)}<br><small class="faint">${fDT(m.givenAt)} · expires ${fDay(m.expiresAt)}</small></span><button class="btn small" data-act="rmMark:${m.id}"${dis('marks')}>Remove</button></div>`).join('')||'<p class="muted" style="margin:0 0 6px">No active marks.</p>'}
      <div class="row" style="margin:8px 0 14px"><select id="mark-rule" style="flex:1">${MARK_RULES.map(r=>`<option>${r}</option>`).join('')}</select><button class="btn small" data-act="addMark:${u.id}"${dis('marks')}>Give mark</button></div></div>`:'<p class="muted">Not a runner.</p>')+otable(asR,true);
  else if(tab==='chats')body=chats.length?`<div class="tbl-wrap"><table><thead><tr><th>Order</th><th>They were</th><th>With</th><th>Last message</th><th class="n">Messages</th></tr></thead><tbody>${chats.map(o=>{const m=chatFor(o).filter(x=>x.from!=='sys'),last=m[m.length-1],other=o.customer===u.id?(o.runner||o.runnerCancelled):o.customer;
      return`<tr class="click" data-act="order:${o.id}"><td class="mono">${o.id}</td><td>${o.customer===u.id?'Student':'Runner'}</td><td>${who(other)}</td><td class="wt">${last?'<span translate="no">'+esc(last.text.slice(0,48))+(last.text.length>48?'…':'')+'</span>'+` <span class="faint">· ${fDT(last.at)}</span>`:'<span class="faint">System only</span>'}</td><td class="n">${m.length}</td></tr>`}).join('')}</tbody></table></div><p class="faint" style="font-size:12px">Open an order to read its chat. Each chat you open is logged.</p>`:'<p class="muted">No chats yet.</p>';
  else if(tab==='points'){const L=pointsLog(u);body=`<div class="stats" style="margin-bottom:12px"><div class="stat"><span>Points</span><b>${s.points}</b></div><div class="stat"><span>Level</span><b>${s.level}</b></div><div class="stat"><span>To next level</span><b>${s.level==='Gold'?'—':(s.level==='Silver'?MEMBER.gold:MEMBER.silver)-s.points}</b></div></div>
    ${L.length?`<div class="tbl-wrap"><table><thead><tr><th>When</th><th>What</th><th class="n">Points</th></tr></thead><tbody>${L.map(x=>`<tr><td>${fDT(x.at)}</td><td>${esc(x.what)}</td><td class="n">+${x.pts}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">No points yet.</p>'}
    <p class="faint" style="font-size:12px">Cancelled, refunded and reported orders earn nothing. Points have no cash value and never change pay or runner level.</p>`}
  else if(tab==='support')body=`<div class="sec"><h4>Tickets</h4>${tks.length?`<div class="tbl-wrap"><table><tbody>${tks.map(t=>`<tr class="click" data-act="ticket:${t.id}"><td class="mono">${t.id}</td><td>${t.topic}</td><td>${fDT(t.createdAt)}</td><td>${t.status==='open'?'<span class="pill info">Still open</span>':'<span class="pill good">Resolved</span>'}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted" style="margin:0">No tickets.</p>'}</div>
    <div class="sec"><h4>Disputes</h4>${disp.length?`<div class="tbl-wrap"><table><tbody>${disp.map(o=>`<tr class="click" data-act="dispute:${o.id}"><td class="mono">${o.id}</td><td>${o.dispute.type}</td><td>${o.customer===u.id?'They reported':'Reported against them'}</td><td>${o.dispute.status}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted" style="margin:0">No disputes.</p>'}</div>`;
  else body=`<div class="sec"><h4>Tags (staff only)</h4><div class="row">${['Lunch regular','Parcels','Runner','Ambassador','Needs help'].map(t=>`<button class="chip" aria-pressed="${u.tags.has(t)}" data-act="tag:${u.id}:${t}"${['Lunch regular','Parcels','Runner'].includes(t)?' disabled title="Set automatically from orders"':''}>${t}</button>`).join('')}</div></div>
    <div class="sec"><h4>Goodwill points</h4><p class="faint" style="margin:0 0 8px;font-size:12px">Points, never money. Up to ${MEMBER.goodwill} per member a month · ${gwLeft} left this month.</p>
      <div class="row"><input type="number" id="gw-pts" min="1" max="${gwLeft}" placeholder="Points" style="width:90px"><input type="text" id="gw-reason" placeholder="Reason (required)" style="flex:1"><button class="btn small" data-act="goodwill:${u.id}"${can('goodwill')?(gwLeft>0?'':' disabled'):dis('goodwill')}>Give</button></div></div>
    <div class="sec"><h4>News message</h4>${canNews?`<div class="row"><input type="text" id="one-news" maxlength="120" placeholder="Message to this member" style="flex:1"><button class="btn small" data-act="oneNews:${u.id}"${dis('news')}>Send</button></div>`:`<p class="muted" style="margin:0">${u.consent?'Already messaged in the last 7 days.':'This member hasn\'t turned on "News from Uniearn".'}</p>`}</div>
    <div class="sec"><h4>Staff notes</h4>${u.notes.map(n=>`<p style="margin:0 0 6px;font-size:13px"><span translate="no">${esc(n.text)}</span> <span class="faint">· ${roleName[n.by]}, ${fDT(n.at)}</span></p>`).join('')}
      <div class="row"><input type="text" id="note-text" placeholder="Add a note" style="flex:1"><button class="btn small" data-act="note:member:${u.id}">Add</button></div></div>`;
  return`<div class="drawer-head"><div><h3><span translate="no">${esc(u.nick)}</span>${testPill(u.isTest)}</h3><p><span class="mono">${u.id}</span> · joined ${fDay(u.joined)} · last active ${ago(u.lastActive)}</p>
      <div class="row" style="margin-top:6px">${levelPill(s.level)}${u.certified?lvlPill(lvl)+'<span class="tag">Runner</span>':''}${PAUSED[u.id]>NOW?'<span class="pill crit">Paused</span>':''}${u.consent?'<span class="tag">News on</span>':''}</div></div><button class="x" data-act="close" aria-label="Close">${IC.x}</button></div>
  <div class="drawer-body">
    <div class="stats">${[['Orders',s.orders],['Finished',s.done],['Cancel rate',s.orders?pct(s.cancelled,s.orders)+'%':'—'],['Fees paid',Y(s.fees)],['Jobs',rs.total],['Earned',Y(rs.earned)],['Points',s.points]].map(([l,v])=>`<div class="stat"><span>${l}</span><b>${v}</b></div>`).join('')}</div>
    <div class="tabs" role="tablist" style="margin-bottom:0">${tabs.map(([k,l])=>`<button role="tab" aria-selected="${tab===k}" data-act="utab:${k}">${l}</button>`).join('')}</div>
    <div>${body}</div>
  </div>`}
const appOk=a=>{const u=UMAP[a.user];return sidValid(u.sid)&&!USERS.some(x=>x.id!==u.id&&x.sid===u.sid)};
const queue=()=>APPS.filter(a=>a.status==='pending').sort((a,b)=>a.appliedAt-b.appliedAt);
function dApp(a){
  const u=UMAP[a.user],ck=drawer.checks||{};const all=ck.a&&ck.b&&ck.c;
  const Q=queue(),qi=Q.findIndex(x=>x.id===a.id);
  return`<div class="drawer-head"><div><h3>Runner application</h3><p><span translate="no">${esc(u.nick)}</span> · <span class="mono">${u.id}</span> · applied ${fDT(a.appliedAt)} · waiting ${a.status==='pending'?fMin((NOW-a.appliedAt)/MIN):'—'}</p></div><button class="x" data-act="close" aria-label="Close">${IC.x}</button></div>
  <div class="drawer-body">
    <div class="row">${appPill(a)}${a.override?'<span class="pill warn">Approved anyway</span>':''}${a.reason?`<span class="tag">${esc(a.reason)}</span>`:''}${qi>=0?`<span class="queue">${qi+1} of ${Q.length} to review</span>`:''}<span class="tag">Manual check</span></div>
    ${(()=>{const dup=USERS.filter(x=>x.id!==u.id&&x.sid===u.sid),okId=sidValid(u.sid),okName=/\S+\s+\S+/.test(u.contact)&&u.contact.replace(/\W/g,'').length>=3,auto=[[okId,'Student ID has the right format (7 digits)',"Student ID doesn't look like an XJTLU ID"],[!dup.length,'No other account uses this student ID','Another account already uses this student ID'],[okName,'Real name has a family name and a given name','Real name looks incomplete'],[true,'Phone number verified by WeChat','']];
    return`<dl class="dl"><dt>Real name given</dt><dd translate="no">${esc(u.contact)}</dd><dt>Student ID given</dt><dd class="mono">${u.sid}</dd><dt>Phone</dt><dd class="mono">${maskPhone(u.phone)}</dd><dt>Dorm</dt><dd>${esc(BLD[u.bld].name)} · ${BLD[u.bld].gender}</dd><dt>Expected graduation</dt><dd>${a.grad} <span class="faint">· certification ends then</span></dd><dt>Joined Uniearn</dt><dd>${fDT(u.joined)} · ${MS.get(u.id).orders} orders</dd>${a.checkedBy?`<dt>Checked</dt><dd>${a.checkedBy}, ${fDT(a.checkedAt)}</dd>`:''}</dl>
    ${a.status==='pending'?`<div class="sec"><h4>Automatic checks</h4><ul class="autochk">${auto.map(([ok,y,n])=>`<li class="${ok?'ok':'bad'}"><span aria-hidden="true">${ok?'✓':'!'}</span>${ok?y:n}</li>`).join('')}</ul></div>
    <div class="sec">
      <div class="row" style="margin-top:12px"><button class="btn primary" data-act="${okId&&!dup.length?'approve':'approveAny'}:${a.id}"${dis('approve')}>${okId&&!dup.length?'Approve':'Approve anyway'}</button>
      <select id="rej-reason"><option>Student ID is not valid</option><option>Student ID already used by another account</option><option>Real name looks incomplete</option><option>Not a current XJTLU student</option><option>Graduated</option></select><button class="btn danger" data-act="reject:${a.id}"${dis('approve')}>Reject</button></div>
      <div class="row" style="margin-top:10px"><button class="btn small" data-act="askFix:${a.id}"${dis('approve')}>Ask them to correct their details</button><span class="faint" style="font-size:12px">Keeps it in the queue and messages the student.</span></div>
      ${!okId||dup.length?'<p class="faint" style="font-size:12px;margin:8px 0 0">An automatic check failed. You can still approve; it is saved as "approved anyway" with your name.</p>':''}
      <p class="faint" style="font-size:12px;margin:10px 0 0">Your name is saved with the decision${ST.me?' ('+esc(ST.me)+')':''}. Don't copy students' names or student IDs anywhere else.</p></div>`:''}`})()}
    ${a.status==='approved'?`<button class="btn danger small" data-act="revoke:${a.id}"${dis('approve')} style="align-self:flex-start">Revoke certification</button>`:''}
  </div>`}
function dAddress(a){
  const u=UMAP[a.user],b=BLD[a.bld],rev=drawer.reveal,os=addrOrders(a).slice(-6).reverse();
  return`<div class="drawer-head"><div><h3>Address ${a.id}${testPill(u.isTest)}</h3><p>${esc(b.name)} · ${areaL(b.area)} · added ${fDT(a.createdAt)}</p></div><button class="x" data-act="close" aria-label="Close">${IC.x}</button></div>
  <div class="drawer-body">
    <dl class="dl"><dt>Member</dt><dd><button class="linkbtn" data-act="member:${u.id}">${esc(u.nick)}</button> <span class="faint mono">${u.id}</span></dd>
      <dt>Contact name</dt><dd translate="no">${esc(a.contact)}</dd>
      <dt>Phone</dt><dd><span class="mono">${rev?u.phone:maskPhone(u.phone)}</span></dd>
      <dt>Building</dt><dd>${esc(b.name)} <span class="faint">· ${b.gender} dorm</span></dd>
      <dt>Room</dt><dd>${a.room?`<span class="mono">${rev?a.room:maskRoom(a.room)}</span>`:'<span class="pill warn">Missing</span> <span class="faint">runners can only use the lobby</span>'}</dd>
      <dt>Drop-off</dt><dd>${a.drop==='door'?'Hang it on the door, with a photo':'Lobby, the student comes down'}</dd>
      <dt>Food locker</dt><dd>${b.lockerLoc?esc(b.lockerLoc):'<span class="pill warn">Not set for this building</span>'}</dd>
      <dt>Last used</dt><dd>${a.lastUsed?fDT(a.lastUsed):'Not used yet'}</dd></dl>
    ${rev?'':`<div class="row"><button class="btn small" data-act="reveal:address ${a.id}"${dis('reveal')}>Show room and full phone</button><span class="faint" style="font-size:12px">Logged under Rules &amp; setup.</span></div>`}
    ${b.lockerLoc?'':`<button class="btn small" data-act="go:addresses:lockers" style="align-self:flex-start">Set the locker for ${esc(b.name)}</button>`}
    <div class="sec"><h4>Orders to this address</h4>${os.length?`<div class="tbl-wrap"><table><tbody>${os.map(o=>`<tr class="click" data-act="order:${o.id}"><td class="mono">${o.id}</td><td>${TYPES[o.type]}</td><td>${fDT(o.postedAt)}</td><td>${pill(o.status)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted" style="margin:0">No orders yet.</p>'}</div>
    <div class="box note">Addresses belong to the student. Staff can look but not edit; the student changes it in Me → Delivery details.</div>
  </div>`}
function dTicket(t){
  return`<div class="drawer-head"><div><h3>${t.topic}</h3><p><span class="mono">${t.id}</span> · from ${uname(t.user)} (${t.role}) · ${fDT(t.createdAt)}</p></div><button class="x" data-act="close" aria-label="Close">${IC.x}</button></div>
  <div class="drawer-body">
    <div class="row">${t.status==='open'?'<span class="pill info">Still open</span>':'<span class="pill good">Resolved</span>'}${t.order?`<button class="linkbtn" data-act="order:${t.order}">Order ${t.order}</button>`:''}${t.firstReplyAt?`<span class="tag">First reply in ${fMin((t.firstReplyAt-t.createdAt)/MIN)}</span>`:''}</div>
    <div class="thread">${t.thread.map(m=>`<div class="msg ${m.from==='staff'?'staff':''}">${esc(m.text)}<small>${m.from==='staff'?'Uniearn team':uname(t.user)} · ${fDT(m.at)}</small></div>`).join('')}</div>
    ${t.status==='open'?`<label class="field">Reply<textarea id="reply-text" rows="3" placeholder="Write a reply"></textarea></label><div class="row"><button class="btn primary" data-act="reply:${t.id}"${dis('reply')}>Send reply</button><button class="btn" data-act="resolve:${t.id}"${dis('reply')}>Mark resolved</button></div>`:`<button class="btn small" data-act="reopen:${t.id}" style="align-self:flex-start">Reopen</button>`}
  </div>`}
function dDispute(o){
  const d=o.dispute;
  return`<div class="drawer-head"><div><h3>Dispute · ${d.type}</h3><p><span class="mono">${o.id}</span> · reported ${fDT(d.reportedAt)}, ${fMin((d.reportedAt-o.deliveredAt)/MIN)} after delivery</p></div><button class="x" data-act="close" aria-label="Close">${IC.x}</button></div>
  <div class="drawer-body">
    <div class="grid g2" style="gap:10px"><div class="ph">Student's photo<br><small>(sample)</small></div><div class="ph">Runner's drop-off photo<br><small>${fDT(o.deliveredAt)} (sample)</small></div></div>
    <dl class="dl"><dt>Student</dt><dd><button class="linkbtn" data-act="member:${o.customer}">${uname(o.customer)}</button></dd><dt>Runner</dt><dd><button class="linkbtn" data-act="runner:${o.runner}">${uname(o.runner)}</button></dd><dt>Route</dt><dd>${route(o)}</dd><dt>Delivery fee held</dt><dd>${Y(o.fee+o.offerRaised)}</dd></dl>
    ${d.status==='open'?`<div class="sec"><h4>Decision</h4><div style="display:flex;flex-direction:column;gap:10px">
      <label class="field">Reason (shown to both)<input type="text" id="dsp-reason" placeholder="e.g. Photo shows a different bag"></label>
      <div class="row"><label class="field">Refund to student<input type="number" id="dsp-amt" min="0.01" max="${(o.fee+o.offerRaised)/100}" step="0.01" value="${((o.fee+o.offerRaised)/100).toFixed(2)}" style="width:110px"></label></div>
      <div class="row"><button class="btn danger" data-act="uphold:${o.id}"${dis('dispute')}>Uphold · refund</button><button class="btn" data-act="rejectDsp:${o.id}"${dis('dispute')}>Reject · pay runner</button></div>
      <p class="faint" style="font-size:12px;margin:0">Refund the affected part; the rest goes to the runner. Wrong bag: the runner also pays back the food, taken from their next payouts.</p></div></div>`
    :`<p class="muted">${d.status==='upheld'?'Upheld':'Rejected'}${d.decidedAt?' on '+fDT(d.decidedAt):''}${d.note?' · '+esc(d.note):''}</p>`}
  </div>`}

/* ============ render ============ */
function renderNav(){
  const counts={funds:WITHDRAWALS.filter(w=>w.status==='pending').length,support:TICKETS.filter(needsReply).length,runners:APPS.filter(a=>a.status==='pending').length,
    orders:ORDERS.filter(o=>!o.isTest&&o.status==='posted'&&NOW-o.postedAt>10*MIN).length};
  document.getElementById('nav').innerHTML=VIEWS.map(([k,l])=>`<button data-act="view:${k}" ${ST.view===k?'aria-current="page"':''}>${IC[k]}<span class="lbl" translate="no">${LANG==='zh'?NAVZ[k][0]:l}</span>${counts[k]?`<span class="count">${counts[k]}</span>`:''}</button>`).join('')}
function renderFilters(){
  const v=ST.view,showRange=['overview','orders','cancels','funds','runners','coupons'].includes(v),showType=['overview','orders','cancels','funds'].includes(v),showArea=v!=='config'&&v!=='messages'&&v!=='support';
  document.getElementById('filters').innerHTML=
    (showRange?`<div class="seg" role="group" aria-label="Date range">${[['today','Today'],['7d','7 days'],['30d','30 days'],['all','All']].map(([k,l])=>`<button aria-pressed="${ST.range===k}" data-act="range:${k}">${l}</button>`).join('')}</div>`:'')
    +(showArea?`<select id="f-area" aria-label="Dorm area"><option value="all">All dorm areas</option>${AREAS.map(a=>`<option value="${a.id}"${ST.area===a.id?' selected':''}>${areaL(a)}</option>`).join('')}</select>`:'')
    +(showType?`<select id="f-type" aria-label="Order type"><option value="all">All types</option>${TYPE_KEYS.map(k=>`<option value="${k}"${ST.type===k?' selected':''}>${TYPES[k]}</option>`).join('')}</select>`:'')
    +`<label class="switch" title="Team and developer accounts and their orders"><input type="checkbox" id="f-test"${ST.showTest?' checked':''}> Show test data</label>`
    +`<div class="seg lang-m" role="group" aria-label="Language" translate="no"><button data-act="lang:en" aria-pressed="${LANG==='en'}">EN</button><button data-act="lang:zh" aria-pressed="${LANG==='zh'}">中文</button></div>`}
function render(){
  const v=VIEWS.find(x=>x[0]===ST.view);
  document.getElementById('ptitle').textContent=LANG==='zh'?NAVZ[v[0]][0]:v[1];document.getElementById('psub').textContent=LANG==='zh'?NAVZ[v[0]][1]:v[2];
  renderNav();renderFilters();
  const fn={coupons:vRewards,cancels:vCancels,addresses:vAddresses,overview:vOverview,orders:vOrders,members:vMembers,runners:vRunners,support:vSupport,funds:vFunds,messages:vMessages,config:vConfig}[ST.view];
  document.getElementById('view').innerHTML=fn();
  document.querySelector('.rail .rail-foot').querySelectorAll('[data-lang]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.lang===LANG));
  trDom(document.querySelector('.app'));
  renderDrawer()}
function renderDrawer(){
  const root=document.getElementById('drawer-root');
  if(!drawer){root.innerHTML='';return}
  let h='';const{kind,id}=drawer;
  if(kind==='order')h=dOrder(OMAP[id]);else if(kind==='member')h=dMember(UMAP[id]);
  else if(kind==='app')h=dApp(APPS.find(a=>a.id===id));else if(kind==='ticket')h=dTicket(TICKETS.find(t=>t.id===id));else if(kind==='dispute')h=dDispute(OMAP[id]);else if(kind==='address')h=dAddress(AMAP[id]);else if(kind==='coupon')h=dCoupon(CMAP[id]);else if(kind==='newCoupon')h=dNewCoupon();
  const scroll=root.querySelector('.drawer-body')?.scrollTop||0;
  const prev=dstack[dstack.length-1];
  const lab=prev?({order:'order '+prev.id,member:UMAP[prev.id]?.nick,address:'address '+prev.id,ticket:'ticket '+prev.id,dispute:'dispute '+prev.id,app:'the application'})[prev.kind]:'';
  root.innerHTML=`<div class="scrim" data-act="close"></div><aside class="drawer${kind==='member'?' wide':''}" role="dialog" aria-modal="true">${prev?`<div class="drawer-back"><button class="linkbtn" data-act="back">‹ Back to ${esc(lab)}</button></div>`:''}${h}</aside>`;
  trDom(root);
  const b=root.querySelector('.drawer-body');if(b)b.scrollTop=drawer.keepScroll?scroll:0;drawer.keepScroll=false}
let dstack=[];
function openD(kind,id,extra={}){
  if(drawer&&drawer.kind===kind&&drawer.id===id){Object.assign(drawer,extra);renderDrawer();return}
  if(drawer)dstack.push({...drawer,confirm:null,keepScroll:false});
  drawer={kind,id,...extra};renderDrawer();setTimeout(()=>document.querySelector('.drawer .x')?.focus(),0)}
function upd(){drawer&&(drawer.keepScroll=true);render()}
function setView(v,sub){ST.view=v;drawer=null;dstack=[];
  if(v==='orders'&&sub==='slow'){Object.assign(ST.orders,{status:'posted',slow:true,page:0});ST.range='today'}
  if(v==='support'&&sub)ST.support.tab=sub;if(v==='support'&&!ST.support.sel&&innerWidth>760){const f=TICKETS.filter(needsReply).sort((a,b)=>waitingSince(a)-waitingSince(b))[0];if(f)ST.support.sel=f.id}if(v==='addresses'&&sub)ST.addr.tab=sub;if(v==='coupons'&&sub)ST.rewards.tab=sub;if(v==='cancels')ST.cancel.reason=sub||null;if(v==='funds'&&sub)ST.funds.tab=sub;if(v==='runners'&&sub){ST.runners.tab=sub==='apps'?'apps':sub;if(sub==='apps')ST.runners.appStatus='pending'}
  try{history.replaceState(null,'','#'+v)}catch(e){}
  render();window.scrollTo(0,0);
  if(v==='config'&&sub==='qr')setTimeout(()=>document.getElementById('qr')?.scrollIntoView({block:'start'}),30)}

/* ============ events ============ */
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-act]');if(!t||t.disabled)return;
  if(t.tagName==='INPUT'&&t.type==='checkbox'&&!t.dataset.act.startsWith('chk:'))return;
  const[a,...p]=t.dataset.act.split(':');const arg=p.join(':');
  switch(a){
    case'view':setView(arg);break;
    case'go':setView(p[0],p[1]);break;
    case'range':ST.range=arg;ST.orders.page=0;upd();break;
    case'order':openD('order',arg);break;
    case'member':openD('member',arg);break;
    case'runner':openD('member',arg,{tab:'jobs'});break;
    case'utab':drawer.tab=arg;renderDrawer();break;
    case'back':drawer=dstack.pop()||null;renderDrawer();break;
    case'app':openD('app',arg);break;
    case'ticket':Object.assign(ST.support,{tab:'tickets',sel:arg,box:'all',q:''});setView('support');scrollChat();break;
    case'sbox':ST.support.box=arg;render();break;
    case'ssel':ST.support.sel=arg||null;ST.support.draft='';ST.support.att=[];render();scrollChat();break;
    case'quick':{const el=document.getElementById('s-reply');el.value=QUICKS()[+arg][1];ST.support.draft=el.value;el.focus();break}
    case'send':case'sendResolve':{const tk=TICKETS.find(x=>x.id===arg);const v=(document.getElementById('s-reply').value||'').trim(),att=ST.support.att||[];if(!v&&!att.length){toast('Write a reply or add a picture first.');break}
      tk.thread.push({from:'staff',by:ST.me,text:v,imgs:att.length?att.slice():undefined,at:NOW});ST.support.att=[];if(!tk.firstReplyAt){tk.firstReplyAt=NOW;tk.repliedBy=ST.me}if(a==='sendResolve')tk.status='resolved';ST.support.draft='';render();scrollChat();toast(a==='sendResolve'?'Sent and resolved.':'Reply sent.');break}
    case'attDel':ST.support.att.splice(+arg,1);render();break;
    case'zoom':{const[tid,mi,ii]=arg.split(':');const x=TICKETS.find(k=>k.id===tid).thread[+mi].imgs[+ii];const z=document.createElement('div');z.className='zoom';z.setAttribute('role','dialog');z.setAttribute('aria-label','Picture');z.innerHTML=`<img src="${x.url}" alt="${esc(x.name)}"><button type="button" class="btn small">${LANG==='zh'?'关闭':'Close'}</button>`;z.onclick=()=>z.remove();document.body.appendChild(z);z.querySelector('button').focus();break}
    case'msex':ST.members.sex=arg;ST.members.page=0;render();break;
    case'ruleF':ST.ruleF=arg;render();break;
    case'unlink':TICKETS.find(x=>x.id===arg).order=null;render();break;
    case'dispute':openD('dispute',arg);break;
    case'address':openD('address',arg);break;
    case'atab':ST.addr.tab=arg;render();break;
    case'close':drawer=null;dstack=[];renderDrawer();break;
    case'page':{const s=ST[p[0]];s.page=Math.max(0,s.page+ +p[1]);render();window.scrollTo(0,0);break}
    case'creason':{const k=decodeURIComponent(arg);drawer=null;dstack=[];ST.cancel.bld=null;if(ST.view!=='cancels')setView('cancels',k);else{ST.cancel.reason=k;render();window.scrollTo(0,0)}break}
    case'cback':ST.cancel.reason=null;ST.cancel.bld=null;render();window.scrollTo(0,0);break;
    case'cbld':ST.cancel.bld=arg||null;render();if(arg)setTimeout(()=>document.getElementById('reason-orders')?.scrollIntoView({block:'start',behavior:'smooth'}),30);break;
    case'corders':Object.assign(ST.orders,ORDERS_RESET(),{reason:decodeURIComponent(arg)});setView('orders');break;
    case'rwtab':ST.rewards.tab=arg;render();break;
    case'ftab':ST.funds.tab=arg;render();break;
    case'wpay':{const w=WITHDRAWALS.find(x=>x.id===arg);if(ST.opsBalance<w.fen){toast('Not enough in the operations account.');break}w.status='paid';w.by=ST.me;w.doneAt=NOW;ST.opsBalance-=w.fen;render();toast(Y(w.fen)+' sent to the runner\'s WeChat balance.');break}
    case'wrej':{const w=WITHDRAWALS.find(x=>x.id===arg);w.status='rejected';w.by=ST.me;w.doneAt=NOW;w.reason='Rejected by staff';render();toast('Rejected. The money is back in their wallet.');break}
    case'coupon':openD('coupon',arg);break;
    case'newCoupon':openD('newCoupon','new');break;
    case'stopCoupon':CMAP[arg].stopped=true;logChange('Stopped coupon '+cName(CMAP[arg]));upd();toast('Coupon stopped.');break;
    case'sendCoupon':{const c=CMAP[arg],ids=(document.getElementById('cp-ids').value||'').split(/[\s,，]+/).map(x=>x.trim().toUpperCase()).filter(Boolean);
      let targets=ids.length?ids.map(i=>UMAP[i]).filter(Boolean):USERS.filter(u=>!u.isTest&&SEGMENTS.find(s=>s[0]===document.getElementById('cp-seg').value)[2](u,MS.get(u.id)));
      if(ids.length>100){toast('Up to 100 member IDs at a time.');break}
      const have=new Set(c.claims.map(x=>x.user));targets=targets.filter(u=>!have.has(u.id));const room=c.total-c.claims.length;targets=targets.slice(0,Math.max(0,room));
      if(!targets.length){toast(room<=0?'None left to send.':'Everyone chosen already has it.');break}
      targets.forEach(u=>c.claims.push({user:u.id,at:NOW,order:null}));logChange(`Sent ${cName(c)} to ${targets.length} members`);upd();toast(`Sent to ${targets.length} members.`);break}
    case'ncTpl':{const t=NC_TPL.find(x=>x.k===arg),f=ncDefaults();Object.assign(f,JSON.parse(JSON.stringify(t.f)),{tpl:t.k});f.to=ncDay(Date.parse(f.from+'T00:00:00+08:00')+(f.days-1)*DAY);drawer.form=f;upd();break}
    case'ncKind':drawer.form.kind=arg;if(arg==='percent'&&!drawer.form.cap){drawer.form.off='20';drawer.form.cap='5'}if(arg==='amount'){drawer.form.off='2'}drawer.form.tpl=null;upd();break;
    case'ncMin':drawer.form.min=arg;upd();break;
    case'ncType':{const T=drawer.form.types;const i2=T.indexOf(arg);if(i2>=0){if(T.length>1)T.splice(i2,1);else toast('Choose at least one order type.')}else T.push(arg);upd();break}
    case'ncHow':drawer.form.how=arg;upd();break;
    case'ncBy':drawer.form.sendBy=arg;upd();break;
    case'ncSeg':drawer.form.sendBy='group';drawer.form.seg=arg;upd();break;
    case'ncAdd':if(!drawer.form.picked.includes(arg))drawer.form.picked.push(arg);drawer.form.q='';upd();setTimeout(()=>document.getElementById('nc-q')?.focus(),0);break;
    case'ncDel':drawer.form.picked=drawer.form.picked.filter(x=>x!==arg);upd();break;
    case'ncDays':{const d=+arg,f=drawer.form;f.days=d;f.to=ncDay(Date.parse(f.from+'T00:00:00+08:00')+(d-1)*DAY);upd();break}
    case'createCoupon':{const f=drawer.form,auto=ncAuto(f),name=f.name.trim()||auto.zh,nameEn=f.nameEn.trim()||auto.en,off=+f.off,cap=+f.cap;
      const rec=f.how==='send'?ncRecipients(f):[],total=f.how==='send'?rec.length:Math.round(+f.total);
      const err=!(off>0)?'Enter the discount.':f.kind==='percent'&&off>=100?'Percent off must be under 100.':f.kind==='percent'&&!(cap>0)?'Set the most a percent coupon can take off.':!f.types.length?'Choose at least one order type.':!(f.from&&f.to&&f.to>=f.from)?'The end date must be on or after the start date.':f.how==='send'&&!rec.length?'Choose at least one member to send it to.':!(total>=1)?'Enter how many coupons.':'';
      if(err){toast(err);break}
      const cc=ncCoupon(f);
      const c={id:'C'+(COUPONS.length+1),name,nameEn,...cc,firstOnly:!!f.firstOnly,types:f.types.slice(),how:f.how,total,from:Date.parse(f.from+'T00:00:00+08:00'),to:Date.parse(f.to+'T23:59:00+08:00'),createdBy:ST.me,claims:[],stopped:false};
      if(f.how==='send')rec.forEach(u=>c.claims.push({user:u.id,at:NOW,order:null}));
      COUPONS.push(c);CMAP[c.id]=c;logChange('Created coupon '+(LANG==='zh'?name:nameEn)+(f.how==='send'?` and sent it to ${rec.length} members`:''));drawer={kind:'coupon',id:c.id};dstack=[];render();toast(f.how==='send'?`Coupon created and sent to ${rec.length} members.`:'Coupon created.');break}
    case'lang':setLang(arg);break;
    case'memReset':Object.assign(MEMBER,JSON.parse(JSON.stringify(MEMBER_DEF)));logChange('Membership rules reset to the agreed rules');refreshMembers();render();toast('Back to the agreed rules.');break;
    case'liveAll':Object.assign(ST.orders,{status:'live',page:0});setView('orders');break;
    case'clear':Object.assign(ST.orders,ORDERS_RESET());render();break;
    case'kgo':{drawer=null;
      if(p[0]==='orders'){Object.assign(ST.orders,ORDERS_RESET());const k=p[1];
        if(['posted','taken','picked','delivered','disputed'].includes(k)){ST.orders.status=k;if(ST.range==='today')ST.range='7d'}
        else if(k==='done'||k==='ended')ST.orders.status=k;
        else if(k==='slow')ST.orders.slow=true;
        else if(k==='grouped')ST.orders.grouped=true;
        setView('orders')}
      else if(p[0]==='members'){Object.assign(ST.members,{seg:p[1],tab:'members',page:0,q:''});setView('members')}
      else if(p[0]==='runners'){if(p[1]==='certified'){ST.runners.tab='apps';ST.runners.appStatus='approved';setView('runners')}else setView('runners','rank')}
      else setView(p[0],p[1]);break}
    case'seg':ST.members.seg=arg;ST.members.page=0;render();break;
    case'mtab':ST.members.tab=arg;render();break;
    case'rtab':ST.runners.tab=arg;render();break;
    case'appst':ST.runners.appStatus=arg;render();break;
    case'stab':ST.support.tab=arg;render();break;
    case'export':ST.exportLog.unshift({at:NOW,what:({orders:'Orders',members:'Members',addresses:'Saved addresses'})[arg]+' (masked), current filters',by:roleName[ST.role],rows:arg==='orders'?orderFiltered().length:arg==='addresses'?ADDRS.length:USERS.length});toast('Export logged. Downloads are off in this prototype.');break;
    case'reveal':ST.accessLog.unshift({at:NOW,by:ST.role,what:'room and phone on '+arg});drawer.reveal=true;upd();toast('Shown. This view is logged.');break;
    case'askRefund':drawer.confirm=arg;upd();break;
    case'noConfirm':drawer.confirm=null;upd();break;
    case'doRefund':{const o=OMAP[p[0]],half=p[1]==='half',m=money(o);
      o.refunds.push({fen:half?Math.round(m.paid/2):m.paid,reason:half?'Cancelled by staff after a runner took it (50% back)':'Cancelled by staff before a runner took it',at:NOW,by:roleName[ST.role]});
      o.status='cancelled';o.cancelledBy='student';o.cancelStage=half?'taken':'posted';o.cancelReason='Cancelled by staff on request';o.cancelledAt=NOW;if(!half){o.runner=null}
      drawer.confirm=null;refreshMembers();upd();toast('Refund sent through WeChat Pay.');break}
    case'note':{const v=document.getElementById('note-text').value.trim();if(!v){toast('Write the note first.');break}const obj=p[0]==='order'?OMAP[p[1]]:UMAP[p[1]];obj.notes.push({text:v,by:ST.role,at:NOW});upd();break}
    case'markTest':OMAP[arg].isTest=true;refreshMembers();upd();toast('Marked as test. Hidden from totals.');break;
    case'tag':{const u=UMAP[p[0]];const tg=p.slice(1).join(':');u.tags.has(tg)?u.tags.delete(tg):u.tags.add(tg);upd();break}
    case'goodwill':{const u=UMAP[arg];const n=+document.getElementById('gw-pts').value,r=document.getElementById('gw-reason').value.trim();
      const month0=Date.parse('2026-10-01T00:00:00+08:00');const left=MEMBER.goodwill-sum(u.goodwill.filter(g=>g.at>=month0).map(g=>g.pts));
      if(!n||n<1){toast('Enter how many points.');break}if(n>left){toast(`Only ${left} goodwill points left this month.`);break}if(!r){toast('Add a reason.');break}
      u.goodwill.push({pts:n,reason:r,by:ST.role,at:NOW});refreshMembers();upd();toast(`+${n} points given.`);break}
    case'oneNews':{const v=document.getElementById('one-news').value.trim();if(!v){toast('Write the message first.');break}const u=UMAP[arg];u.lastNews=NOW;ST.newsLog.unshift({at:NOW,seg:'One member',area:u.area,text:v,sent:1,by:roleName[ST.role]});upd();toast('Sent to 1 member.');break}
    case'newsTo':NEWS.seg=arg;setView('messages');break;
    case'tpl':NEWS.text=newsTpl()[+arg];render();break;
    case'sendNews':{const r=newsReach();if(!NEWS.text.trim()||!r.fresh.length)break;r.fresh.forEach(u=>u.lastNews=NOW);ST.newsLog.unshift({at:NOW,seg:SEGMENTS.find(s=>s[0]===NEWS.seg)[1],area:NEWS.area,text:NEWS.text.trim(),sent:r.fresh.length,by:roleName[ST.role]});const n=r.fresh.length;NEWS.text='';render();toast(`Sent to ${n} members.`);break}
    case'chk':drawer.checks=drawer.checks||{};drawer.checks[arg]=t.checked;upd();break;
    case'approve':{const ap=APPS.find(x=>x.id===arg);if(!appOk(ap)){toast('An automatic check failed. Open Details to fix or reject.');break}ap.status='approved';ap.checkedBy=ST.me;ap.checkedAt=NOW;const u=UMAP[ap.user];u.certified=true;u.certAt=NOW;refreshMembers();if(drawer&&drawer.kind==='app')nextApp('Approved. They can take jobs now.');else{render();toast(UMAP[ap.user].nick+' approved. They can take jobs now.')}break}
    case'reject':{const ap=APPS.find(x=>x.id===arg);ap.status='rejected';ap.reason=document.getElementById('rej-reason').value;ap.checkedBy=ST.me;ap.checkedAt=NOW;nextApp('Rejected. The student is told why and can apply again.');break}
    case'approveAny':{const ap=APPS.find(x=>x.id===arg);ap.status='approved';ap.checkedBy=ST.me;ap.checkedAt=NOW;ap.override=true;const u=UMAP[ap.user];u.certified=true;u.certAt=NOW;refreshMembers();logChange('Approved '+u.id+' although an automatic check failed');
      if(drawer&&drawer.kind==='app')nextApp('Approved anyway.');else{render();toast(u.nick+' approved anyway.')}break}
    case'askFix':{const ap=APPS.find(x=>x.id===arg);ap.askedAt=NOW;upd();toast('Message sent asking them to correct their details.');break}
    case'revoke':{const ap=APPS.find(x=>x.id===arg);ap.status='revoked';ap.reason='Revoked by staff';ap.checkedBy=ST.me;ap.checkedAt=NOW;UMAP[ap.user].certified=false;refreshMembers();upd();toast('Certification revoked.');break}
    case'rmMark':{const i=MARKS.findIndex(m=>m.id===arg);const r=MARKS[i].runner;MARKS.splice(i,1);if(MARKS.filter(m=>m.runner===r&&m.expiresAt>NOW).length<5)delete PAUSED[r];upd();toast('Mark removed.');break}
    case'addMark':{MARKS.push({id:'M'+Date.now(),runner:arg,rule:document.getElementById('mark-rule').value,givenAt:NOW,expiresAt:NOW+cfg('markExpiryDays')*DAY,by:roleName[ST.role]});
      const n=MARKS.filter(m=>m.runner===arg&&m.expiresAt>NOW).length;if(n>=5)PAUSED[arg]=NOW+7*DAY;upd();toast(n>=5?'Mark given. Runner paused for 7 days.':n>=3?'Mark given. Runner is back to New.':'Mark given.');break}
    case'reply':{const tk=TICKETS.find(x=>x.id===arg);const v=document.getElementById('reply-text').value.trim();if(!v){toast('Write a reply first.');break}tk.thread.push({from:'staff',text:v,at:NOW});if(!tk.firstReplyAt)tk.firstReplyAt=NOW;upd();toast('Reply sent.');break}
    case'resolve':{const tk=TICKETS.find(x=>x.id===arg);tk.status='resolved';upd();toast('Resolved.');break}
    case'reopen':TICKETS.find(x=>x.id===arg).status='open';upd();break;
    case'uphold':case'rejectDsp':{const o=OMAP[arg];const reason=document.getElementById('dsp-reason').value.trim();if(!reason){toast('Add a reason for both sides.');break}
      if(a==='uphold'){const amt=Math.round(+document.getElementById('dsp-amt').value*100);const max=o.fee+o.offerRaised;if(!(amt>0&&amt<=max)){toast('Refund must be between ¥0.01 and '+Y(max)+'.');break}
        o.refunds.push({fen:amt,reason:'Dispute upheld: '+o.dispute.type,at:NOW,by:roleName[ST.role]});o.dispute.status='upheld';o.status=amt>=max?'refunded':'confirmed';if(amt<max){o.confirmedAt=NOW;o.confirmedBy='after review'}}
      else{o.dispute.status='rejected';o.status='confirmed';o.confirmedAt=NOW;o.confirmedBy='after review'}
      o.dispute.decidedAt=NOW;o.dispute.note=reason;upd();toast('Decision sent to the student and runner.');break}
    case'addPickup':PICKUPS.push({id:'P'+PICKUPS.length,name:'New pickup point',kind:'Gate',active:false});PU[PICKUPS[PICKUPS.length-1].id]=PICKUPS[PICKUPS.length-1];logChange('Added a pickup point');render();break;
  }});
const ORDERS_RESET=()=>({q:'',reason:'all',status:'all',pickup:'all',cancelBy:'all',settle:'all',feeMin:'',feeMax:'',slow:false,complaint:false,grouped:false,page:0});
function nextApp(msg){const Q=queue();if(Q.length){drawer={kind:'app',id:Q[0].id};dstack=[];render();toast(msg+' Next one opened.')}else{drawer=null;dstack=[];render();toast(msg+' Queue is empty.')}}
function addPics(files){
  const imgs=files.filter(f=>/^image\//.test(f.type));if(!imgs.length){toast('Only pictures can be added.');return}
  const room=6-(ST.support.att||[]).length;if(room<=0){toast('Up to 6 pictures per message.');return}
  const big=imgs.filter(f=>f.size>10*1024*1024);if(big.length)toast('Pictures must be under 10 MB.');
  const ok=imgs.filter(f=>f.size<=10*1024*1024).slice(0,room);if(imgs.length-big.length>room)toast('Up to 6 pictures per message.');
  ok.forEach(f=>{const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const k=Math.min(1,1280/Math.max(im.width,im.height));let url=r.result;
    if(k<1||f.size>600*1024){const c=document.createElement('canvas');c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);c.getContext('2d').drawImage(im,0,0,c.width,c.height);url=c.toDataURL('image/jpeg',.85)}
    (ST.support.att=ST.support.att||[]).push({url,name:f.name||'picture'});const d=document.getElementById('s-reply');if(d)ST.support.draft=d.value;render();setTimeout(()=>document.getElementById('s-reply')?.focus(),0)};im.onerror=()=>toast('That picture could not be opened.');im.src=r.result};r.readAsDataURL(f)})}
document.addEventListener('paste',e=>{if(e.target.id!=='s-reply'||!can('reply'))return;const fs=[...(e.clipboardData?.files||[])].filter(f=>/^image\//.test(f.type));if(fs.length){e.preventDefault();addPics(fs)}});
function scrollChat(){setTimeout(()=>{const m=document.getElementById('ib-msgs');if(m)m.scrollTop=m.scrollHeight},0)}
function logChange(what){ST.changeLog.unshift({at:NOW,by:ST.role,what})}
document.addEventListener('change',e=>{
  const t=e.target,id=t.id;
  if(id==='f-area'){ST.area=t.value;ST.orders.page=ST.members.page=0;upd()}
  else if(id==='f-type'){ST.type=t.value;ST.orders.page=0;upd()}
  else if(id==='f-test'){ST.showTest=t.checked;SHOW_TEST=t.checked;refreshMembers();upd()}
  else if(id==='me'){ST.me=t.value;toast('Decisions are now saved as '+t.value+'.')}
  else if(id==='role'){ST.role=t.value;upd();toast('Now viewing as '+roleName[ST.role]+'.')}
  else if(id.startsWith('o-')){const k=id.slice(2);if(t.type==='checkbox')ST.orders[k]=t.checked;else if(k!=='q'&&k!=='feeMin'&&k!=='feeMax')ST.orders[k]=t.value;ST.orders.page=0;if(t.type!=='search'&&k!=='feeMin'&&k!=='feeMax')render()}
  else if(id==='a-bld'){ST.addr.bld=t.value;ST.addr.page=0;render()}
  else if(id==='a-noRoom'||id==='a-noLocker'){ST.addr[id.slice(2)]=t.checked;ST.addr.page=0;render()}
  else if(id.startsWith('lk-')){const b=BLD[id.slice(3)];const v=t.value.trim();if(v===b.lockerLoc)return;logChange(`Food locker for ${b.name}: ${v||'cleared'}`);b.lockerLoc=v;render();toast(v?'Locker location saved for '+b.name+'.':'Locker location cleared.')}
  else if(id==='ops-bal'){const v=Math.round(+t.value*100);if(isNaN(v)||v<0){toast('Enter the balance in yuan.');return}ST.opsBalance=v;render()}
  else if(id.startsWith('nc-')&&drawer&&drawer.kind==='newCoupon'){const f=drawer.form,k=id.slice(3);
    if(k==='ids'){const ids=t.value.split(/[\s,，]+/).map(x=>x.trim().toUpperCase()).filter(Boolean),ok=ids.filter(i=>UMAP[i]&&!UMAP[i].isTest),bad=ids.length-ok.length;ok.forEach(i=>{if(!f.picked.includes(i))f.picked.push(i)});upd();if(bad)toast(`${bad} ID${bad>1?'s':''} not found.`);return}
    if(k==='first')f.firstOnly=t.checked;else if(k==='area')f.area=t.value;else if(k==='name')f.name=t.value;else if(k==='name-en')f.nameEn=t.value;
    else if(k==='from'||k==='to'){f[k]=t.value;f.days=null}else if(['off','cap','min','total'].includes(k))f[k]=t.value;
    f.tpl=k==='name'||k==='name-en'||k==='area'?f.tpl:null;upd()}
  else if(id==='m-sort'){ST.members.sort=t.value;render()}
  else if(id==='s-link'&&t.value){const tk=TICKETS.find(x=>x.id===ST.support.sel);tk.order=t.value;render();toast('Order linked.')}
  else if(id==='n-seg'){NEWS.seg=t.value;render()}
  else if(id==='n-area'){NEWS.area=t.value;render()}
  else if(id.startsWith('cfg-')){const c=ST.config.find(x=>x.k===id.slice(4));const v=+t.value;if(isNaN(v)||v<0){t.value=c.v;toast('Use a number of 0 or more.');return}logChange(`${c.label}: ${c.v} → ${v} ${c.unit}`);c.v=v;render();toast('Saved. Members are told 14 days ahead if it affects them.')}
  else if(id.startsWith('mem-')){const k=id.slice(4),label=MEM_LABEL[k];
    if(typeof MEMBER[k]==='boolean'){MEMBER[k]=t.checked;logChange(label+': '+(t.checked?'on':'off'));refreshMembers();render();toast('Saved. Members are told 14 days ahead.');return}
    const step=['silverCouponOff','goldCouponOff','couponMinFee'].includes(k)?0.5:1,v=step===1?Math.round(+t.value):Math.round(+t.value*2)/2;if(isNaN(v)||v<0){t.value=MEMBER[k];toast('Use a number of 0 or more.');return}
    if(k==='useRate'&&v>100){t.value=MEMBER[k];toast('Use a number from 0 to 100.');return}
    if(k==='silver'&&v>=MEMBER.gold||k==='gold'&&v<=MEMBER.silver){t.value=MEMBER[k];toast('Gold must need more points than Silver.');return}
    if(v===MEMBER[k])return;logChange(`${label}: ${MEMBER[k]} → ${v}`);MEMBER[k]=v;refreshMembers();render();toast('Saved. Members are told 14 days ahead.')}
  else if(id.startsWith('goal-')){const g=ST.goals.find(x=>x.k===id.slice(5));const v=+t.value;if(isNaN(v)||v<0){t.value=g.v;return}logChange(`Goal for ${g.label}: ${g.v} → ${v}`);g.v=v;render();toast('Goal saved.')}
  else if(id.startsWith('cfgon-')){const c=ST.config.find(x=>x.k===id.slice(6));c.on=t.checked;logChange(`${c.label} turned ${c.on?'on':'off'}`);render();toast(c.on?'Rule turned on.':'Rule turned off. It is kept here; turn it on any time.')}
  else if(id.startsWith('cfgph-')){const c=ST.config.find(x=>x.k===id.slice(6));logChange(`${c.label}: ${PHASES[c.ph]} → ${PHASES[t.value]}`);c.ph=t.value;render()}
  else if(id==='feat-tasks'){ST.features.tasks=t.checked;logChange('Post any task '+(t.checked?'on':'off'));render()}
  else if(id.startsWith('pua-')){PU[id.slice(4)].active=t.checked;logChange(`${PU[id.slice(4)].name} ${t.checked?'shown':'hidden'} in app`);render()}
  else if(id.startsWith('pu-')){const pp=PU[id.slice(3)];const v=t.value.trim();if(!v){t.value=pp.name;return}logChange(`Pickup renamed: ${pp.name} → ${v}`);pp.name=v;render()}
  else if(id.startsWith('bg-')){BLD[id.slice(3)].gender=t.value;logChange(`${BLD[id.slice(3)].name} set to ${t.value}`);render()}
  else if(id==='s-file'&&t.files.length){addPics([...t.files]);t.value=''}
  else if(id==='qr-file'&&t.files[0]){const r=new FileReader();r.onload=()=>{ST.qr={uploadedAt:NOW,img:r.result};logChange('Uploaded a new group QR code');render();toast('New group code is live for 7 days.')};r.readAsDataURL(t.files[0])}
});
let qT;
document.addEventListener('input',e=>{const t=e.target;
  if(t.id==='o-q'||t.id==='o-feeMin'||t.id==='o-feeMax'){ST.orders[t.id.slice(2)]=t.value;ST.orders.page=0;clearTimeout(qT);qT=setTimeout(()=>{render();const el=document.getElementById(t.id);if(el){el.focus();const n=el.value.length;try{el.setSelectionRange(n,n)}catch(_){}}},250)}
  else if(t.id==='s-reply'){ST.support.draft=t.value}
  else if(t.id==='s-q'){ST.support.q=t.value;clearTimeout(qT);qT=setTimeout(()=>{render();const el=document.getElementById('s-q');el.focus();el.setSelectionRange(el.value.length,el.value.length)},250)}
  else if(t.id==='nc-q'&&drawer&&drawer.kind==='newCoupon'){drawer.form.q=t.value;clearTimeout(qT);qT=setTimeout(()=>{upd();const el=document.getElementById('nc-q');if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length)}},250)}
  else if(t.id==='a-q'){ST.addr.q=t.value;ST.addr.page=0;clearTimeout(qT);qT=setTimeout(()=>{render();const el=document.getElementById('a-q');el.focus();el.setSelectionRange(el.value.length,el.value.length)},250)}
  else if(t.id==='m-q'){ST.members.q=t.value;ST.members.page=0;clearTimeout(qT);qT=setTimeout(()=>{render();const el=document.getElementById('m-q');el.focus();el.setSelectionRange(el.value.length,el.value.length)},250)}
  else if(t.id==='n-text'){NEWS.text=t.value;clearTimeout(qT);qT=setTimeout(()=>{render();const el=document.getElementById('n-text');el.focus();el.setSelectionRange(el.value.length,el.value.length)},350)}});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){const z=document.querySelector('.zoom');if(z){z.remove();return}}
  if(e.target.id==='s-reply'&&e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();document.querySelector('[data-act^="send:"]')?.click();return}if(e.key==='Escape'&&drawer){drawer=null;dstack=[];renderDrawer()}
  if((e.key==='Enter'||e.key===' ')&&e.target.matches('tr.click')){e.preventDefault();e.target.click()}});
// tooltip
const tip=document.getElementById('tip');
document.addEventListener('pointermove',e=>{const t=e.target.closest?.('[data-tip]');if(!t){tip.hidden=true;return}tip.innerHTML=t.getAttribute('data-tip');trDom(tip);tip.hidden=false;
  const w=tip.offsetWidth,h=tip.offsetHeight;let x=e.clientX+14,y=e.clientY-h-10;if(x+w>innerWidth-8)x=e.clientX-w-14;if(y<8)y=e.clientY+16;tip.style.left=x+'px';tip.style.top=y+'px'});
document.addEventListener('pointerleave',()=>tip.hidden=true);
// make table rows keyboard reachable
new MutationObserver(()=>document.querySelectorAll('tr.click:not([tabindex])').forEach(r=>r.tabIndex=0)).observe(document.body,{childList:true,subtree:true});

let lastW=innerWidth,rzT;addEventListener('resize',()=>{clearTimeout(rzT);rzT=setTimeout(()=>{if(Math.abs(innerWidth-lastW)>40&&ST.view==='overview'){lastW=innerWidth;render()}},200)});
document.documentElement.lang=LANG==='zh'?'zh-CN':'en';
/* boot */
{const h=(location.hash||'').slice(1);if(VIEWS.some(v=>v[0]===h))ST.view=h}
// Boot is owned by connection.js; never show generated sample data before choosing preview.
