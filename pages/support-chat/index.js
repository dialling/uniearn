const orders=require('../../utils/orders'),store=require('../../utils/store'),f=require('../../utils/workflow');
Page({data:{zh:true,topic:'other',messages:[],text:'',hello:'',error:'',topicOptions:[]},
 onLoad(o={}){if(['order','payment','other','deletion'].includes(o.topic))this.setData({topic:o.topic});},
 onShow(){orders.bind(this);this.refresh();},
 onHide(){orders.unbind(this);},
 onUnload(){orders.unbind(this);},
 refresh(){const zh=this.data.zh,s=store.get(),tickets=(s.supportTickets||[]).filter(t=>t.status==='open'),t=tickets.at(-1);this.setData({hello:zh?'你好，这里是 Uniearn 团队。有什么需要帮助？':'Hi, this is the Uniearn team. How can we help?',topicOptions:zh?[{id:'order',label:'订单问题'},{id:'payment',label:'付款或退款'},{id:'other',label:'其他问题'},{id:'deletion',label:'申请删除账户与数据'}]:[{id:'order',label:'A problem with an order'},{id:'payment',label:'Payment or refund'},{id:'other',label:'Something else'},{id:'deletion',label:'Request account and data deletion'}],messages:(t&&t.messages||[]).map(m=>({...m,time:f.clock(m.at)}))});},
 chooseTopic(e){this.setData({topic:e.currentTarget.dataset.id});},
 input(e){this.setData({text:e.detail.value});},
 async send(){if(this.sending||!this.data.text.trim())return;this.sending=true;this.setData({error:''});try{await orders.act('supportMessage',{text:this.data.text,topic:this.data.topic});this.setData({text:''});}catch(e){this.setData({error:e.message});}finally{this.sending=false;}}});
