// Run with Node on the developer's machine. The harness runs the production
// orderService entry point against an isolated in-memory database.

const {randomUUID} = require('node:crypto');
const {harness} = require('../tests/helpers/order-cloud');
const {make} = require('../utils/group-test-orders');
function session() {
  const db = harness();
  db.edit(state => {
    state.requests = make('sip').map((r,i) => ({
      ...r, ownerId:db.engine.idFor('customer'), owner:'测试发布者', room:String(201+i),
      phone:'13800000000', history:[], universityId:'xjtlu', serviceFee:0
    }));
  });
  return db;
}
// Loopback-only backend for the isolated DevTools project. Each launch gets its own ledger.
if(require.main===module){
  const sessions=new Map();
  require('node:http').createServer(async(req,res)=>{
    res.setHeader('Content-Type','application/json');
    try{
      if(req.method!=='POST'||req.url!=='/orders')throw Error('Unknown endpoint');
      let body='';
      for await(const chunk of req){body+=chunk;if(body.length>32000)throw Error('Request too large');}
      const {token,role,event}=JSON.parse(body);
      if(!token){
        for(const [key,v] of sessions)if(Date.now()-v.at>86400000)sessions.delete(key);
        const id=randomUUID();sessions.set(id,{db:session(),at:Date.now()});
        return res.end(JSON.stringify({token:id}));
      }
      const entry=sessions.get(token);
      if(!entry||!['customer','runner'].includes(role))throw Error('请重新进入 Group 测试大厅');
      entry.at=Date.now();
      res.end(JSON.stringify(await entry.db.call(role,event.action,event)));
    }catch(e){res.statusCode=400;res.end(JSON.stringify({ok:false,error:e.message}));}
  }).listen(18746,'127.0.0.1');
}
module.exports={session};
