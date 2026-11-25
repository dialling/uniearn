const store=require('../../utils/store'),account=require('../../utils/account'),orders=require('../../utils/orders');
const STATUS={zh:{waiting:'待接单',taken:'已接单',collected:'已取件',delivered:'待确认',confirmed:'已完成',cancelled:'已取消',refunded:'已退款',disputed:'有争议'},en:{waiting:'Waiting',taken:'Taken',collected:'Collected',delivered:'Awaiting confirm',confirmed:'Completed',cancelled:'Cancelled',refunded:'Refunded',disputed:'Disputed'}};
const CATEGORY={zh:{takeout:'外卖',parcel:'快递',task:'任务'},en:{takeout:'Takeaway',parcel:'Parcel',task:'Task'}};
const time=require('../../utils/china-time').short;
Page({
 data:{...require('../../utils/motion').data(),zh:true,checking:true,admin:false,busy:false,error:'',username:'',password:'',stats:null,cards:[],bucket:'all',bucketLabel:'',orders:[],ordersLoading:false,applications:[],reviewing:'',supportInbox:[],supportDraft:{},replying:'',openTicket:'',navTop:20,navHeight:32},
 onLoad(){let navTop=20,navHeight=32;try{const m=wx.getMenuButtonBoundingClientRect();if(m&&m.top){navTop=m.top;navHeight=m.height;}}catch(_){}this.setData({zh:store.get().language!=='en',navTop,navHeight});wx.setNavigationBarTitle({title:this.data.zh?'管理后台':'Admin'});},
 home(){wx.reLaunch({url:'/pages/jobs/index'});},
 async toggleTicket(e){const id=e.currentTarget.dataset.id;
  if(this.data.openTicket===id){this.setData({openTicket:''});return;}
  this.setData({openTicket:id});
  try{
    const r=await account.call('adminCsMessages',{userId:Number(id)});
    const messages=(r.messages||[]).map(m=>({text:m.text||'',photo:m.photo||'',fromUser:!!m.fromUser,at:time(m.at||''),recalled:!!m.recalled}));
    this.setData({supportInbox:this.data.supportInbox.map(x=>x.id===id?{...x,messages}:x)});
  }catch(err){this.setData({error:err.message});}
 },
 async onShow(){this.setData({checking:true,error:''});try{const r=await account.call('adminStatus');this.setData({admin:!!r.admin});if(r.admin)await this.load();}catch(e){this.setData({error:e.message});}finally{this.setData({checking:false});}},
 async onPullDownRefresh(){try{if(this.data.admin)await this.load();}catch(e){this.setData({error:e.message});}finally{wx.stopPullDownRefresh();}},
 field(e){this.setData({[e.currentTarget.dataset.field]:e.detail.value});},
 async login(){if(this.data.busy)return;const zh=this.data.zh;if(!this.data.username.trim()||!this.data.password){this.setData({error:zh?'请输入管理员账号和密码。':'Enter the admin username and password.'});return;}this.setData({busy:true,error:''});try{await account.call('adminLogin',{username:this.data.username.trim(),password:this.data.password});this.setData({admin:true,password:''});await this.load();}catch(e){this.setData({error:e.message});}finally{this.setData({busy:false});}},
 async logout(){try{await account.call('adminLogout');}catch(_){}this.setData({admin:false,stats:null,cards:[],orders:[],applications:[],supportInbox:[],openTicket:'',username:'',password:''});},
 async load(){
  const zh=this.data.zh,r=await account.call('adminDashboard'),s=r.stats;
  const cards=[{key:'all',label:zh?'总订单':'Total orders',value:s.total,tap:true},{key:'waiting',label:zh?'待接单':'Waiting',value:s.waiting,tap:true},{key:'unpaid',label:zh?'未付款':'Unpaid',value:s.unpaid,tap:true},{key:'completed',label:zh?'已完成':'Completed',value:s.completed,tap:true},{key:'users',label:zh?'平台用户':'Users',value:s.users},{key:'runners',label:zh?'跑手':'Runners',value:s.runners}];
  await orders.sync();
  const topics={order:zh?'订单问题':'Order issue',payment:zh?'付款或退款':'Payment / refund',other:zh?'其他问题':'Other',deletion:zh?'删除账户与数据':'Account deletion'};
  // 客服会话来自后台真实接口（此前读本地云遗留 store，永远为空）
  const cs = await account.call('adminCsList').catch(() => ({ list: [] }));
  const supportInbox = (cs.list || []).map((c) => ({
    id: String(c.user_id), userId: c.user_id, accountId: String(c.user_id),
    topicLabel: c.nickname || ('用户#' + c.user_id), accountLabel: String(c.user_id),
    lastText: c.last_text || '', time: time(c.last_at || ''), unread: Number(c.unread) || 0,
    messages: []
  }));
  this.setData({stats:s,cards,supportInbox,applications:(r.applications||[]).map(a=>({...a,time:time(a.submittedAt)}))});
  await this.loadOrders(this.data.bucket);
 },
 async loadOrders(bucket){const zh=this.data.zh,card=this.data.cards.find(c=>c.key===bucket);this.setData({bucket,bucketLabel:card?card.label:'',ordersLoading:true});try{const r=await account.call('adminOrders',{bucket});const lang=zh?'zh':'en';this.setData({orders:(r.orders||[]).map(o=>({...o,statusText:STATUS[lang][o.status]||o.status,categoryText:CATEGORY[lang][o.category]||o.category,place:[o.station,o.dorm].filter(Boolean).join(' → '),reward:o.reward.toFixed(2),time:time(o.createdAt)}))});}catch(e){this.setData({error:e.message});}finally{this.setData({ordersLoading:false});}},
 pick(e){const key=e.currentTarget.dataset.key,card=this.data.cards.find(c=>c.key===key);if(!card||!card.tap||this.data.ordersLoading)return;this.loadOrders(key);},
 approve(e){this.review(e.currentTarget.dataset.id,'approve','');},
 reject(e){const id=e.currentTarget.dataset.id,zh=this.data.zh;wx.showModal({title:zh?'拒绝申请':'Reject application',editable:true,placeholderText:zh?'未通过原因（申请人可见）':'Reason for rejection (visible to the applicant)',confirmText:zh?'拒绝':'Reject',cancelText:zh?'取消':'Cancel',success:r=>{if(r.confirm)this.review(id,'reject',r.content||'');}});},
 async review(accountId,decision,note){if(this.data.reviewing)return;const zh=this.data.zh;this.setData({reviewing:accountId,error:''});try{await account.call('review',{accountId,decision,note});wx.showToast({title:decision==='approve'?(zh?'已通过':'Approved'):(zh?'已拒绝':'Rejected'),icon:'success'});await this.load();}catch(e){this.setData({error:e.message});}finally{this.setData({reviewing:''});}},
 async sendSupportImage(e){
   const id=e.currentTarget.dataset.id, zh=this.data.zh;
   if(this.data.replying)return;
   let path; try{ path=(await require('../../utils/image-input').chooseImage(['album','camera']))[0]; }catch(_){ return; }
   this.setData({replying:id,error:''});
   try{
     const up=await account.call('adminCsUploadImage',{path});
     await account.call('adminCsReply',{userId:Number(id),content:'',image:up.image});
     await this.load();
   }catch(err){this.setData({error:err.message});}
   finally{this.setData({replying:''});}
 },
 supportInput(e){this.setData({['supportDraft.'+e.currentTarget.dataset.id]:e.detail.value});},
 async supportReply(e){const {account,ticket}=e.currentTarget.dataset,text=String(this.data.supportDraft[ticket]||'').trim();if(this.data.replying||!text)return;this.setData({replying:ticket,error:''});try{await account.call('adminCsReply',{userId:Number(account),content:text});this.setData({['supportDraft.'+ticket]:''});await this.load();}catch(error){this.setData({error:error.message});}finally{this.setData({replying:''});}},
 copy(e){wx.setClipboardData({data:String(e.currentTarget.dataset.value||'')});}
});
