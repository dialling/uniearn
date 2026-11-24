const assert=require('node:assert/strict'),{createHandler,idFor}=require('../legacy/cloudfunctions/studentAccount/handler');
(async()=>{
 const id=idFor('owner'),records={[id]:{profile:{name:'Real Name',phone:'13801026092',campusId:'sip',displayName:'Alis'},verification:{status:'verified'},runnerRulesAcceptedAt:10}};
 const handler=createHandler({getOpenId:()=>'owner',env:{},now:()=>5,repo:{get:async k=>structuredClone(records[k]),patch:async(k,p)=>{records[k]={...records[k],...p};}}});
 const mine='cloud://env-1.bucket/order-photos/'+id+'/'+'a'.repeat(32)+'.jpg';
 let r=await handler({action:'saveAvatar',avatarUrl:mine});assert.equal(r.ok,true);assert.equal(r.account.profile.avatarUrl,mine);assert.equal(records[id].profile.displayName,'Alis');assert.equal(records[id].profile.name,'Real Name');
 for(const bad of ['https://example.com/a.jpg','cloud://env/order-photos/'+idFor('other')+'/'+'b'.repeat(32)+'.jpg','cloud://env/order-photos/'+id+'/../x.jpg',7,undefined,'cloud://e/order-photos/'+id+'/'+'a'.repeat(32)+'.jpg'+'x'.repeat(400)]){r=await handler({action:'saveAvatar',avatarUrl:bad});assert.equal(r.ok,false,String(bad));}
 assert.equal(records[id].profile.avatarUrl,mine,'a rejected picture leaves the old one');
 r=await handler({action:'saveAvatar',avatarUrl:''});assert.equal(r.ok,true);assert.equal(records[id].profile.avatarUrl,undefined);
 // orders carry the picture to the other side
 const h=require('./helpers/order-cloud').harness(),customer=h.engine.idFor('customer'),runner=h.engine.idFor('runner');
 h.accounts[customer].profile.avatarUrl='cloud://env/order-photos/'+customer+'/'+'c'.repeat(32)+'.jpg';
 const made=await h.call('customer','create',{data:{category:'task',title:'Help me return a library book',price:3,owner:'x'}});assert.equal(made.ok,true,made.error);
 assert.equal(h.state.requests.find(x=>x.id===made.value.id).ownerAvatar,h.accounts[customer].profile.avatarUrl);
 delete h.accounts[customer].profile.avatarUrl;const synced=await h.call('customer','sync');assert.equal(synced.ok,true,synced.error);
 assert.equal(h.state.requests.find(x=>x.id===made.value.id).ownerAvatar,undefined,'removing the photo clears it from open orders');
 assert.equal(require('../utils/contact-identity')({ownerAvatar:'p',runnerAvatar:'q',owner:'A',runnerName:'B'},false,false).avatar,'p');
 assert.equal(require('../utils/contact-identity')({ownerAvatar:'p',runnerAvatar:'q',owner:'A',runnerName:'B'},true,false).avatar,'q');
 console.log('profile-avatar ok');
})().catch(e=>{console.error(e);process.exit(1);});
// The runner's trip page shows the customer's real photo, not just an initial.
(()=>{const x=require('node:fs').readFileSync(require('node:path').join(__dirname,'../pages/trip/index.wxml'),'utf8');
 const tags=x.match(/<contact-avatar[^>]*>/g)||[];assert.ok(tags.length>=2);
 for(const t of tags)assert.match(t,/src="\{\{item\.ownerAvatar\}\}"/);})();
