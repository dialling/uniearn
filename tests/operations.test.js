const assert=require('node:assert/strict'),auth=require('../cloudfunctions/newsService/auth'),makeRepo=require('../cloudfunctions/newsService/operations-repo'),{handleOperations,validatePromotions}=require('../cloudfunctions/newsService/operations'),{createHttpHandler}=require('../cloudfunctions/newsService/http');
(async()=>{
 const store={uniearn_news:{},uniearn_accounts:{},uniearn_order_state:{},uniearn_order_archive:{}};let queue=Promise.resolve(),at=Date.now();
 const copy=structuredClone;
 const matches=(v,q)=>Object.entries(q).every(([k,expected])=>{const value=k.split('.').reduce((x,p)=>x?.[p],v);return expected?.exists!==undefined?(value!==undefined)===expected.exists:expected?.in?expected.in.includes(value):value===expected;});
 function collection(name){const data=store[name]||(store[name]={});return {
  doc:id=>({get:async()=>{if(!data[id])throw Error('not found');return {data:{...copy(data[id]),_id:id}};},set:async({data:value})=>{data[id]=copy(value);},update:async({data:value})=>{assert(data[id]);Object.assign(data[id],copy(value));}}),
  where:q=>query(q),count:async()=>({total:Object.keys(data).length}),orderBy:(k,dir)=>query({}).orderBy(k,dir)
 };function query(q){let offset=0,n=100,sort;const x={skip:v=>(offset=v,x),limit:v=>(n=v,x),orderBy:(k,dir)=>(sort=[k,dir],x),count:async()=>({total:Object.values(data).filter(v=>matches(v,q)).length}),get:async()=>{let rows=Object.entries(data).map(([id,v])=>({...copy(v),_id:id})).filter(v=>matches(v,q));if(sort)rows.sort((a,b)=>(a[sort[0]]>b[sort[0]]?1:-1)*(sort[1]==='desc'?-1:1));return {data:rows.slice(offset,offset+n)};}};return x;}}
 const db={collection,command:{exists:v=>({exists:v}),set:v=>v,in:v=>({in:v})},runTransaction:fn=>{const p=queue.then(()=>fn(db));queue=p.catch(()=>{});return p;}};
 const repo={...makeRepo(db),getAdmin:async()=>({...store.uniearn_news.admin,_id:'admin'})};
 const owner=await auth.createAdmin('owner','Test-owner-password');store.uniearn_news.admin=owner;
 const ownerToken=auth.mintToken(owner,at);const handler=createHttpHandler({repo,cloud:{},settings:{allowedOrigins:['https://test.example']},now:()=>at});
 const http=async(action,input={},token=ownerToken)=>{const r=await handler({httpMethod:'POST',headers:{origin:'https://test.example',authorization:'Bearer '+token},body:JSON.stringify({action,...input})});return {...r,data:JSON.parse(r.body)};};
 const id='a'.repeat(64),other='b'.repeat(64);store.uniearn_accounts[id]={profile:{name:'张三',phone:'13812345678'},verification:{status:'pending',realName:'张三',studentId:'12345678',phone:'13812345678',submittedAt:123}};
 store.uniearn_order_state['team-test']={requests:[{id:'r1',ownerId:id,reward:8,serviceFee:1,status:'waiting',phone:'13812345678',room:'Secret address'}],members:{[id]:{supportTickets:[{id:'support-1',status:'open',createdAt:100,messages:[{text:'请帮助',mine:true,at:100}]}]}},revision:1};
 let r=await http('opsUsers');assert.equal(r.statusCode,200);assert.equal(r.data.items[0].phone,'138****5678');assert(!r.body.includes('13812345678'));assert(!r.body.includes('12345678'));assert(!r.body.includes('张三'));
 r=await http('opsOverview');assert.equal(r.data.counts.users,1);assert.equal(r.data.orders.orderAmount,9);assert.equal(r.data.payment.revenue,null);assert.equal(r.data.payment.connected,false);
 r=await http('opsOrders');assert(!r.body.includes('Secret address'));assert(!r.body.includes('13812345678'));
 assert.equal((await http('opsReveal',{id,reason:'短'})).statusCode,409);
 r=await http('opsReveal',{id,reason:'核实认证申请'});assert.equal(r.data.profile.phone,'13812345678');assert((await repo.audits(0)).items.some(x=>x.action==='opsReveal'));
 assert.equal((await http('opsReview',{id,submittedAt:124,decision:'approve'})).statusCode,409);
 store.uniearn_accounts[other]={verification:{studentId:'12345678',status:'verified'}};store.uniearn_accounts['student-'+auth.hash('12345678')]={ownerId:other};
 assert.equal((await http('opsReview',{id,submittedAt:123,decision:'approve'})).statusCode,409);delete store.uniearn_accounts[other];
 const reviews=await Promise.all([http('opsReview',{id,submittedAt:123,decision:'approve'}),http('opsReview',{id,submittedAt:123,decision:'reject',note:'不同意见'})]);assert.equal(reviews.filter(x=>x.statusCode===200).length,1);assert(['verified','rejected'].includes(store.uniearn_accounts[id].verification.status));
 await http('opsReply',{accountId:id,ticketId:'support-1',text:'已为你处理',close:true});const state=await repo.orderState();assert.equal(state.members[id].supportTickets[0].messages.at(-1).mine,false);assert.equal(state.members[id].supportTickets[0].status,'closed');assert.equal(state.revision,2);
 await http('opsCase',{id:'r1',status:'investigating',note:'正在跟进'});assert.equal((await repo.orderState()).requests[0].status,'waiting');
 r=await http('opsPromotions');const cfg=r.data.value;cfg.campaigns=cfg.campaigns.map(c=>({...c,days:c.days||30}));assert.equal((await http('opsSavePromotions',{revision:0,value:cfg})).statusCode,200);assert.equal((await http('opsSavePromotions',{revision:0,value:cfg})).statusCode,409);assert.throws(()=>validatePromotions({...cfg,weekly:{target:0}}));
 r=await http('opsInvite');const invite=r.data.token;assert(!JSON.stringify(store).includes(invite));r=await http('webJoin',{invite,username:'teammate',password:'Test-team-password'},'');assert.equal(r.statusCode,200);const memberToken=r.data.token,memberId=auth.tokenSubject(memberToken);assert.equal((await http('opsUsers',{},memberToken)).statusCode,200);assert.equal((await http('webJoin',{invite,username:'another',password:'Test-team-password'},'')).statusCode,409);
 r=await http('opsMembers');assert.equal(r.data.items.length,2);assert(!r.body.includes('passwordHash'));assert(!r.body.includes(owner.tokenKey));
 assert.equal((await http('opsDisableMember',{id:memberId,disabled:true})).statusCode,200);assert.equal((await http('opsUsers',{},memberToken)).statusCode,401);
 assert.equal((await http('opsDisableMember',{id:'admin',disabled:true})).statusCode,409);
 assert.equal((await http('opsOverview',{},'')).statusCode,401);
 const rewards=require('../cloudfunctions/orderService/rewards');const s={requests:[],members:{},trips:[],adminPromotions:{...cfg,campaigns:[{id:'live',title:'Live',max:3,kind:'total',days:5,enabled:true}]}};
 assert.equal(rewards.view(s,id,at).campaigns[0].id,'live');rewards.collect(s,id,'live',at);assert.equal(s.members[id].coupons[0].max,3);s.adminPromotions.campaigns[0].enabled=false;assert.equal(rewards.view(s,other,at).campaigns.length,0);assert.throws(()=>rewards.collect(s,other,'live',at));assert.equal(s.members[id].coupons[0].max,3);
 const future={requests:[],members:{},trips:[],adminPromotions:{...cfg,campaigns:[{id:'future-auto',title:'Scheduled',automatic:true,max:2,days:5,kind:'total',start:new Date(at+86400000).toISOString()}]}};rewards.init(future,id,at);assert.equal((future.members[id].coupons||[]).length,0,'future automatic campaign must not issue coupons early');
 console.log('Operations: masked data, actual counts/no revenue, audited reveal, duplicate/stale review guards, student reservation, shared support reply, order case isolation, campaign conflicts/live schedules, single-use invite, equal member access and immediate revocation passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
