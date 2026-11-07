const {postCopy}=require('../../utils/post-copy');
const orders=require('../../utils/orders');
const store=require('../../utils/store'),d=require('../../utils/domain'),f=require('../../utils/workflow'),ui=require('../../utils/ui'),copy=require('../../utils/orders-copy');
function progressSteps(r,zh){
 const task=r.category==='task',labels=task?(zh?['已发布','已接单','进行中','已完成','已确认']:['Posted','Accepted','In progress','Completed','Confirmed']):(zh?['已发布','已接单','已取件','已送达','已确认']:['Posted','Accepted','Picked up','Delivered','Confirmed']);
 const index=r.status==='confirmed'?4:['delivered','disputed'].includes(r.status)?3:r.status==='collected'?2:r.status==='taken'?1:0;
 const times=[r.createdAt,r.takenAt,r.collectedAt||r.takenAt,r.deliveredAt,r.confirmedAt];
 return labels.map((name,i)=>({name,time:times[i]?f.clock(times[i]):'',done:i<index,current:i===index}));
}
Page({data:{...require('../../utils/motion').data(),request:null,photoBusy:false,posted:false,celebrate:false,videoSrc:'',videoFailed:false,successUI:postCopy('posted','zh'),reporting:false,reason:'',issuePhoto:'',issueNote:'',lateOptionsOpen:false,lateCustomOpen:false,lateMinutes:'',latePresets:[10,20,30],offerAmounts:[1.88,3.88,5.88,8.88,13.88,18.88],customOffer:'',cancelWindow:{phase:'hidden',canCancel:false,tip:'',button:'',clock:''},reasons:['Not received','Malicious order','Runner unreachable','Harassment','Damaged or lost','Fake proof','Something else'],reasonLabels:[],zh:false},onLoad(o){this.id=o.id;this.setData({posted:o.posted==='1',celebrate:o.celebrate==='1'&&require('../../utils/motion').enabled()});},onShow(){if(wx.setNavigationBarTitle&&store.get().language!=='en')wx.setNavigationBarTitle({title:'订单详情'});orders.bind(this);},onHide(){require('../../utils/customer-cancel').stop(this);orders.unbind(this);},onUnload(){this._unloaded=true;require('../../utils/customer-cancel').stop(this);orders.unbind(this);},
 refresh(){const s=store.get(),zh=s.language!=='en',lang=zh?'zh':'en',cancelUi=require('../../utils/customer-cancel'),r=s.requests.find(x=>x.id===this.id&&(x.isMine||x.isRunner));if(!r){cancelUi.stop(this);this.setData({request:null,zh,cancelWindow:cancelUi.view(null,zh)});return;}const t=s.trips.find(x=>x.id===r.runnerId);const v=f.view(r,lang),request={...v,unitLabel:copy.translate(v.unit,lang),deliveryLocationLabel:copy.translate(v.deliveryLocation||'',lang),disputeReason:v.dispute?copy.translate(v.dispute.reason,lang):'',canMoveEta:!r.etaMoved&&Date.now()<=(r.arrivalAt||0)+600000,canReport:r.status==='delivered'&&(r.category!=='takeout'||Date.now()<=r.deliveredAt+30*60000),runnerName:r.runnerName||t&&t.runnerName||''};this.setData({zh,successUI:postCopy('posted',lang),reasonLabels:this.data.reasons.map(x=>copy.translate(x,lang)),request,runner:cancelUi.runnerLabel(request,zh),steps:progressSteps(r,zh),cancelWindow:cancelUi.sync(this,request,zh)});if(this.data.celebrate&&!this.videoAsked)this.loadVideo(r.category==='takeout'?'takeout':'express');},
 onMotionChange(enabled){if(!enabled){this.videoAsked=true;this.setData({celebrate:false,videoSrc:''});}},
 loadVideo(kind){if(!require('../../utils/motion').enabled())return this.onMotionChange(false);this.videoAsked=true;require('../../utils/yuni-video').prepare(kind).then(videoSrc=>{if(!this._unloaded&&this.data.celebrate&&require('../../utils/motion').enabled())this.setData({videoSrc});},()=>{if(!this._unloaded&&this.data.celebrate&&require('../../utils/motion').enabled())this.setData({videoFailed:true});});},videoError(){this.setData({videoFailed:true});},closeCelebrate(){this.setData({celebrate:false});},track(){this.closeCelebrate();},noop(){},
 customRaise(){require('../../utils/custom-offer')(this);},customOfferInput(e){this.setData({customOffer:e.detail.value});},submitCustomOffer(){const text=String(this.data.customOffer||'').trim(),amount=Number(text),zh=this.data.zh;if(!/^\d+(\.\d{1,2})?$/.test(text)||!(amount>=0.01))return ui.toast(new Error(zh?'请输入 ¥0.01 起、最多两位小数的金额':'Enter at least ¥0.01, with up to 2 decimal places'));return this.raise({currentTarget:{dataset:{amount}}});},async raise(e){const amount=Number(e.currentTarget.dataset.amount);const zh=this.data.zh;if(!await ui.confirm(zh?'赏金加价 ¥'+amount+'？':'Raise the offer by ¥'+amount+'?',zh?'加价金额只对整笔订单计算一次。当前为预览版，不会产生真实付款。接单后也可以加价。':'This amount is added once to the whole order. No real payment is made in this preview. You can add to the offer after a runner accepts.'))return;try{await orders.act('raise',{id:this.id,amount});this.setData({customOffer:''});this.refresh();}catch(e){ui.toast(e);}},
 async cancel(){const zh=this.data.zh,cancel=this.data.cancelWindow;if(!cancel||!cancel.canCancel)return;const grace=cancel.phase==='grace';if(!await ui.confirm(zh?'取消这笔订单？':'Cancel this order?',grace?(zh?'跑手刚接单，3 分钟内仍可取消，测试金额全额退回。':'A runner just accepted. You can still cancel, and the demo amount is refunded.'):(zh?'还没有跑手接单，测试金额全额退回。':'No runner has accepted yet. The demo amount is refunded.')))return;try{await orders.act('cancel',{id:this.id});this.refresh();}catch(e){ui.toast(e);}},
 async confirm(){try{await orders.act('confirm',{id:this.id});this.refresh();}catch(e){ui.toast(e);}},
 issue(){this.setData({reporting:true});},backIssue(){this.setData({reporting:false});},chooseReason(e){this.setData({reason:e.currentTarget.dataset.value});},note(e){this.setData({issueNote:e.detail.value});},
 async addIssuePhoto(){try{this.setData({issuePhoto:await ui.photo(['camera','album'])});}catch(e){if(!/cancel/i.test(e.errMsg||''))ui.toast(e);}},
 async report(){try{await orders.act('report',{id:this.id,reason:this.data.reason,photo:await orders.upload(this.data.issuePhoto),note:this.data.issueNote});this.setData({reporting:false});this.refresh();}catch(e){ui.toast(e);}},
 async foodArrived(){try{await orders.act('foodArrived',{id:this.id});this.refresh();}catch(e){ui.toast(e);}},
 async riderPhoto(e){
  if(this.data.photoBusy)return;
  const append=e?.currentTarget?.dataset?.mode==='append',r=store.get().requests.find(r=>r.id===this.id);
  if(!r?.isMine||r.category!=='takeout'||!['waiting','taken'].includes(r.status))return;
  this.setData({photoBusy:true});
  try{
   await this.checkRiderPhotoSupport();
   const existing=append?require('../../utils/rider-photos').paths(r):[],remaining=3-existing.length;
   if(remaining<=0)return ui.toast(this.data.zh?'最多上传 3 张照片':'Upload up to 3 photos');
   const selected=await ui.photos(['album','camera'],remaining);
   if(!selected.length)return;
   await this.saveRiderPhotos([...new Set(existing.concat(selected))].slice(0,3));
  }catch(e){if(!/cancel/i.test(e.errMsg||e.message||''))ui.toast(e);}finally{this.setData({photoBusy:false});}
 },
 async checkRiderPhotoSupport(){
  if(!store.get().orderCapabilities?.riderPhotos)await orders.sync();
  if(!store.get().orderCapabilities?.riderPhotos)throw Error(this.data.zh?'多图上传需要先更新云端服务。':'Update the cloud service to enable multiple rider photos.');
 },
 async saveRiderPhotos(paths){const photos=await Promise.all(paths.map(path=>orders.upload(path)));await orders.act('riderPhoto',{id:this.id,photos,replace:true});this.refresh();},
 async removeRiderPhoto(e){
  if(this.data.photoBusy)return;
  const r=store.get().requests.find(r=>r.id===this.id),index=Number(e.currentTarget.dataset.index),photos=require('../../utils/rider-photos').paths(r);
  if(!r?.isMine||!['waiting','taken'].includes(r.status)||!Number.isInteger(index)||index<0||index>=photos.length)return;
  this.setData({photoBusy:true});try{await this.checkRiderPhotoSupport();await this.saveRiderPhotos(photos.filter((_,i)=>i!==index));}catch(e){ui.toast(e);}finally{this.setData({photoBusy:false});}
 },
 preview(){ui.preview(this.data.request.photo);},previewRider(e){const urls=this.data.request.riderPhotos||[],index=Number(e?.currentTarget?.dataset?.index||0);if(urls[index])wx.previewImage({urls,current:urls[index]});},previewPictures(e){const urls=this.data.request.orderPictures||[],index=Number(e.currentTarget.dataset.index);if(urls[index])wx.previewImage({urls,current:urls[index]});},
 chat(){require('../../utils/nav').navigateTo({url:'/pages/chat/index?id='+this.id});},phone(){const r=this.data.request;if(r.runnerPhone)wx.makePhoneCall({phoneNumber:r.runnerPhone});else ui.toast(this.data.zh?'暂无可用的手机号。':'No phone number is available.');},openLateOptions(){if(this.data.request&&this.data.request.canMoveEta)this.setData({lateOptionsOpen:!this.data.lateOptionsOpen,lateCustomOpen:false,lateMinutes:''});},chooseLatePreset(e){this.applyLateMinutes(Number(e.currentTarget.dataset.minutes));},chooseLateOther(){this.setData({lateCustomOpen:true,lateMinutes:''});},inputLateMinutes(e){const lateMinutes=String(e.detail.value||'').replace(/\D/g,'');this.setData({lateMinutes});return lateMinutes;},confirmLateCustom(){this.applyLateMinutes(Number(this.data.lateMinutes));},async applyLateMinutes(minutes){const zh=this.data.zh;if(!Number.isSafeInteger(minutes)||minutes<1)return ui.toast(new Error(zh?'请输入有效的分钟数':'Enter a valid number of minutes'));try{await orders.act('foodLate',{id:this.id,minutes});this.setData({lateOptionsOpen:false,lateCustomOpen:false,lateMinutes:''});this.refresh();}catch(e){ui.toast(e);}},jobs(){wx.reLaunch({url:'/pages/jobs/index'});},repeat(){const r=this.data.request;require('../../utils/nav').navigateTo({url:r.category==='takeout'?'/pages/takeaway/index?repeat='+r.id:'/pages/create/index?mode=request&category=parcel&repeat='+r.id});}
});
