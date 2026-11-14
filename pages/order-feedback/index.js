const orders=require('../../utils/orders'),store=require('../../utils/store'),flow=require('../../utils/workflow'),ui=require('../../utils/ui'),reasonCopy=require('../../utils/report-reasons');
// 2026-11-14: this page is a chat with the Uniearn team for one order: pick the problem first, then chat.
// Team replies show here and as unread on My orders.
Page({data:{...require('../../utils/motion').data(),zh:true,request:null,ticket:null,messages:[],reason:'',note:'',photo:'',busy:false,uploading:false,error:'',canSubmit:false,reasons:[],photoRequired:false,sentAny:false},
 onLoad(o={}){this.id=o.id||'';},onShow(){orders.bind(this);},onHide(){orders.unbind(this);},onUnload(){orders.unbind(this);},
 refresh(){const s=store.get(),zh=s.language!=='en',r=s.requests.find(r=>r.id===this.id&&(r.isMine||r.isRunner));if(wx.setNavigationBarTitle)wx.setNavigationBarTitle({title:zh?'联系 UniEarn':'Chat with UniEarn'});
  if(!r){this.setData({request:null,zh});return;}
  const orderTickets=(s.supportTickets||[]).filter(t=>t.orderId===r.id),ticket=orderTickets.at(-1)||null;
  const reasons=reasonCopy.list(r,!r.isMine&&!!r.isRunner,zh);
  const messages=orderTickets.flatMap(t=>(t.messages||[]).map((m,i)=>({...m,recordKey:t.id+'-'+i}))).filter(m=>!m.contactChannel).map(m=>({key:m.recordKey,mine:!!m.mine,text:m.mine&&m.note!==undefined?m.note:(zh&&m.textZh?m.textZh:m.text),reasonLabel:m.mine&&m.reason&&m.reason!=='Something else'?reasonCopy.label(m.reason,zh):'',photo:m.photo?orders.photoURL(m.photo):'',time:require('../../utils/china-time').dateTime(m.at)}));
  const feedback=flow.view(r,zh?'zh':'en');
  const sentAny=messages.some(m=>m.mine);this.setData({zh,request:feedback,paused:r.status==='disputed',canResolve:feedback.canResolveFeedback,ticket,messages,sentAny,waitingReply:sentAny&&!!messages.length&&messages[messages.length-1].mine,willPause:!!r.isMine&&r.status==='delivered',reasons});this.validate();
  // Opening the chat marks the team's replies as read once per visit.
  if(Number(r.supportUnread)>0&&!this.marking){this.marking=true;orders.act('orderFeedbackRead',{id:this.id}).catch(()=>{}).finally(()=>{this.marking=false;});}
 },
 choose(e){if(this.data.busy)return;const reason=e.currentTarget.dataset.reason,item=this.data.reasons.find(x=>x.id===reason);this.setData({reason,photoRequired:!!(item&&item.photo)});this.validate();},
 input(e){this.setData({note:e.detail.value});this.validate();},
 validate(){this.setData({canSubmit:String(this.data.note||'').trim().length>=1&&(this.data.sentAny||!!this.data.reason)});},
 async choosePhoto(){if(this.data.busy||this.data.uploading)return;this.setData({uploading:true});try{this.setData({photo:await ui.photo(['camera','album'])});}catch(e){if(!/cancel/i.test(e.errMsg||e.message||''))ui.toast(e);}finally{this.setData({uploading:false});}},
 removePhoto(){if(!this.data.busy)this.setData({photo:''});},preview(e){ui.preview(e.currentTarget.dataset.photo);},
 async submit(){if(this.data.busy||this.data.uploading||!this.data.canSubmit)return;const zh=this.data.zh;if(this.data.photoRequired&&!this.data.photo)return ui.toast(zh?'这个问题需要附一张照片':'This issue needs a photo');
  this.setData({busy:true,error:''});try{await orders.act('orderFeedbackSubmit',{id:this.id,reason:this.data.reason,note:this.data.note.trim(),photo:await orders.upload(this.data.photo)});this.setData({note:'',photo:'',reason:'',photoRequired:false,canSubmit:false});this.refresh();}catch(error){this.setData({error:error.message});}finally{this.setData({busy:false});}
 },
 async resolve(){if(this.data.busy||!this.data.canResolve)return;const zh=this.data.zh;this.setData({busy:true,error:''});try{if(!await ui.confirm(zh?'确认问题已解决？':'Confirm the issue is resolved?',this.data.request.feedbackResolutionCompletes?(zh?'确认后，本单将完成并按原规则向跑手结算。':'This completes the order and settles the runner’s earnings.'):(zh?'确认后关闭你提交的反馈，订单继续原来的流程。':'This closes your feedback, and the order resumes its normal workflow.'),{confirmText:zh?'已解决':'Yes, resolved',cancelText:zh?'还没有':'Not yet'}))return;await orders.act('orderFeedbackResolve',{id:this.id});this.refresh();}catch(error){this.setData({error:error.message});}finally{this.setData({busy:false});}}
});
