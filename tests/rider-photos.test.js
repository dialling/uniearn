const assert=require('node:assert/strict'),{harness}=require('./helpers/order-cloud'),h=harness();
let definition,chooseOptions,preview;const notices=[],uploads=[];
global.Page=x=>definition=x;
global.wx={getStorageSync:()=>null,setStorageSync(){},showToast:x=>notices.push(x.title),chooseMedia:x=>chooseOptions=x,saveFile:x=>x.success({savedFilePath:x.tempFilePath}),previewImage:x=>preview=x,cloud:{init(){},async callFunction({data}){return {result:await h.client(data)};},async uploadFile({cloudPath,filePath}){uploads.push(filePath);return {fileID:'cloud://test/'+cloudPath};}}};
const store=require('../utils/store'),orders=require('../utils/orders'),paths=require('../utils/rider-photos').paths;
function page(name,id){delete require.cache[require.resolve('../pages/'+name+'/index')];require('../pages/'+name+'/index');const p={...definition,data:structuredClone(definition.data),setData:x=>Object.assign(p.data,x)};p.onLoad({id});p.refresh();return p;}
const tap=index=>({currentTarget:{dataset:{index}}});
const food={category:'takeout',owner:'Student',phone:'13801026092',station:'North gate',dorm:'D01',room:'1111',bags:1,price:3,arrived:false,arrivalTime:require('../utils/workflow').clock(Date.now()+1800000)};
async function create(){const result=await h.call('customer','create',{data:food});assert.equal(result.ok,true,result.error);return result.value.id;}
async function file(who='customer'){const r=await h.call(who,'prepareUpload');assert.equal(r.ok,true,r.error);return 'cloud://test/'+r.value.cloudPath;}
(async()=>{
 store.reset();const accountId=h.engine.idFor('customer');store.update(s=>{s.language='zh';s.profile={...s.profile,...h.accounts[accountId].profile,accountId,onboarded:true};});
 const id=await create(),legacy=await file();assert.equal((await h.call('customer','riderPhoto',{id,photo:legacy})).ok,true);await orders.sync();
 assert.equal(store.get().orderCapabilities.riderPhotos,true);
 const detail=page('request',id);assert.equal(detail.data.request.riderPhotos.length,1,'legacy single-photo API stays compatible');
 detail.previewRider(tap(0));assert.equal(preview.urls.length,1);
 const choosing=detail.riderPhoto();assert.equal(detail.data.photoBusy,true);await Promise.resolve();assert.equal(chooseOptions.count,3);
 await detail.riderPhoto();chooseOptions.success({tempFiles:[{tempFilePath:'wxfile://one.jpg'},{tempFilePath:'wxfile://two.jpg'}]});await choosing;
 assert.equal(detail.data.photoBusy,false);assert.equal(detail.data.request.riderPhotos.length,2);assert.equal(uploads.length,2);
 assert.equal(h.state.requests.find(r=>r.id===id).riderPhotos.length,2);assert.equal(h.state.requests.find(r=>r.id===id).riderPhoto,h.state.requests.find(r=>r.id===id).riderPhotos[0]);
 detail.previewRider(tap(1));assert.equal(preview.urls.length,2);assert.equal(preview.current,detail.data.request.riderPhotos[1]);
 const append=detail.riderPhoto({currentTarget:{dataset:{mode:'append'}}});await Promise.resolve();assert.equal(chooseOptions.count,1);chooseOptions.success({tempFiles:[{tempFilePath:'wxfile://three.jpg'}]});await append;
 assert.equal(detail.data.request.riderPhotos.length,3);
 const before=JSON.stringify(h.state.requests.find(r=>r.id===id).riderPhotos);await detail.riderPhoto({currentTarget:{dataset:{mode:'append'}}});assert.match(notices.at(-1),/3/);
 const cancelled=detail.riderPhoto();await Promise.resolve();chooseOptions.fail({errMsg:'chooseMedia:fail cancel'});await cancelled;
 assert.equal(JSON.stringify(h.state.requests.find(r=>r.id===id).riderPhotos),before,'cancelling selection preserves existing photos');
 await detail.removeRiderPhoto(tap(1));assert.equal(detail.data.request.riderPhotos.length,2);
 const outsider=await h.call('other','sync');assert.equal(outsider.snapshot.publicJobs.find(r=>r.id===id).riderPhotos,undefined);assert.equal(outsider.snapshot.requests.find(r=>r.id===id).riderPhotos,undefined);
 assert.equal((await h.call('other','riderPhoto',{id,photos:[await file('other')]})).ok,false);
 const ownerPhotos=h.state.requests.find(r=>r.id===id).riderPhotos.slice();
 for(const photos of [[...ownerPhotos,...ownerPhotos],'bad',null,['wxfile://local.jpg'],[await file('other')]]){
  const result=await h.call('customer','riderPhoto',{id,photos});assert.equal(result.ok,false);assert.deepEqual(h.state.requests.find(r=>r.id===id).riderPhotos,ownerPhotos,'invalid upload cannot partially overwrite a gallery');
 }
 const accepted=await h.call('runner','accept',{ids:[id]});assert.equal(accepted.ok,true,accepted.error);h.user='runner';await orders.sync();
 const trip=page('trip',accepted.value.id);assert.equal(trip.data.requests[0].riderPhotos.length,2);assert.ok(trip.data.requests[0].riderPhotos.every(p=>p.startsWith('https://private.example/')));
 trip.previewRiderPictures({currentTarget:{dataset:{id,index:1}}});assert.equal(preview.urls.length,2);assert.equal(preview.current,trip.data.requests[0].riderPhotos[1]);
 assert.equal((await h.call('runner','riderPhoto',{id,photos:[await file('runner')]})).ok,false,'runner can view but cannot replace customer platform photos');
 const picked=await h.call('runner','pickup',{id});assert.equal(picked.ok,true);assert.equal((await h.call('customer','riderPhoto',{id,photos:[]})).ok,false,'editing closes after pickup');
 h.user='customer';const clear=await create();await h.call('customer','riderPhoto',{id:clear,photos:[legacy]});await orders.sync();const clearPage=page('request',clear);await clearPage.removeRiderPhoto(tap(0));
 assert.deepEqual(clearPage.data.request.riderPhotos,[]);assert.equal(h.state.requests.find(r=>r.id===clear).riderPhoto,'');assert.equal(h.state.requests.find(r=>r.id===clear).arrived,true);
 assert.deepEqual(paths({riderPhoto:legacy}),[legacy]);assert.deepEqual(paths({riderPhotos:[],riderPhoto:legacy}),[],'an intentionally cleared list must not resurrect the old photo');
 // Old cloud deployments must fail clearly before selecting/uploading, not lose all but the first image.
 const sync=orders.sync;orders.sync=async()=>{};store.update(s=>s.orderCapabilities={});chooseOptions=null;await clearPage.riderPhoto();assert.equal(chooseOptions,null);assert.match(notices.at(-1),/云端/);orders.sync=sync;
 console.log('Rider photos: replace/add/remove galleries, limits, legacy compatibility, cancellation, owner/runner/privacy guards, temp URLs and old-cloud capability checks passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
