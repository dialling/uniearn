const {postCopy}=require('../../utils/post-copy');
const orders=require('../../utils/orders');
const store=require('../../utils/store'),d=require('../../utils/domain'),f=require('../../utils/workflow'),ui=require('../../utils/ui'),copy=require('../../utils/orders-copy');
Page({data:{...require('../../utils/motion').data(),request:null,photoBusy:false,cancelling:false,raiseAmounts:[1.88,3.88,5.88,8.88],posted:false,celebrate:false,videoSrc:'',videoFailed:false,successUI:postCopy('posted','zh'),reporting:false,reason:'',issuePhoto:'',issueNote:'',lateOptionsOpen:false,lateCustomOpen:false,lateMinutes:'',latePresets:[10,20,30],reasons:['Not received','Malicious order','Runner unreachable','Harassment','Damaged or lost','Fake proof','Something else'],reasonLabels:[],zh:false},onLoad(o){this.id=o.id;this.setData({posted:o.posted==='1',celebrate:o.celebrate==='1'&&require('../../utils/motion').enabled()});},onShow(){if(wx.setNavigationBarTitle&&store.get().language!=='en')wx.setNavigationBarTitle({title:'订单详情'});orders.bind(this);},onHide(){orders.unbind(this);},onUnload(){this._unloaded=true;orders.unbind(this);},
 refresh(){const s=store.get(),zh=s.language!=='en',lang=zh?'zh':'en',r=s.requests.find(x=>x.id===this.id&&(x.isMine||x.isRunner));if(!r){this.setData({request:null,zh});return;}const t=s.trips.find(x=>x.id===r.runnerId);const v=f.view(r,lang);const task=r.category==='task';const steps=[{name:zh?'已发布':'Posted',done:true,time:f.clock(r.createdAt)},{name:zh?'已接单':'Accepted',done:!!r.runnerId,time:f.clock(r.takenAt)},...(task?[{name:zh?'已完成':'Done',done:!!r.deliveredAt,time:f.clock(r.deliveredAt)}]:[{name:zh?'已取件':'Picked up',done:!!r.collectedAt,time:f.clock(r.collectedAt)},{name:zh?'已送达':'Delivered',done:!!r.deliveredAt,time:f.clock(r.deliveredAt)}]),{name:zh?'已确认':'Confirmed',done:r.status==='confirmed',time:f.clock(r.confirmedAt)}];const stepIndex=steps.reduce((n,step,idx)=>step.done?idx:n,0);this.setData({zh,successUI:postCopy('posted',lang),reasonLabels:this.data.reasons.map(x=>copy.translate(x,lang)),request:{...v,unitLabel:copy.translate(v.unit,lang),deliveryLocationLabel:copy.translate(v.deliveryLocation||'',lang),disputeReason:v.dispute?copy.translate(v.dispute.reason,lang):'',canMoveEta:!r.etaMoved&&Date.now()<=(r.arrivalAt||0)+600000,canReport:r.status==='delivered'&&(r.category!=='takeout'||Date.now()<=r.deliveredAt+30*60000)},runner:r.runnerName||t&&t.runnerName||(zh?'跑手':'Runner'),steps,stepIndex});if(this.data.celebrate&&!this.videoAsked)this.loadVideo(r.category==='takeout'?'takeout':'express');},
 onMotionChange(enabled){if(!enabled){this.videoAsked=true;this.setData({celebrate:false,videoSrc:''});}},
 loadVideo(kind){if(!require('../../utils/motion').enabled())return this.onMotionChange(false);this.videoAsked=true;require('../../utils/yuni-video').prepare(kind).then(videoSrc=>{if(!this._unloaded&&this.data.celebrate&&require('../../utils/motion').enabled())this.setData({videoSrc});},()=>{if(!this._unloaded&&this.data.celebrate&&require('../../utils/motion').enabled())this.setData({videoFailed:true});});},videoError(){this.setData({videoFailed:true});},closeCelebrate(){this.setData({celebrate:false});},track(){this.closeCelebrate();},noop(){},
 async raise(e){const amount=Number(e.currentTarget.dataset.amount);const zh=this.data.zh;if(!await ui.confirm(zh?'赏金加价 ¥'+amount+'？':'Raise the offer by ¥'+amount+'?',zh?'加价金额只对整笔订单计算一次。当前为预览版，不会产生真实付款。':'This amount is added once to the whole order. No real payment is made in this preview.'))return;try{await orders.act('raise',{id:this.id,amount});this.refresh();}catch(e){ui.toast(e);}},
 async cancel(){const zh=this.data.zh;if(!await ui.confirm(zh?'取消这笔订单？':'Cancel this request?',zh?'无人接单的订单将全额模拟退款，包括服务费。':'Unclaimed orders receive a full demo refund, including the service fee.'))return;this.setData({cancelling:true});try{for(let attempt=0;attempt<2;attempt++){try{await orders.act('cancel',{id:this.id});this.refresh();return;}catch(e){const msg=String(e&&e.message||'');if(attempt===0&&/还在处理|still finishing|Please wait/i.test(msg)){await new Promise(r=>setTimeout(r,1500));continue;}ui.toast(e);return;}}}finally{this.setData({cancelling:false});}},
 async confirm(){try{await orders.act('confirm',{id:this.id});this.refresh();}catch(e){ui.toast(e);}},
 issue(){this.setData({reporting:true});},backIssue(){this.setData({reporting:false});},chooseReason(e){this.setData({reason:e.currentTarget.dataset.value});},note(e){this.setData({issueNote:e.detail.value});},
 async addIssuePhoto(){try{this.setData({issuePhoto:await ui.photo(['camera','album'])});}catch(e){if(!/cancel/i.test(e.errMsg||''))ui.toast(e);}},removeIssuePhoto(){this.setData({issuePhoto:''});},previewIssue(){const photo=this.data.issuePhoto;if(photo)wx.previewImage({urls:[photo],current:photo});},
 async report(){try{await orders.act('report',{id:this.id,reason:this.data.reason,photo:await orders.upload(this.data.issuePhoto),note:this.data.issueNote});this.setData({reporting:false});this.refresh();}catch(e){ui.toast(e);}},
 async foodArrived(){try{await orders.act('foodArrived',{id:this.id});this.refresh();}catch(e){ui.toast(e);}},
 async riderPhoto(e){
  if(this.data.photoBusy)return ui.toast(this.data.zh?'正在处理上一张照片，请稍候':'Still handling the previous photo');
  const append=e?.currentTarget?.dataset?.mode==='append',r=store.get().requests.find(x=>x.id===this.id);
  if(!r)return ui.toast(this.data.zh?'订单还没同步完成，请稍后重试':'The order has not synced yet, please retry');
  if(!r.isMine||r.category!=='takeout'||!['waiting','taken'].includes(r.status))return ui.toast(this.data.zh?'接单或送达之后就不能再改骑手照片了':'Rider photos are locked once the order moves on');
  this.setData({photoBusy:true});this.watchPhotoBusy();
  try{
   await this.checkRiderPhotoSupport();
   const existing=append?require('../../utils/rider-photos').paths(r):[],remaining=3-existing.length;
   if(remaining<=0)return ui.toast(this.data.zh?'最多上传 3 张照片':'Upload up to 3 photos');
   const selected=await ui.photos(['album','camera'],remaining);
   if(!selected.length)return;
   const next=[...new Set(existing.concat(selected))].slice(0,3);
   this.showRiderPhotos(next);
   await this.saveRiderPhotos(next);
  }catch(e){this.refresh();if(!/cancel/i.test(e.errMsg||e.message||''))ui.toast(e);}
  finally{this.clearPhotoWatch();this.setData({photoBusy:false});}
 },
 async checkRiderPhotoSupport(){
  if(store.get().orderCapabilities?.riderPhotos)return;
  let ok=false,timer=null;
  const timeout=new Promise(resolve=>{timer=setTimeout(resolve,5000);});
  try{await Promise.race([orders.sync().then(()=>{ok=true;},()=>{}),timeout]);}finally{if(timer)clearTimeout(timer);}
  if(store.get().orderCapabilities?.riderPhotos)return;
  throw Error(ok?(this.data.zh?'云端服务版本过旧：请在开发者工具里右键 cloudfunctions/orderService → 上传并部署':'The cloud service is outdated: right-click cloudfunctions/orderService and choose Upload and Deploy'):(this.data.zh?'网络较慢，没拿到云端信息，请重试':'Slow network, could not reach the cloud, please retry'));
 },
 async saveRiderPhotos(paths){const photos=await Promise.all(paths.map(path=>orders.upload(path)));this.showRiderPhotos(photos);await orders.act('riderPhoto',{id:this.id,photos,replace:true});this.refresh();},
 // Paint the picked or uploaded paths immediately; refresh() replaces them with signed URLs afterwards.
 showRiderPhotos(photos){const view=this.data.request;if(!view)return;this.setData({request:{...view,riderPhotos:photos,riderPhoto:photos[0]||''}});},
 watchPhotoBusy(){this.clearPhotoWatch();this._photoWatch=setTimeout(()=>{this._photoWatch=null;if(!this.data.photoBusy)return;this.setData({photoBusy:false});ui.toast(this.data.zh?'处理超时了，请再试一次':'That took too long, please try again');},20000);},
 clearPhotoWatch(){if(this._photoWatch){clearTimeout(this._photoWatch);this._photoWatch=null;}},
 async removeRiderPhoto(e){
  if(this.data.photoBusy)return;
  const r=store.get().requests.find(r=>r.id===this.id),index=Number(e.currentTarget.dataset.index),photos=require('../../utils/rider-photos').paths(r);
  if(!r?.isMine||!['waiting','taken'].includes(r.status)||!Number.isInteger(index)||index<0||index>=photos.length)return;
  this.setData({photoBusy:true});try{await this.checkRiderPhotoSupport();await this.saveRiderPhotos(photos.filter((_,i)=>i!==index));}catch(e){ui.toast(e);}finally{this.setData({photoBusy:false});}
 },
 preview(){ui.preview(this.data.request.photo);},previewRider(e){const urls=this.data.request.riderPhotos||[],index=Number(e?.currentTarget?.dataset?.index||0);if(urls[index])wx.previewImage({urls,current:urls[index]});},previewPictures(e){const urls=this.data.request.orderPictures||[],index=Number(e.currentTarget.dataset.index);if(urls[index])wx.previewImage({urls,current:urls[index]});},
 chat(){require('../../utils/nav').navigateTo({url:'/pages/chat/index?id='+this.id});},phone(){const r=this.data.request;if(r.runnerPhone)wx.makePhoneCall({phoneNumber:r.runnerPhone});else ui.toast(this.data.zh?'暂无可用的手机号。':'No phone number is available.');},openLateOptions(){if(this.data.request&&this.data.request.canMoveEta)this.setData({lateOptionsOpen:!this.data.lateOptionsOpen,lateCustomOpen:false,lateMinutes:''});},chooseLatePreset(e){this.applyLateMinutes(Number(e.currentTarget.dataset.minutes));},chooseLateOther(){this.setData({lateCustomOpen:true,lateMinutes:''});},inputLateMinutes(e){const lateMinutes=String(e.detail.value||'').replace(/\D/g,'');this.setData({lateMinutes});return lateMinutes;},confirmLateCustom(){this.applyLateMinutes(Number(this.data.lateMinutes));},async applyLateMinutes(minutes){const zh=this.data.zh;if(!Number.isSafeInteger(minutes)||minutes<1)return ui.toast(new Error(zh?'请输入有效的分钟数':'Enter a valid number of minutes'));try{await orders.act('foodLate',{id:this.id,minutes});this.setData({lateOptionsOpen:false,lateCustomOpen:false,lateMinutes:''});this.refresh();}catch(e){ui.toast(e);}},jobs(){wx.reLaunch({url:'/pages/jobs/index'});},repeat(){const r=this.data.request;require('../../utils/nav').navigateTo({url:r.category==='takeout'?'/pages/takeaway/index?repeat='+r.id:'/pages/create/index?mode=request&category=parcel&repeat='+r.id});}
});
