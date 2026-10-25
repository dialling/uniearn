const Module=require('module');
const engine=require('../../cloudfunctions/orderService/engine');
const clone=x=>JSON.parse(JSON.stringify(x));
function harness(){
 let state=engine.initial(),revision=0,openid='customer',calls=0;
 const accounts={},documents={};
 for(const name of ['customer','runner','other','stranger']) accounts[engine.idFor(name)]={profile:{name,universityId:'xjtlu',campusId:'sip',phone:'13801026092',dorm:'Dorm 7',room:'412'},runnerRulesAcceptedAt:1,verification:{status:name==='stranger'?'unverified':'verified'}};
 const sdk={DYNAMIC_CURRENT_ENV:'test',init(){},getWXContext:()=>({OPENID:openid}),database:()=>({
  async runTransaction(fn){
   for(let retry=0;retry<10;retry++){
    const at=revision,working=clone(state),docs=clone(documents);let saved;
    const result=await fn({collection(name){return{doc(id){return{
     async get(){if(name==='uniearn_accounts')return{data:clone(accounts[id]||{})};if(name==='uniearn_order_state')return{data:working};if(!docs[name+':'+id])throw Error('document not found');return{data:clone(docs[name+':'+id])};},
     async set({data}){if(name==='uniearn_order_state')saved=clone(data);else docs[name+':'+id]=clone(data);}
    };}};}});
    if(at!==revision)continue;
    if(saved){state=saved;Object.assign(documents,docs);revision++;}return result;
   }throw Error('Conflict retries exhausted');
  }
 }),async getTempFileURL({fileList}){return{fileList:fileList.map(x=>({fileID:x.fileID,tempFileURL:'https://private.example/'+encodeURIComponent(x.fileID)}))};}};
 const original=Module._load;Module._load=function(name,...args){return name==='wx-server-sdk'?sdk:original.call(this,name,...args);};
 const path=require.resolve('../../cloudfunctions/orderService');delete require.cache[path];let main;
 try{main=require(path).main;}finally{Module._load=original;}
 return{engine,accounts,documents,get state(){return state;},edit(fn){fn(state);revision++;},
  async call(who,action,extra={}){openid=who;calls++;return main({action,operationId:'test_operation_'+calls,...extra});},
  async client(data){openid=this.user||'customer';return main(data);},user:'customer'};
}
module.exports={harness};
