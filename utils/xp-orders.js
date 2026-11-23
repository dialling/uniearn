// 合并版订单通道：把 Uniearn 的 orders.act 映射到西浦跑（XP）的 HTTP 接口。
// 价格由 XP 服务端统一计算（3 元/单，文星 3 楼及以上 +1），客户端只传地址与类型。
const api=require('./api'),store=require('./store');
const TYPE={takeout:'food',parcel:'express',task:'other'};

function addressLine(data){
  return String(data.deliveryAddress||[data.dorm,data.room].filter(Boolean).join(' ')||data.room||'').trim();
}
function titleOf(data){
  if(data.title)return String(data.title).slice(0,40);
  if(data.category==='parcel')return '快递代取';
  if(data.night)return '夜市代买';
  return '外卖代取';
}
function bodyOf(data){
  const body={
    type:data.night?'night':(TYPE[data.category]||'other'),
    title:titleOf(data),
    description:String(data.note||'').slice(0,200),
    pickup_location:String(data.pickupPoint||data.station||''),
    delivery_location:addressLine(data),
    recipient_phone:String(data.phone||''),
    area:String(data.area||''),
    floor:Number(data.floor)||0,
    shop:String(data.shop||''),
    dorm_type:['male','female'].includes(data.dormGender)?data.dormGender:'',
    pickup_code:(data.codes||[])[0]||''
  };
  if(data.category==='parcel'){
    if(data.parcelSize)body.size=String(data.parcelSize);
    if(Array.isArray(data.parcelItems)){
      body.size_items=data.parcelItems.reduce((acc,it)=>{acc[it.size]=(acc[it.size]||0)+1;return acc;},{});
      body.pickup_code=data.parcelItems.map(it=>it.code).filter(Boolean).join(',');
    }
  }
  return body;
}
function toRequest(order){
  const cent=n=>Math.round(Number(n||0));
  const statusMap={pending:'waiting',accepted:'taken',picked_up:'collected',completed:'delivered',confirmed:'confirmed',cancelled:'cancelled',refunded:'refunded'};
  return {
    id:'xp-'+order.id, xpId:order.id,
    category:order.type==='express'?'parcel':(order.type==='other'?'task':'takeout'),
    night:order.type==='night',
    title:order.title||'', station:order.pickup_location||'', pickupPoint:order.pickup_location||'',
    dorm:order.delivery_location||'', room:'', phone:order.recipient_phone||'',
    reward:cent(order.price_cents!==undefined?order.price_cents:(order.reward_cents||0))/100,
    status:statusMap[order.status]||'waiting',
    campusId:'sip', dormGender:order.dorm_type||'', ids:[], closesAt:order.created_at?Date.parse(order.created_at)+3600000:Date.now()+3600000,
    createdAt:order.created_at?Date.parse(order.created_at):Date.now(),
    isMine:true, mine:true, owner:order.publisher_name||''
  };
}
async function create(data){
  const res=await api.post('/api/orders',bodyOf(data));
  if(!res||res.ok!==true)throw Error((res&&res.message)||'发布失败');
  const order=res.order||res;
  const request=toRequest(order);
  store.update(s=>{s.requests=s.requests||[];if(!s.requests.some(r=>r.id===request.id))s.requests.unshift(request);});
  return {id:request.id,order,request};
}
function pay(orderId){
  return api.post('/api/pay/prepay',{order_id:Number(orderId)}).then(res=>{
    if(!res||res.ok!==true)throw Error((res&&res.message)||'支付发起失败');
    const pay=res.pay;
    if(!pay)return {offline:true};
    return new Promise((resolve,reject)=>{
      wx.requestPayment({...pay,success:()=>resolve({paid:true}),fail:e=>reject(Error(e&&e.errMsg||'支付取消'))});
    });
  });
}
async function hall(){
  // 没登录就别打接口，避免启动时一串 401
  if(!require('./util').getToken())return [];
  const res=await api.get('/api/orders');
  const list=(res&&(res.list||res.orders))||[];
  const rows=list.map(toRequest).map(classify);
  store.update(s=>{s.publicJobs=rows;});
  return rows;
}
function classify(row){
  // hall 只认 waiting/taken/collected/delivered/confirmed，服务端状态少一档
  return row;
}
async function mine(){
  if(!require('./util').getToken())return [];
  const res=await api.get('/api/orders/mine');
  const list=(res&&(res.list||res.orders))||[];
  const rows=list.map(toRequest);
  store.update(s=>{s.requests=rows;});
  return rows;
}
function idOf(payload){return Number(String((payload&&payload.id)||'').replace('xp-',''));}
async function act(action,payload){
  const id=idOf(payload);
  if(action==='create'){const made=await create(payload.data||payload);
    try{await pay(made.order.id);}catch(e){made.payError=String(e&&e.message||e);}
    return made;}
  if(action==='accept')return api.post('/api/orders/'+id+'/accept',{});
  if(action==='pickup')return api.post('/api/orders/'+id+'/status',{status:'picked_up'});
  if(action==='deliver')return api.post('/api/orders/'+id+'/status',{status:'completed',photo:payload.photo||''});
  if(action==='confirm')return api.post('/api/orders/'+id+'/confirm-complete',{});
  if(action==='cancel')return api.post('/api/orders/'+id+'/cancel',{reason:payload.reason||''});
  if(action==='message')return api.post('/api/messages/peer/'+encodeURIComponent(String(payload.peer||payload.with||'')),{text:payload.text||''});
  if(action==='walletWithdraw')return api.post('/api/wallet/withdraw',{amount_cents:Number(payload.amount_cents)||0});
  if(action==='upload')return upload(payload.filePath||payload.path);
  if(action==='acceptBoxes'){const ids=(payload.ids||[]).map(x=>Number(String(x).replace('xp-','')));const out=[];for(const one of ids)out.push(await api.post('/api/orders/'+one+'/accept',{}));return out;}
  if(action==='report'||action==='orderFeedbackSubmit')return api.post('/api/reports',{order_id:id,reason:payload.reason||'',detail:payload.note||payload.detail||'',images:payload.photos||[]});
  if(action==='supportRequest'||action==='supportMessage')return api.post('/api/cs/messages',{content:payload.text||payload.topic||''});
  if(action==='supportReply')return api.post('/api/cs/messages',{content:payload.text||''});
  if(action==='deleteAccount'){store.update(s=>{s.profile={...s.profile,loggedOut:true};});return {ok:true,local:true};}
  if(action==='raise')throw Error('加价需要服务端接口（当前未提供）');
  if(action==='collectCoupon'||action==='rewardsInit'||action==='invite')throw Error('优惠券/邀请需要服务端接口（当前未提供）');
  throw Error('该操作尚未接入西浦跑后端：'+action);
}
function upload(filePath){
  const token=require('./util').getToken();
  return new Promise((resolve,reject)=>{
    wx.uploadFile({url:require('./config').config.baseUrl+'/api/orders/upload',filePath,name:'file',
      header:token?{Authorization:'Bearer '+token}:{},
      success(res){try{const d=JSON.parse(res.data||'{}');if(d&&d.ok&&d.url)resolve({url:d.url,fileID:d.url});else reject(Error((d&&d.message)||'上传失败'));}catch(e){reject(e);}},
      fail(e){reject(Error(e&&e.errMsg||'上传失败'));}});
  });
}
module.exports={act,create,pay,mine,hall,toRequest,bodyOf};
