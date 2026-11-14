const orders=require('../../utils/orders'),store=require('../../utils/store'),f=require('../../utils/workflow'),ui=require('../../utils/ui');
Page({data:{...require('../../utils/motion').data(),zh:true,topic:'',messages:[],text:'',canSend:false,sending:false,hello:'',error:'',topicOptions:[]},
 onLoad(o={}){if(['order','payment','other','deletion'].includes(o.topic))this.setData({topic:o.topic});},
 onShow(){orders.bind(this);this.refresh();},
 onHide(){orders.unbind(this);},
 onUnload(){orders.unbind(this);},
 refresh(){const zh=this.data.zh,s=store.get(),tickets=(s.supportTickets||[]).filter(t=>!t.orderId),t=tickets.at(-1);this.setData({hello:zh?'你好，这里是 Uniearn 团队。有什么需要帮助？':'Hi, this is the UniEarn team. How can we help?',topicOptions:zh?[{id:'order',label:'订单问题'},{id:'payment',label:'付款或退款'},{id:'other',label:'其他问题'},{id:'deletion',label:'申请删除账户与数据'}]:[{id:'order',label:'Order issue'},{id:'payment',label:'Payment or refund'},{id:'other',label:'Something else'},{id:'deletion',label:'Request account and data deletion'}],messages:(t&&t.messages||[]).map(m=>({...m,photo:m.photo?orders.photoURL(m.photo):'',time:f.clock(m.at)}))});},
 chooseTopic(e){const id=e.currentTarget.dataset.id;this.setData({topic:this.data.topic===id?'':id});},
 input(e){const text=e.detail.value;this.setData({text,canSend:!!text.trim()});},
 async send(){const text=this.data.text.trim();if(this.data.sending||!text)return;this.setData({sending:true,error:''});try{await orders.act('supportMessage',{text,topic:this.data.topic});this.setData({text:'',canSend:false});}catch(e){this.setData({error:e.message});}finally{this.setData({sending:false});}},
 previewPhoto(e){ui.preview(e.currentTarget.dataset.photo);},
 async sendPhoto(){if(this.data.sending)return;this.setData({sending:true,error:''});try{const path=await ui.photo(['album','camera']);const photo=await orders.upload(path);await orders.act('supportMessage',{photo,topic:this.data.topic});}catch(e){if(!/cancel/i.test(e.errMsg||e.message||''))this.setData({error:e.message||(this.data.zh?'图片发送失败':'Could not send the photo')});}finally{this.setData({sending:false});}}});
