const assert=require('node:assert/strict'),fs=require('node:fs');
const now=Date.parse('2030-01-02T18:00:00+08:00');Date.now=()=>now;
const {harness}=require('./helpers/order-cloud'),h=harness();
let definition,chooseOptions,preview;const notices=[],uploads=[];
global.Page=value=>definition=value;
global.wx={getStorageSync:()=>null,setStorageSync(){},showToast:value=>notices.push(value.title),redirectTo(){},chooseMedia:options=>chooseOptions=options,saveFile:options=>options.success({savedFilePath:options.tempFilePath}),previewImage:options=>preview=options,cloud:{init(){},async callFunction({data}){return {result:await h.client(data)};},async uploadFile({cloudPath,filePath}){uploads.push(filePath);return {fileID:'cloud://test/'+cloudPath};}}};
const store=require('../utils/store'),orders=require('../utils/orders');
function page(name,options={}){delete require.cache[require.resolve('../pages/'+name+'/index')];require('../pages/'+name+'/index');const p={...definition,data:structuredClone(definition.data),setData:value=>Object.assign(p.data,value)};p.onLoad(options);return p;}
(async()=>{
 store.reset();const accountId=h.engine.idFor('customer');store.update(s=>{s.language='zh';s.profile={...s.profile,...h.accounts[accountId].profile,accountId,onboarded:true};});await orders.sync();
 const p=page('takeaway');p.setData({firstRoute:false,note:'请放门口'});p.customLocker({detail:{value:'取餐点'}});
 const pending=p.photo();assert.equal(p.data.photoBusy,true);assert.deepEqual(chooseOptions.sourceType,['album','camera']);assert.equal(chooseOptions.count,3);
 await p.post();assert.equal(h.state.requests.length,0,'posting waits for photo selection');
 chooseOptions.success({tempFiles:[{tempFilePath:'wxfile://first.jpg'},{tempFilePath:'wxfile://second.jpg'}]});await pending;assert.equal(p.data.photoBusy,false);assert.deepEqual(p.data.orderPictures,['wxfile://first.jpg','wxfile://second.jpg']);
 p.preview({currentTarget:{dataset:{index:1}}});assert.deepEqual(preview.urls,p.data.orderPictures);assert.equal(preview.current,'wxfile://second.jpg');
 const cancelled=p.photo();assert.equal(chooseOptions.count,1);chooseOptions.fail({errMsg:'chooseMedia:fail cancel'});await cancelled;assert.equal(p.data.orderPictures.length,2);assert.equal(notices.length,0);
 p.removePhoto({currentTarget:{dataset:{index:0}}});assert.deepEqual(p.data.orderPictures,['wxfile://second.jpg']);
 const more=p.photo();assert.equal(chooseOptions.count,2);chooseOptions.success({tempFiles:[{tempFilePath:'wxfile://replacement.jpg'},{tempFilePath:'wxfile://third.jpg'}]});await more;assert.equal(p.data.orderPictures.length,3);
 await p.photo();assert.match(notices.at(-1),/3/);assert.equal(p.data.orderPictures.length,3);
 await p.post();assert.equal(h.state.requests.length,1);assert.deepEqual(uploads,['wxfile://second.jpg','wxfile://replacement.jpg','wxfile://third.jpg']);
 const order=h.state.requests[0];assert.equal(order.orderPictures.length,3);assert.ok(order.orderPictures.every(photo=>photo.startsWith('cloud://')));assert.equal(order.note,'请放门口');
 const detail=page('request',{id:order.id});detail.refresh();assert.equal(detail.data.request.orderPictures.length,3);detail.previewPictures({currentTarget:{dataset:{index:1}}});assert.equal(preview.urls.length,3);assert.equal(preview.current,detail.data.request.orderPictures[1]);
 const publicView=await h.call('other','sync');assert.equal(publicView.snapshot.publicJobs[0].orderPictures,undefined);assert.equal(publicView.snapshot.requests[0].orderPictures,undefined);
 const rejected=await h.call('customer','create',{data:{category:'takeout',owner:'Student',phone:'13801026092',station:'North gate',dorm:'D01',room:'101',bags:1,price:3,arrived:true,orderPictures:order.orderPictures.concat(order.orderPictures[0])}});assert.equal(rejected.ok,false,'server enforces the same photo limit');
 const accepted=await h.call('runner','accept',{ids:[order.id]});assert.equal(accepted.ok,true,accepted.error);
 h.user='runner';await orders.sync();const trip=page('trip',{id:accepted.snapshot.trips[0].id});trip.refresh();const pictures=trip.data.requests[0].orderPictures;assert.equal(pictures.length,3);assert.ok(pictures.every(photo=>photo.startsWith('https://private.example/')),'accepting runner can view every uploaded photo');trip.previewPictures({currentTarget:{dataset:{id:order.id,index:2}}});assert.equal(preview.urls.length,3);assert.equal(preview.current,pictures[2]);
 const xml=fs.readFileSync(require.resolve('../pages/takeaway/index.wxml'),'utf8');assert.ok(xml.indexOf('{{ui.noteLabel}}')<xml.indexOf('note-soup'));assert.ok(xml.indexOf('note-soup')<xml.indexOf('note-photo-area'));
 console.log('Takeaway note photos: multi-select, remaining count, per-photo deletion, gallery preview, cancellation, three-photo limit, cloud persistence and customer/runner display passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
