const assert=require('node:assert/strict'),fs=require('node:fs');
global.wx={getStorageSync:()=>null,setStorageSync(){},showToast(){},showModal(){},setNavigationBarTitle(){},reLaunch(){},navigateTo(){}};
const {harness}=require('./helpers/order-cloud');
const domain=require('../cloudfunctions/orderService/domain');
const cancelUi=require('../utils/customer-cancel');
const store=require('../utils/store');
const yuni=require('../utils/yuni-events');

assert.equal(domain.CUSTOMER_CANCEL_MS,180000);
assert.equal(cancelUi.WINDOW_MS,domain.CUSTOMER_CANCEL_MS);
const takenAt=1_000_000;
const taken={status:'taken',collected:[],takenAt,runnerId:'t'};
assert.equal(domain.customerCanCancel(taken,takenAt+179999),true);
assert.equal(domain.customerCanCancel(taken,takenAt+180000),false,'the window closes at exactly 3 minutes');
assert.equal(domain.customerCanCancel(taken,takenAt+180001),false,'the window closes after 3 minutes');
assert.equal(domain.customerCanCancel({status:'waiting',runnerId:null,collected:[]},takenAt+999999),true);
assert.equal(domain.customerCanCancel({status:'taken',collected:['box'],takenAt},takenAt+1000),true,'pickup does not shorten the 3-minute window');
assert.equal(domain.customerCanCancel({status:'collected',collected:[],takenAt},takenAt+1000),true);

const open=cancelUi.view({isMine:true,status:'waiting',collected:[]},false,takenAt);
assert.equal(open.phase,'open');assert.equal(open.canCancel,true);
assert.equal(open.tip,'Cancel anytime before acceptance, or within 3 minutes after a runner accepts. After 3 minutes, cancellation is unavailable.');
const grace=cancelUi.view({isMine:true,status:'taken',collected:[],takenAt},false,takenAt);
assert.equal(grace.phase,'grace');assert.equal(grace.clock,'3:00');
assert.equal(grace.tip,'Cancellation is available only within 3 minutes of acceptance. Time left: 3:00.');
const ended=cancelUi.view({isMine:true,status:'taken',collected:[],takenAt},false,takenAt+180001);
assert.equal(ended.phase,'ended');assert.equal(ended.canCancel,false);
assert.equal(ended.tip,'It has been 3 minutes since acceptance. This order can no longer be cancelled.');
assert.equal(cancelUi.view({isMine:false,status:'waiting'},false).phase,'hidden');
assert.equal(cancelUi.runnerLabel({runnerName:'Alex'},false),'Alex');
assert.equal(cancelUi.runnerLabel({runnerName:''},false),'Runner');

store.update(s=>{s.language='en';s.yuniTips=true;});
yuni.reset();
const notices=[];const stop=yuni.subscribe(event=>notices.push(event));
yuni.status({id:'back',isMine:true,status:'waiting',cancellation:{reason:'missing'}},1);
yuni.next();
yuni.status({id:'fresh',isMine:true,status:'waiting'},2);
yuni.next();
yuni.status({id:'refund',isMine:true,status:'refunded'},3);
yuni.next();
yuni.status({id:'gone',isMine:true,status:'cancelled'},4);
assert.equal(notices.length,3,'a brand-new waiting order does not notify');
assert.equal(notices[0].title,'Order still active');
assert.doesNotMatch(notices[0].title,/cancelled/i);
assert.doesNotMatch(notices[0].text,/Order cancelled/);
assert.equal(notices[1].title,'No runner · refunded');
assert.notEqual(notices[1].title,'Order cancelled');
assert.equal(notices[2].title,'Order cancelled');
stop();

const h=harness(),phone='13801026092';
const food={category:'takeout',owner:'Customer',phone,station:'North gate',dorm:'Dorm 7',room:'412',bags:1,price:4,arrived:true};
const task={category:'task',title:'Return two books to the library',price:5,dueAt:Date.now()+3600000,owner:'Customer',phone};
const parcel={category:'parcel',station:'North gate',dorm:'Dorm 7',room:'412',phone,owner:'Customer',parcelItems:[{size:'small',code:'11-1-1111'}],tip:0};
const night={...food,night:true,shop:'East gate stall'};

(async()=>{
  async function create(data){const r=await h.call('customer','create',{data});assert.equal(r.ok,true,r.error);return r.value.id;}
  async function accept(id){const r=await h.call('runner','accept',{ids:[id]});assert.equal(r.ok,true,r.error);return r;}
  const waiting=await create(food);
  assert.equal((await h.call('customer','cancel',{id:waiting,reason:'Changed my mind'})).ok,true);
  assert.equal(h.state.requests.find(r=>r.id===waiting).status,'cancelled');

  for(const sample of [food,task,parcel,night]){
    const id=await create(sample);
    await accept(id);
    const row=h.state.requests.find(r=>r.id===id);
    assert.equal(row.status,'taken');
    h.edit(s=>{s.requests.find(r=>r.id===id).takenAt=Date.now()-60*1000;});
    const raised=await h.call('customer','raise',{id,amount:1.25});
    assert.equal(raised.ok,true,raised.error);
    assert.equal(h.state.requests.find(r=>r.id===id).reward,Math.round((row.reward+1.25)*100)/100);
    const early=await h.call('customer','cancel',{id,reason:'Runner too slow to pick up'});
    assert.equal(early.ok,true,sample.category+' '+early.error);
    const saved=h.state.requests.find(r=>r.id===id);
    assert.equal(saved.status,'cancelled');
    assert.equal(saved.cancelReason,'Runner too slow to pick up');
    assert.ok(!h.state.trips.some(t=>(t.requestIds||[]).includes(id)),'a real cancel leaves the runner trip');
  }

  const late=await create(parcel);
  await accept(late);
  h.edit(s=>{s.requests.find(r=>r.id===late).takenAt=Date.now()-181000;});
  const denied=await h.call('customer','cancel',{id:late});
  assert.equal(denied.ok,false);
  assert.match(denied.error,/Cancel window ended/);
  assert.equal(h.state.requests.find(r=>r.id===late).status,'taken');

  const picked=await create(food);
  await accept(picked);
  h.edit(s=>{const r=s.requests.find(x=>x.id===picked);r.collected=['bag'];r.takenAt=Date.now();});
  assert.equal((await h.call('customer','cancel',{id:picked,reason:'Collected it myself'})).ok,true);
  assert.equal(h.state.requests.find(r=>r.id===picked).status,'cancelled');

  const ghost=await create(parcel);
  await accept(ghost);
  h.edit(s=>{const r=s.requests.find(x=>x.id===ghost);r.closesAt=Date.now()-5000;r.takenAt=Date.now()-60000;});
  const returned=await h.call('runner','runnerCancel',{id:ghost,reason:'missing'});
  assert.equal(returned.ok,true,returned.error);
  const back=h.state.requests.find(r=>r.id===ghost);
  assert.equal(back.status,'waiting','returning a parcel is not a cancellation');
  assert.ok(back.closesAt>Date.now(),'an elapsed close time does not refund the order on return');
  assert.match(back.history.at(-1).label,/Returned to the board/);
  const mine=(await h.call('customer','sync')).snapshot.requests.find(r=>r.id===ghost);
  assert.equal(mine.isMine,true);
  assert.equal(mine.status,'waiting');
  assert.ok(!['confirmed','cancelled','refunded'].includes(mine.status));

  const stuck=await create(food);
  await accept(stuck);
  h.edit(s=>{const r=s.requests.find(x=>x.id===stuck);const t=s.trips.find(x=>x.id===r.runnerId);r.runnerId=null;if(!t.requestIds.includes(stuck))t.requestIds.push(stuck);});
  const runnerView=await h.call('runner','sync');
  assert.ok(runnerView.snapshot.requests.some(r=>r.id===stuck),'an active order referenced by the trip stays in the runner snapshot');

  const named=await create(task);
  await accept(named);
  const customer=(await h.call('customer','sync')).snapshot.requests.find(r=>r.id===named);
  assert.equal(customer.runnerName,'runner');

  store.reset();store.update(s=>{s.language='en';s.profile={...s.profile,accountId:'me',name:'Customer',jobsDone:0};s.requests=[{id:'t1',isMine:true,ownerId:'me',status:'taken',category:'task',title:'Carry books',reward:6,runnerId:'trip',runnerName:'Alex',runnerPhone:'13801026092',takenAt:Date.now(),collected:[],history:[],orderPictures:[],serviceFee:0,discount:0}];});
  let def;global.Page=x=>def=x;
  delete require.cache[require.resolve('../pages/task/index')];
  require('../pages/task/index');
  const page={...def,data:structuredClone(def.data),setData(v){Object.assign(this.data,v);}};
  page.onLoad({id:'t1'});page.refresh();
  assert.equal(page.data.request.contactName,'Alex');
  assert.equal(page.data.request.statusTitle,'Alex took this task');
  assert.equal(page.data.cancelWindow.phase,'grace');
  assert.doesNotMatch(fs.readFileSync(require.resolve('../pages/task/index.js'),'utf8'),/profile\.name/);
  const taskXml=fs.readFileSync(require.resolve('../pages/task/index.wxml'),'utf8');
  assert.ok(taskXml.indexOf('order-progress-card')<taskXml.indexOf('flow-title'));
  assert.doesNotMatch(taskXml,/offer-custom-input/);
  for(const name of ['task','request']){
    const xml=fs.readFileSync('pages/'+name+'/index.wxml','utf8');
    assert.match(xml,/<button wx:if="{{cancelWindow.canCancel}}"[^>]*bindtap="cancel"/);
  }
  for(const category of ['takeout','parcel','task'])for(const status of ['taken','collected']){
    const row={...taken,category,status,isMine:true};
    for(const offset of [0,179999,180000,180001]){
      const expected=offset<180000;
      assert.equal(domain.customerCanCancel(row,takenAt+offset),expected);
      assert.equal(require('../utils/domain').customerCanCancel(row,takenAt+offset),expected);
      assert.equal(cancelUi.view(row,true,takenAt+offset).canCancel,expected);
    }
  }

  const chat=fs.readFileSync(require.resolve('../pages/chat/index.wxml'),'utf8');
  assert.match(chat,/data-source="album"[^>]*bindtap="sendPhoto"/);
  assert.match(chat,/data-source="camera"[^>]*bindtap="sendPhoto"/);
  assert.doesNotMatch(chat,/class="chat-call"/);
  assert.doesNotMatch(fs.readFileSync(require.resolve('../pages/profile/index.wxml'),'utf8'),/bindchange="tipToggle"/);
  assert.doesNotMatch(fs.readFileSync(require.resolve('../pages/rewards/index.wxml'),'utf8'),/>\s*EDIT\s*</);
  assert.match(fs.readFileSync(require.resolve('../utils/post-copy.js'),'utf8'),/your deadline for the task/);
  const jobs=fs.readFileSync(require.resolve('../pages/jobs/index.wxml'),'utf8');
  assert.doesNotMatch(jobs,/class="hall-locker"/);
  assert.match(jobs,/!\(tab==='open' && item\.category==='task'\)/);

  let check;global.Page=x=>check=x;
  delete require.cache[require.resolve('../pages/student-check/index')];
  require('../pages/student-check/index');
  store.update(s=>{s.requests.push({id:'open-job',status:'waiting',reward:3,category:'parcel',station:'North gate',dorm:'D01',room:'101'});});
  const applyPage={...check,data:structuredClone(check.data),setData(v){Object.assign(this.data,v);}};
  applyPage.setData({zh:false});
  assert.doesNotThrow(()=>applyPage.apply({id:'acct',profile:{name:'Ada'},verification:{status:'unverified'},runnerRulesAccepted:false}));
  assert.equal(applyPage.data.suggestion.pickupLabel,'North gate');
  cancelUi.stop(page);
  console.log('Customer cancel window, ghost-cancel visibility, runner name, chat photos and hall cleanup passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
