const assert=require('node:assert/strict');
const {session}=require('../scripts/group-test-service');

async function run(){
  const db=session(), ids=['group-demo-1','group-demo-2'];
  const ok=async(role,action,args)=>{
    const r=await db.call(role,action,args);
    assert.equal(r.ok,true,r.error);
    return r;
  };
  const {value:trip}=await ok('runner','accept',{ids});
  assert.deepEqual(db.state.trips.find(t=>t.id===trip.id).requestIds,ids);
  assert.equal((await db.call('other','accept',{ids})).ok,false);
  const order=id=>db.state.requests.find(r=>r.id===id);
  await ok('runner','pickup',{id:ids[0]});
  assert.equal(order(ids[1]).status,'taken');
  await ok('runner','pickup',{id:ids[1]});
  const proof='cloud://group-test/order-photos/'+db.engine.idFor('runner')+'/'+'a'.repeat(32)+'.jpg';
  assert.equal((await db.call('runner','deliver',{id:ids[0]})).ok,false);
  for(const id of ids)await ok('runner','deliver',{id,photo:proof});
  assert.equal((await db.call('runner','confirm',{id:ids[0]})).ok,false);
  await ok('customer','confirm',{id:ids[0]});
  assert.equal(order(ids[1]).status,'delivered');
  const confirmation={id:ids[1],operationId:'test_group_confirm_retry'};
  await ok('customer','confirm',confirmation);
  await ok('customer','confirm',confirmation);
  const {snapshot}=await ok('runner','sync');
  assert.equal(snapshot.trips.find(t=>t.id===trip.id).phase,'done');
  assert.equal(snapshot.stats.jobsDone,2);
  assert.equal(snapshot.stats.paid,9);
  assert.equal(snapshot.walletSummary.balance_cents,900);
  assert.equal(snapshot.walletSummary.pending_cents,0);
  assert.equal(order('group-demo-3').status,'waiting');
  console.log('Group: partial accept, competing runner, pickup, delivery proof, owner confirmation, retry and 900-cent wallet settlement passed.');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
