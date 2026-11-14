const orders=require('../../utils/orders');
const store=require('../../utils/store'),d=require('../../utils/domain'),f=require('../../utils/workflow'),ui=require('../../utils/ui'),rc=require('../../utils/runner-copy'),routeLabel=require('../../utils/route-label'),zh=()=>rc.zh(store.get().language);
Page({data:{...require('../../utils/motion').data(),trip:null,requests:[],reward:'0.00',boxes:0,cancelling:'',cancellingRequest:null,cancelReason:'',cancelBusy:false,parcelBusy:'',collectingId:'',allCollected:false,deliveryId:'',deliveryPhoto:'',sendingDelivery:false,deliverySubmitted:false,deliveryError:'',sealReporting:'',fullNumbers:{},paid:'0.00',pending:'0.00',joinOpen:false,remaining:0,minutes:0},
 onLoad(o){this.id=o.id;this.failedPickupPhotos=new Set();},onShow(){if(wx.setNavigationBarTitle)wx.setNavigationBarTitle({title:zh()?'取件与送达':'Pick up & deliver'});orders.bind(this);},onHide(){orders.unbind(this);},onUnload(){orders.unbind(this);},
 refresh(){const s=store.get(),lang=rc.zh(s.language)?'zh':'en',t=s.trips.find(x=>x.id===this.id);if(!t){this.setData({trip:null,zh:lang==='zh'});return;}const now=Date.now(),rs=t.requestIds.map(id=>s.requests.find(r=>r.id===id)).filter(Boolean).map(r=>{const view=f.view(r,lang),visible=photos=>photos.filter(url=>typeof url==='string'&&url.trim()&&!(this.failedPickupPhotos&&this.failedPickupPhotos.has(url)));return {...view,riderPhotos:visible(view.riderPhotos),orderPictures:visible(view.orderPictures),runnerPoints:require('../../utils/runner-points').quote(s,r),left:d.boxes(r)-r.collected.length,etaChanged:!!r.etaChangedAfterAccept,deliveryBy:f.clock((r.collectedAt||0)+900000),deliveryMinutes:r.collectedAt?Math.ceil(((r.collectedAt||0)+900000-now)/60000):0,freeCancel:r.category==='takeout'&&(r.etaChangedAfterAccept||now<=(r.arrivalAt||0)-900000),freeCancelTime:f.clock((r.arrivalAt||0)-900000),arrivalBadge:String(view.arrivalLabel||'').replace(/^Arrives /,'Food arrives at '),dropLabel:(()=>{const n=String(r.dropNote||'').trim();if(!n)return '';if(lang!=='zh')return n;return n==='At my door'?'送到门口':n==='Meet at the stated location'?'到约定地点当面交给顾客':/^Lobby/.test(n)?'送到宿舍楼一楼大厅，顾客下楼取':n;})()};}),boxes=rs.reduce((n,r)=>n+r.boxes,0);rs.sort((a,b)=>Number(a.room.replace(/\D/g,''))-Number(b.room.replace(/\D/g,'')));const parcels=rs.flatMap(r=>r.codes.map((code,i)=>({key:r.id+':'+i,id:r.id,index:i,code,unread:Math.max(0,Number(r.unread)||0),pickupPoint:(r.parcelItems||[])[i]?.pickupPoint||r.station,owner:r.owner,phone:r.phone,room:r.room,fragile:!!r.fragile,done:(r.collectedIndices||r.collected.map((_,j)=>j)).includes(i)})));const done=rs.filter(r=>['delivered','confirmed'].includes(r.status)).length,rank=require('../../utils/runner-level').level(s.profile),lockerLabel=require('../../utils/takeaway-lockers').label;this.setData({tripNight:t.category==='takeout'&&rs.length>0&&rs.every(r=>r.night),allCollected:rs.length>0&&rs.every(r=>r.status==='collected'),cancellingRequest:rs.find(r=>r.id===this.data.cancelling&&r.status==='taken')||null,zh:lang==='zh',names:rc.names(s.language),tripStationLabel:t.category==='takeout'?(routeLabel.group(rs,lang)||routeLabel.place(t.station,lang)):rc.name(t.station,s.language),parcels,done,progress:rank.progress,level:rank.name,limit:rank.limit===Infinity?(lang==='zh'?'不限':'No limit'):'Balance ¥'+rank.limit,next:rank.remaining,collected:parcels.filter(p=>p.done).length,trip:t,requests:rs,reward:rs.reduce((n,r)=>n+r.reward+Number(r.runnerBonus||0),0).toFixed(2),boxes,paid:rs.filter(r=>r.status==='confirmed').reduce((n,r)=>n+r.reward+Number(r.runnerBonus||0),0).toFixed(2),pending:rs.filter(r=>r.status==='delivered').reduce((n,r)=>n+r.reward+Number(r.runnerBonus||0),0).toFixed(2),joinOpen:!t.cancelled&&t.phase==='collect'&&t.joinUntil>now,remaining:t.capacity-boxes,minutes:Math.max(0,Math.ceil((t.joinUntil-now)/60000)),jobsDone:s.profile.jobsDone||0,marks:(s.profile.marks||[]).length});},
 report(e){const id=e.currentTarget.dataset.id;if(id)require('../../utils/nav').navigateTo({url:'/pages/order-feedback/index?id='+encodeURIComponent(id)});},chat(e){require('../../utils/nav').navigateTo({url:'/pages/chat/index?id='+e.currentTarget.dataset.id});},full(e){const id=e.currentTarget.dataset.id;this.setData({fullNumbers:{...this.data.fullNumbers,[id]:!this.data.fullNumbers[id]}});},phone(e){wx.makePhoneCall({phoneNumber:e.currentTarget.dataset.phone.replace(/\s/g,'')});},previewOrderPhoto(e){ui.preview(e.currentTarget.dataset.photo);},previewRiderPhotos(e){const request=this.data.requests.find(r=>r.id===e.currentTarget.dataset.id),urls=request&&request.riderPhotos||[],index=Number(e.currentTarget.dataset.index);if(urls[index])wx.previewImage({urls,current:urls[index]});},previewRiderPictures(e){return this.previewRiderPhotos(e);},previewPictures(e){const request=this.data.requests.find(r=>r.id===e.currentTarget.dataset.id),urls=request&&request.orderPictures||[],index=Number(e.currentTarget.dataset.index);if(urls[index])wx.previewImage({urls,current:urls[index]});},previewParcelPictures(e){const parcel=this.data.parcels.find(p=>p.id===e.currentTarget.dataset.id&&(p.pictures||[]).length),urls=parcel&&parcel.pictures||[],index=Number(e.currentTarget.dataset.index);if(urls[index])wx.previewImage({urls,current:urls[index]});},previewOrderPhoto(e){ui.preview(e.currentTarget.dataset.photo);},previewRiderPhotos(e){const request=this.data.requests.find(r=>r.id===e.currentTarget.dataset.id),urls=request&&request.riderPhotos||[],index=Number(e.currentTarget.dataset.index);if(urls[index])wx.previewImage({urls,current:urls[index]});},previewRiderPictures(e){return this.previewRiderPhotos(e);},previewPictures(e){const request=this.data.requests.find(r=>r.id===e.currentTarget.dataset.id),urls=request&&request.orderPictures||[],index=Number(e.currentTarget.dataset.index);if(urls[index])wx.previewImage({urls,current:urls[index]});},
 pickupPhotoError(e){
  const {id,source,photo}=e.currentTarget.dataset;
  if(!['riderPhotos','orderPictures'].includes(source))return;
  const request=this.data.requests.find(r=>r.id===id);
  if(!request||!request[source].includes(photo))return;
  if(!this.failedPickupPhotos)this.failedPickupPhotos=new Set();
  this.failedPickupPhotos.add(photo);this.refresh();
 },
 async collect(e){if(this.data.parcelBusy||this.data.cancelBusy)return;const {id,index,code}=e.currentTarget.dataset,r=store.get().requests.find(r=>r.id===id);if(!r)return;const parcel=r.category==='parcel'&&index!==undefined,i=Number(index);if(parcel&&code!==undefined&&String(code)!==r.codes[i])return ui.toast(zh()?'包裹已变化，请刷新后重试':'Parcels changed. Refresh and try again.');this.setData({parcelBusy:id+':'+index});try{await orders.act('pickup',{id,...(parcel?{index:i,expectedCodes:r.codes.slice()}:{})});}catch(error){ui.toast(error);}finally{this.setData({parcelBusy:''});this.refresh();}},
 async collectAndDeliver(e){
  if(this.data.collectingId||this.data.cancelBusy)return;
  const id=e.currentTarget.dataset.id,state=store.get(),trip=state.trips.find(t=>t.id===this.id),request=state.requests.find(r=>r.id===id);
  if(!trip||trip.cancelled||!trip.requestIds.includes(id)||!request||!['taken','collected'].includes(request.status))return this.refresh();
  this.setData({collectingId:id});
  try{
   if(request.status==='taken')await orders.act('pickup',{id});
   const current=store.get(),updated=current.trips.find(t=>t.id===this.id);
   if(updated&&!updated.cancelled&&updated.phase==='collect'){
    const remaining=updated.requestIds.filter(key=>current.requests.find(r=>r.id===key)?.status!=='collected');
    if(!remaining.length)await orders.act('leave',{id:this.id});
    else ui.toast(zh()?'本单已取物，请先取齐其余订单。':'Picked up. Collect the remaining orders before delivery.');
   }
  }catch(error){ui.toast(error);}finally{this.setData({collectingId:''});this.refresh();}
 },
 async missingParcel(e){
 if(this.data.parcelBusy||this.data.cancelBusy)return ui.toast(zh()?'正在处理，请稍候再试':'An operation is in progress. Please try again shortly.');
 const dataset=e.currentTarget.dataset||{},id=dataset.id,i=Number(dataset.index),code=dataset.code;
 const stale=()=>{ui.toast(zh()?'包裹状态已变化，请刷新后重试':'Parcel details changed. Refresh and try again.');this.refresh();};
 const state=store.get(),r=state.requests.find(r=>r.id===id),trip=state.trips.find(t=>t.id===this.id);
 if(!r||r.category!=='parcel'||r.status!=='taken'||!trip||trip.phase!=='collect'||!trip.requestIds.includes(id)||!Array.isArray(r.codes)||!Number.isInteger(i)||i<0||i>=r.codes.length)return stale();
 const collected=r.collectedIndices||(r.collected||[]).map((_,j)=>j);if(collected.includes(i))return stale();
 if(code!==undefined&&String(code)!==String(r.codes[i]))return stale();
 const expectedCodes=r.codes.slice(),parcelCode=r.codes[i];this.setData({parcelBusy:id+':'+i});
 try{if(!await ui.confirm(zh()?'找不到这件包裹？':'Cannot find this parcel?',zh()?'仅将取件码 '+parcelCode+' 对应的这一件退回接单大厅，其余包裹和已取件记录保留，不记录取消。':'Return only parcel '+parcelCode+' to the job board. Other parcels and collected items stay on this trip. No cancellation mark.'))return;await orders.act('missingParcel',{id,index:i,expectedCodes});ui.toast(zh()?'这件包裹已退回接单大厅':'This parcel was returned to the job board');}
 catch(error){ui.toast(error);await orders.sync().catch(()=>{});}finally{this.setData({parcelBusy:''});this.refresh();}
 },cancel(e){if(this.data.collectingId||this.data.cancelBusy)return;const r=this.data.requests.find(r=>r.id===e.currentTarget.dataset.id&&r.status==='taken');if(r)this.setData({cancelling:r.id,cancellingRequest:r,cancelReason:''});},chooseReason(e){this.setData({cancelReason:e.currentTarget.dataset.value});},backCancel(){if(!this.data.cancelBusy)this.setData({cancelling:'',cancellingRequest:null,cancelReason:''});},
 async submitCancel(){
  if(this.data.cancelBusy||this.data.collectingId||!['missing','quantity','personal'].includes(this.data.cancelReason))return;
  const id=this.data.cancelling,reason=this.data.cancelReason,r=store.get().requests.find(x=>x.id===id);
  if(!r||r.status!=='taken')return this.refresh();
  this.setData({cancelBusy:true});
  try{const mark=f.cancelReason(r,reason);if(!await (zh()?ui.confirm('取消这个订单？',mark?'这会记录一次取消，订单将退回接单大厅。':'不会记录取消，订单将退回接单大厅。'):ui.confirm('Cancel this order?',mark?'This adds a cancellation mark. The order returns to the job board.':'No cancellation mark. The order returns to the job board.')))return;await orders.act('runnerCancel',{id,reason});this.setData({cancelling:'',cancellingRequest:null,cancelReason:''});this.refresh();}catch(e){ui.toast(e);}finally{this.setData({cancelBusy:false});}
 },
 async photo(e){this.deliveryRefreshPending=false;this.setData({deliveryId:e.currentTarget.dataset.id,deliveryPhoto:'',sendingDelivery:false,deliverySubmitted:false,deliveryError:''});await this.choosePhoto();},
 removeDeliveryPhoto(){if(this.data.sendingDelivery||this.data.deliverySubmitted)return;this.setData({deliveryPhoto:'',deliveryError:''});},async choosePhoto(){if(this.data.sendingDelivery||this.data.deliverySubmitted)return;try{const deliveryPhoto=await ui.photo(['camera','album']);if(deliveryPhoto)this.setData({deliveryPhoto,sendingDelivery:false,deliverySubmitted:false,deliveryError:''});}catch(e){if(!/cancel/i.test(e.errMsg||''))ui.toast(e);}},
 async broken(e){const id=e.currentTarget.dataset.id,r=store.get().requests.find(x=>x.id===id);if(this.data.sealReporting||!r||r.sealReportedAt)return;if(!await (zh()?ui.confirm('封签已破损？','请在取餐前记录，并在聊天中告知发布人。'):ui.confirm('Seal already broken?','Record it before pickup and let the customer know in chat.')))return;this.setData({sealReporting:id});try{await orders.act('sealBroken',{id});this.refresh();}catch(e){ui.toast(e);}finally{this.setData({sealReporting:''});}},
 closeDelivery(){if(this.data.sendingDelivery)return;const refresh=!!this.deliveryRefreshPending;this.deliveryRefreshPending=false;this.setData({deliveryId:'',deliveryPhoto:'',sendingDelivery:false,deliverySubmitted:false,deliveryError:''});if(refresh)orders.bind(this);},
 async sendDelivery(){
  if(this.data.sendingDelivery||this.data.deliverySubmitted||!this.data.deliveryPhoto)return;
  const wasBound=!!this._orderRender;if(wasBound)orders.unbind(this);
  this.setData({sendingDelivery:true,deliveryError:''});
  try{
   const photo=await orders.upload(this.data.deliveryPhoto);
   await orders.act('deliver',{id:this.data.deliveryId,photo});
   this.deliveryRefreshPending=wasBound;
   this.setData({sendingDelivery:false,deliverySubmitted:true});
  }catch(e){
   if(wasBound)orders.bind(this);
   this.setData({sendingDelivery:false,deliverySubmitted:false,deliveryError:e.message||String(e)});
   ui.toast(e);
  }
 },
 async leave(){if(!await (zh()?ui.confirm('停止加入并去送达？','只有已取件的订单会进入送达。'):ui.confirm('Close joining and go deliver?','Only collected orders can proceed to delivery.')))return;try{await orders.act('leave',{id:this.id});this.refresh();}catch(e){ui.toast(e);}},
 async endEmpty(){if(!await (zh()?ui.confirm('结束这个空行程？','结束后其他同学将无法加入。'):ui.confirm('End this empty trip?','Nobody else can join after you end it.')))return;try{await orders.act('endEmpty',{id:this.id});this.refresh();}catch(e){ui.toast(e);} },
 joinPreview(){require('../../utils/nav').navigateTo({url:'/pages/join/index?id='+this.id});},
 onShareAppMessage(){const t=this.data.trip,lang=store.get().language,station=t&&t.category==='takeout'?require('../../utils/takeaway-lockers').label(t.station,lang):t?rc.name(t.station,lang):'',night=!!(this.data.tripNight||(t&&t.category==='takeout'&&(this.data.requests||[]).length&&(this.data.requests||[]).every(r=>r.night))),kind=t&&(t.category==='other'||t.category==='task'&&t.routeType==='other')?(zh()?'物品':'items'):t&&t.category==='takeout'?(night?(zh()?'夜市':'Night market'):(zh()?'外卖':'takeaway')):(zh()?'快递':'parcel');return{title:zh()?(t?station+' → '+(t.destinationType==='place'?(t.deliveryAddress||t.dorm):t.dorm):'UniEarn 行程')+' · 加入你的'+kind:(t?station+' → '+(t.destinationType==='place'?(t.deliveryAddress||t.dorm):t.dorm):'UniEarn trip')+' · add your '+kind,path:(t&&(t.category==='other'||t.category==='task'&&t.routeType==='other')?'/pages/task-post/index?tripId=':'/pages/join/index?id=')+encodeURIComponent(this.id)};},
 request(e){const r=store.get().requests.find(r=>r.id===e.currentTarget.dataset.id);require('../../utils/nav').navigateTo({url:(r&&r.category==='task'?'/pages/task/index?id=':'/pages/request/index?id=')+e.currentTarget.dataset.id});},reset(){wx.reLaunch({url:'/pages/jobs/index'});}
});
