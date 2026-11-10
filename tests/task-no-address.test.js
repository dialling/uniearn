const assert=require('node:assert/strict'),engine=require('../cloudfunctions/orderService/engine');
const now=Date.now(),customer=engine.idFor('no-address'),runner=engine.idFor('runner-task'),account={profile:{name:'',phone:'',campusId:'sip',universityId:'xjtlu'}},runnerAccount={profile:{name:'Runner',phone:'13801026092',campusId:'sip',universityId:'xjtlu'},verification:{status:'verified'},runnerRulesAcceptedAt:1};let state=engine.initial();
function act(actor,account,action,data){const working=structuredClone(state),value=engine.execute(working,actor,account,{action,...data},now);state=working;return value;}
const title='Return 2 books at the library front desk on the ground floor';
const task=act(customer,account,'create',{data:{category:'task',title,price:5,owner:'Student',phone:'',dorm:'',room:''}});const id=task.id;assert.equal(state.requests[0].dorm,'');assert.equal(state.requests[0].room,'');assert.equal(state.requests[0].title,title);assert.equal(state.requests[0].dueAt,0);assert.equal(state.requests[0].closesAt,0);engine.expire(state,now+30*86400000);assert.equal(state.requests[0].status,'waiting','a task without a deadline does not auto-close');assert.equal(engine.snapshot(state,customer,account,now).requests[0].isMine,true);
act(runner,runnerAccount,'accept',{ids:[id]});assert.equal(engine.snapshot(state,runner,runnerAccount,now).requests[0].title,title);act(runner,runnerAccount,'taskDone',{id,photo:'cloud://test/order-photos/'+runner+'/'+'a'.repeat(32)+'.jpg',note:'Returned at the library front desk.'});act(customer,account,'confirm',{id});assert.equal(state.requests[0].status,'confirmed');assert.equal(engine.snapshot(state,runner,runnerAccount,now).stats.paid,5);assert.ok(!('onTime' in engine.snapshot(state,runner,runnerAccount,now).stats));
const textOnly=act(customer,account,'create',{data:{category:'task',title:'Text only completion test',price:3}}).id;
act(runner,runnerAccount,'accept',{ids:[textOnly]});
assert.throws(()=>act(runner,runnerAccount,'taskDone',{id:textOnly,note:'x'.repeat(501)}),/500/);
act(runner,runnerAccount,'taskDone',{id:textOnly,note:'已完成任务'});
const delivered=engine.snapshot(state,customer,account,now).requests.find(r=>r.id===textOnly);
assert.equal(delivered.photo,'');
assert.equal(delivered.completionNote,'已完成任务');
assert.equal(delivered.status,'delivered');
act(customer,account,'confirm',{id:textOnly});
assert.equal(state.requests.find(r=>r.id===textOnly).status,'confirmed');
for(const count of [0,1,3]){
 const id=act(customer,account,'create',{data:{category:'task',title:'Optional completion evidence',price:3}}).id;
 act(runner,runnerAccount,'accept',{ids:[id]});
 const photos=Array.from({length:count},(_,i)=>'cloud://test/order-photos/'+runner+'/'+String(i).repeat(32)+'.jpg');
 assert.throws(()=>act(runner,runnerAccount,'taskDone',{id,photos:Array(4).fill(photos[0]||'invalid')}),/three/);
 assert.throws(()=>act(runner,runnerAccount,'taskDone',{id,photos:['cloud://test/order-photos/'+customer+'/'+'a'.repeat(32)+'.jpg']}),/photo|upload/i);
 act(runner,runnerAccount,'taskDone',{id,photos,note:count===1?'好':'  '});
 const row=engine.snapshot(state,customer,account,now).requests.find(r=>r.id===id);
 assert.equal(row.status,'delivered');assert.deepEqual(row.completionPhotos,photos);assert.equal(row.photo,photos[0]||'');
 assert.equal(row.completionNote,count===1?'好':'');
 act(customer,account,'confirm',{id});
}
const legacy=act(customer,account,'create',{data:{category:'task',title,price:3,dueAt:now+3600000}});engine.expire(state,now+7200000);assert.equal(state.requests.find(r=>r.id===legacy.id).status,'refunded','previous clients with explicit deadlines retain their expiry');
assert.throws(()=>act(customer,account,'create',{data:{category:'takeout',owner:'Student',phone:'',dorm:'',room:'',station:'North gate',bags:1,price:4,arrived:true}}),/dorm|room|phone|delivery/i,'takeaway still needs its delivery details');
let def,navigation,payload;global.Page=x=>def=x;global.wx={getStorageSync:()=>null,setStorageSync(){},redirectTo:x=>navigation=x.url,navigateTo:x=>navigation=x.url};const store=require('../utils/store'),orders=require('../utils/orders');store.reset();store.update(s=>{s.profile={...s.profile,onboarded:true,name:'',phone:'',dorm:'',room:''};});require('../pages/task-post/index');const page={...def,data:structuredClone(def.data),setData(v){Object.assign(this.data,v);}};page.onLoad();page.setData({title,agreed:true});page.setDeadlineMode({currentTarget:{dataset:{mode:'none'}}});orders.act=async(action,args)=>{payload=args.data;return{id:'task-posted'};};(async()=>{await page.post();assert.equal(payload.dorm,'');assert.equal(payload.room,'');assert.equal(payload.phone,'');assert.equal(payload.title,title);assert.equal(Object.hasOwn(payload,'dueAt'),false);assert.equal(navigation,'/pages/task/index?id=task-posted');console.log('Task without profile address/phone: front-end publishing and cloud accept/proof/confirmation passed; takeaway validation retained');})().catch(e=>{console.error(e);process.exitCode=1;});
