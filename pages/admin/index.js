const store=require('../../utils/store'),account=require('../../utils/account'),orders=require('../../utils/orders');
const STATUS={zh:{waiting:'待接单',taken:'已接单',collected:'已取件',delivered:'待确认',confirmed:'已完成',cancelled:'已取消',refunded:'已退款',disputed:'有争议'},en:{waiting:'Waiting',taken:'Taken',collected:'Collected',delivered:'Awaiting confirm',confirmed:'Completed',cancelled:'Cancelled',refunded:'Refunded',disputed:'Disputed'}};
const CATEGORY={zh:{takeout:'外卖',parcel:'快递',task:'任务'},en:{takeout:'Takeaway',parcel:'Parcel',task:'Task'}};
const time=require('../../utils/china-time').short;
Page({
 data:{zh:true,checking:true,admin:false,busy:false,error:'',username:'',password:'',stats:null,cards:[],bucket:'all',bucketLabel:'',orders:[],ordersLoading:false,applications:[],reviewing:'',supportInbox:[],supportDraft:{},replying:''},
 onLoad(){this.setData({zh:store.get().language!=='en'});wx.setNavigationBarTitle({title:this.data.zh?'管理后台':'Admin'});},
 async onShow(){this.setData({checking:true,error:''});try{const r=await account.call('adminStatus');this.setData({admin:!!r.admin});if(r.admin)await this.load();}catch(e){this.setData({error:e.message});}finally{this.setData({checking:false});}},
 async onPullDownRefresh(){try{if(this.data.admin)await this.load();}catch(e){this.setData({error:e.message});}finally{wx.stopPullDownRefresh();}},
 field(e){this.setData({[e.currentTarget.dataset.field]:e.detail.value});},
 async login(){if(this.data.busy)return;const zh=this.data.zh;if(!this.data.username.trim()||!this.data.password){this.setData({error:zh?'请输入管理员账号和密码。':'Enter the admin username and password.'});return;}this.setData({busy:true,error:''});try{await account.call('adminLogin',{username:this.data.username.trim(),password:this.data.password});this.setData({admin:true,password:''});await this.load();}catch(e){this.setData({error:e.message});}finally{this.setData({busy:false});}},
 async logout(){try{await account.call('adminLogout');}catch(_){}this.setData({admin:false,stats:null,cards:[],orders:[],applications:[],username:'',password:''});},
 async load(){
  const zh=this.data.zh,r=await account.call('adminDashboard'),s=r.stats;
  const cards=[{key:'all',label:zh?'总订单':'Total orders',value:s.total,tap:true},{key:'waiting',label:zh?'待接单':'Waiting',value:s.waiting,tap:true},{key:'unpaid',label:zh?'未付款':'Unpaid',value:s.unpaid,tap:true},{key:'completed',label:zh?'已完成':'Completed',value:s.completed,tap:true},{key:'users',label:zh?'平台用户':'Users',value:s.users},{key:'runners',label:zh?'跑腿员':'Runners',value:s.runners}];
  await orders.sync();
  const topics={order:zh?'订单问题':'Order',payment:zh?'付款或退款':'Payment / refund',other:zh?'其他问题':'Other',deletion:zh?'删除账户与数据':'Account deletion'};
  const supportInbox=(store.get().supportInbox||[]).map(t=>({...t,accountLabel:t.accountId.slice(0,8),topicLabel:topics[t.topic]||t.topic,time:time((t.messages||[]).at(-1)?.at||t.createdAt),messages:(t.messages||[]).map(m=>({...m,time:time(m.at)}))}));
  this.setData({stats:s,cards,supportInbox,applications:(r.applications||[]).map(a=>({...a,time:time(a.submittedAt)}))});
  await this.loadOrders(this.data.bucket);
 },
 async loadOrders(bucket){const zh=this.data.zh,card=this.data.cards.find(c=>c.key===bucket);this.setData({bucket,bucketLabel:card?card.label:'',ordersLoading:true});try{const r=await account.call('adminOrders',{bucket});const lang=zh?'zh':'en';this.setData({orders:(r.orders||[]).map(o=>({...o,statusText:STATUS[lang][o.status]||o.status,categoryText:CATEGORY[lang][o.category]||o.category,place:[o.station,o.dorm].filter(Boolean).join(' → '),reward:o.reward.toFixed(2),time:time(o.createdAt)}))});}catch(e){this.setData({error:e.message});}finally{this.setData({ordersLoading:false});}},
 pick(e){const key=e.currentTarget.dataset.key,card=this.data.cards.find(c=>c.key===key);if(!card||!card.tap||this.data.ordersLoading)return;this.loadOrders(key);},
 approve(e){this.review(e.currentTarget.dataset.id,'approve','');},
 reject(e){const id=e.currentTarget.dataset.id,zh=this.data.zh;wx.showModal({title:zh?'拒绝申请':'Reject application',editable:true,placeholderText:zh?'未通过原因（申请人可见）':'Reason for rejection (visible to the applicant)',confirmText:zh?'拒绝':'Reject',cancelText:zh?'取消':'Cancel',success:r=>{if(r.confirm)this.review(id,'reject',r.content||'');}});},
 async review(accountId,decision,note){if(this.data.reviewing)return;const zh=this.data.zh;this.setData({reviewing:accountId,error:''});try{await account.call('review',{accountId,decision,note});wx.showToast({title:decision==='approve'?(zh?'已通过':'Approved'):(zh?'已拒绝':'Rejected'),icon:'success'});await this.load();}catch(e){this.setData({error:e.message});}finally{this.setData({reviewing:''});}},
 supportInput(e){this.setData({['supportDraft.'+e.currentTarget.dataset.id]:e.detail.value});},
 async supportReply(e){const {account,ticket}=e.currentTarget.dataset,text=String(this.data.supportDraft[ticket]||'').trim();if(this.data.replying||!text)return;this.setData({replying:ticket,error:''});try{await orders.act('supportReply',{accountId:account,ticketId:ticket,text});this.setData({['supportDraft.'+ticket]:''});await this.load();}catch(error){this.setData({error:error.message});}finally{this.setData({replying:''});}},
 copy(e){wx.setClipboardData({data:String(e.currentTarget.dataset.value||'')});}
});
