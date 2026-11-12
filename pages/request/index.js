const {postCopy}=require('../../utils/post-copy');
const orders=require('../../utils/orders');
const store=require('../../utils/store'),d=require('../../utils/domain'),f=require('../../utils/workflow'),ui=require('../../utils/ui'),copy=require('../../utils/orders-copy');
function progressSteps(r,zh){
 const task=r.category==='task',labels=task?(zh?['已发布','已接单','进行中','已完成','已确认']:['Posted','Accepted','In progress','Completed','Confirmed']):(zh?['已发布','已接单','已取件','已送达','已确认']:['Posted','Accepted','Picked up','Delivered','Confirmed']);
 const index=r.status==='confirmed'?4:['delivered','disputed'].includes(r.status)?3:r.status==='collected'?2:r.status==='taken'?1:0;
 const times=[r.createdAt,r.takenAt,r.collectedAt||r.takenAt,r.deliveredAt,r.confirmedAt];
 return labels.map((name,i)=>({name,time:times[i]?f.clock(times[i]):'',done:i<index,current:i===index}));
}
function journeyState(r,zh){
 const titles={waiting:zh?'等待跑手接单':'Waiting for a runner',taken:zh?'跑手已接单':'Runner accepted',collected:zh?'已取件':'Picked up',delivered:zh?'已送达':'Delivered',confirmed:zh?'订单已完成':'Order complete',cancelled:zh?'订单已取消':'Order cancelled',refunded:zh?'订单已退款':'Order refunded',disputed:zh?'反馈处理中':'Under review'};
 const notes={waiting:zh?'订单已发布，正在等待跑手。':'Your order is on the job board.',taken:zh?'跑手已接下订单，可在下方联系对方。':'Your runner has accepted. Contact them below.',collected:zh?'跑手已取到物品。':'Your runner has collected your items.',delivered:zh?'请核对送达照片，收到后确认。':'Check the delivery photo and confirm receipt.',confirmed:zh?'感谢确认，期待下一次顺路相助。':'Thanks for confirming your order.',cancelled:zh?'这笔订单已结束。':'This order has been closed.',refunded:zh?'退款信息可在订单记录中查看。':'View refund details in your order record.',disputed:zh?'我们会核实你提交的反馈。':'Your report is being reviewed.'};
 let pickup=String(r.pickupDisplay||r.pickupPointDisplay||r.station||'');pickup=pickup.replace(/Fengshihui KFC takeaway locker/i,'KFC locker').replace('丰食汇KFC外卖柜','KFC外卖柜');if(pickup.length>18)pickup=pickup.slice(0,17)+'…';return{title:r.feedbackOpen?(zh?'反馈处理中':'Feedback in progress'):titles[r.status]||r.statusLabel,note:r.feedbackOpen?(r.status==='disputed'?(zh?'自动结单已暂停'+(r.holdTime?'至 '+r.holdTime:'')+'，请跟进反馈。':'Auto-confirmation is paused'+(r.holdTime?' until '+r.holdTime:'')+'. Check feedback.'):(zh?'该订单有待处理反馈，请查看并跟进。':'This order has unresolved feedback.')):notes[r.status]||'',posted:f.clock(r.createdAt),pickupShort:pickup,mascot:'/assets/yuni-journey-ticket.png'};
}
Page({data:{...require('../../utils/motion').data(),request:null,photoBusy:false,cancelling:false,raising:false,offerAmounts:[1.88,3.88,5.88,8.88,13.88,18.88],posted:false,celebrate:false,videoSrc:'',videoFailed:false,successUI:postCopy('posted','zh'),reporting:false,reason:'',issuePhoto:'',issueNote:'',lateOptionsOpen:false,lateCustomOpen:false,lateMinutes:'',latePresets:[10,20,30],cancelOpen:false,cancelOptions:[],cancelReason:'',cancelNote:'',cancelNoteOpen:false,cancelReady:false,cancelWindow:{phase:'hidden',canCancel:false,tip:'',button:'',clock:''},reasons:['Not received','Malicious order','Runner unreachable','Harassment','Damaged or lost','Fake proof','Something else'],reasonLabels:[],zh:false},onLoad(o){this.id=o.id;this.setData({posted:o.posted==='1',celebrate:o.celebrate==='1'&&require('../../utils/motion').enabled()});},onShow(){if(wx.setNavigationBarTitle&&store.get().language!=='en')wx.setNavigationBarTitle({title:'订单详情'});orders.bind(this);},onHide(){require('../../utils/customer-cancel').stop(this);orders.unbind(this);},onUnload(){this._unloaded=true;require('../../utils/customer-cancel').stop(this);orders.unbind(this);},
 refresh(){const s=store.get(),zh=s.language!=='en',lang=zh?'zh':'en',cancelUi=require('../../utils/customer-cancel'),r=s.requests.find(x=>x.id===this.id&&(x.isMine||x.isRunner));if(!r){cancelUi.stop(this);this.setData({request:null,zh,cancelWindow:cancelUi.view(null,zh)});return;}const t=s.trips.find(x=>x.id===r.runnerId);const v=f.view(r,lang),request={...v,unitLabel:copy.translate(v.unit,lang),deliveryLocationLabel:copy.translate(v.deliveryLocation||'',lang),disputeReason:v.dispute?copy.translate(v.dispute.reason,lang):'',canMoveEta:!r.etaMoved&&Date.now()<=(r.arrivalAt||0)+600000,canReport:r.status==='delivered'&&Date.now()<(r.deliveredAt||0)+f.hours(r)*3600000,runnerName:r.runnerName||t&&t.runnerName||''};this.setData({zh,successUI:postCopy('posted',lang),reasonLabels:this.data.reasons.map(x=>copy.translate(x,lang)),request,journey:journeyState(request,zh),runner:cancelUi.runnerLabel(request,zh),steps:progressSteps(r,zh),cancelWindow:cancelUi.sync(this,request,zh)});cancelUi.syncOpen(this);if(this.data.celebrate&&!this.videoAsked)this.loadVideo(r.category==='takeout'?'takeout':'express');},
 onMotionChange(enabled){if(!enabled){this.videoAsked=true;this.setData({celebrate:false,videoSrc:''});}},
 loadVideo(kind){if(!require('../../utils/motion').enabled())return this.onMotionChange(false);this.videoAsked=true;require('../../utils/yuni-video').prepare(kind).then(videoSrc=>{if(!this._unloaded&&this.data.celebrate&&require('../../utils/motion').enabled())this.setData({videoSrc});},()=>{if(!this._unloaded&&this.data.celebrate&&require('../../utils/motion').enabled())this.setData({videoFailed:true});});},videoError(){this.setData({videoFailed:true});},closeCelebrate(){this.setData({celebrate:false});},track(){this.closeCelebrate();},noop(){},

 cancel(){require('../../utils/customer-cancel').openSheet(this);},chooseCancelReason(e){const next=require('../../utils/customer-cancel').choose(this,e);if(next&&next.submit)return this.submitCancel(next);},cancelNoteInput(e){require('../../utils/customer-cancel').note(this,e);},backCancel(){require('../../utils/customer-cancel').close(this);},async submitCancel(override){const sheet=require('../../utils/customer-cancel');if(this.data.cancelling||!((override&&override.submit)||this.data.cancelReady))return;let body;try{body=sheet.payload(this,override);}catch(e){ui.toast(e);return;}this.setData({cancelling:true});try{for(let attempt=0;attempt<2;attempt++){try{await orders.act('cancel',{id:this.id,...body});sheet.close(this,true);this.refresh();return;}catch(e){const msg=String(e&&e.message||'');if(attempt===0&&/还在处理|still finishing|Please wait/i.test(msg)){await new Promise(r=>setTimeout(r,1500));continue;}ui.toast(e);return;}}}finally{this.setData({cancelling:false});}},
 customRaise(){const r=this.data.request;if(!r||!r.isMine||r.status!=='waiting'||this.data.raising)return;require('../../utils/custom-offer')(this);},
 async raise(e){
  if(this.data.raising)return;const r=this.data.request,zh=this.data.zh,amount=Number(e.currentTarget.dataset.amount),remaining=Math.max(0,100-Number(r&&r.raised||0));
  if(!r||!r.isMine||r.status!=='waiting')return ui.toast(zh?'仅等待接单时可以加价':'You can increase the offer only while waiting');
  if(!Number.isFinite(amount)||amount<.01||amount>remaining||Math.abs(Math.round(amount*100)-amount*100)>1e-6)return ui.toast(zh?'请输入 ¥0.01–'+remaining.toFixed(2)+'，最多两位小数':'Enter ¥0.01–'+remaining.toFixed(2)+', up to 2 decimal places');
  this.setData({raising:true});try{const total=((Math.round(r.reward*100)+Math.round(amount*100))/100).toFixed(2);if(!await ui.confirm(zh?'加价 ¥'+amount.toFixed(2)+'？':'Increase by ¥'+amount.toFixed(2)+'?',zh?'本单赏金将变为 ¥'+total+'。仅在等待接单时可加价，当前为模拟金额。':'Your offer will become ¥'+total+'. Available before acceptance only. This is a simulated amount.'))return;
   await orders.act('raise',{id:this.id,amount});this.refresh();wx.showToast({title:zh?'加价成功':'Offer increased',icon:'success'});
  }catch(error){ui.toast(error);this.refresh();}finally{this.setData({raising:false});}
 },
 async confirm(){try{await orders.act('confirm',{id:this.id});this.refresh();}catch(e){ui.toast(e);}},
 issue(){if(this.id)require('../../utils/nav').navigateTo({url:'/pages/order-feedback/index?id='+encodeURIComponent(this.id)});},backIssue(){this.setData({reporting:false});},chooseReason(e){this.setData({reason:e.currentTarget.dataset.value});},note(e){this.setData({issueNote:e.detail.value});},
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
 chat(){require('../../utils/nav').navigateTo({url:'/pages/chat/index?id='+this.id});},phone(){const r=this.data.request;if(r.runnerPhone)wx.makePhoneCall({phoneNumber:r.runnerPhone});else ui.toast(this.data.zh?'暂无可用的手机号。':'No phone number is available.');},jobs(){wx.reLaunch({url:'/pages/jobs/index'});},repeat(){const r=this.data.request;require('../../utils/nav').navigateTo({url:r.category==='takeout'?'/pages/takeaway/index?repeat='+r.id:'/pages/create/index?mode=request&category=parcel&repeat='+r.id});}
});
