const assert=require('node:assert/strict');
const {session}=require('../scripts/group-test-service');
async function run(){
  const db=session(),id='group-demo-1';
  assert.equal((await db.call('runner','accept',{ids:[id]})).ok,true);
  const photo='cloud://test/order-photos/'+db.engine.idFor('runner')+'/'+'b'.repeat(32)+'.jpg';
  const event={id,photo,operationId:'chat_image_retry_001'};
  const sent=await db.call('runner','message',event);
  assert.equal(sent.ok,true,sent.error);
  assert.ok(sent.snapshot.photoURLs[photo]);
  assert.equal((await db.call('runner','message',event)).ok,true);
  const received=await db.call('customer','sync');
  const row=received.snapshot.requests.find(r=>r.id===id);
  assert.equal(row.messages.length,1);
  assert.equal(row.messages[0].photo,photo);
  assert.ok(received.snapshot.photoURLs[photo]);
  const stranger=await db.call('other','sync');
  assert.equal(stranger.snapshot.photoURLs[photo],undefined);
  assert.equal((await db.call('other','message',{id,photo})).ok,false);
  assert.equal((await db.call('customer','message',{id,photo})).ok,false);
  db.edit(s=>{s.requests.find(r=>r.id===id).deliveredAt=Date.now()-86400001;});
  assert.equal((await db.call('runner','message',{id,photo})).ok,false);
  console.log('Chat image upload ownership, participants-only preview URLs, retry and chat expiry passed.');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
