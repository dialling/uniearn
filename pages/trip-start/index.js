const orders=require('../../utils/orders');
const store=require('../../utils/store'),f=require('../../utils/workflow'),d=require('../../utils/domain'),ui=require('../../utils/ui'),account=require('../../utils/account'),rc=require('../../utils/runner-copy'),campus=require('../../utils/campus'),zh=()=>rc.zh(store.get().language);
const selectionMessages={
 'Invalid trip.':'云端行程服务尚未更新，请部署最新 orderService 后重试。',
 'Add a pickup location under 200 characters':'请填写出发地点，最多 200 字。',
 'Add a delivery address under 500 characters':'请填写送达地点，最多 500 字。',
 'Choose one pickup category per trip':'每趟行程请选择同一类型的订单。',
 'Choose a duration between 1 and 30 minutes':'开放加入时长请输入 1 到 30 之间的整数分钟。',
 'Choose a departure more than 10 minutes from now':'请选择今天至少 10 分钟以后的出发时间；若今天已无合适时间，请选择“现在”。',
 'Too many boxes for this trip':'已选件数超过行程容量，请减少勾选或增加容量。',
 'Up to 5 bags per trip':'每趟最多携带 5 袋外卖。',
 'Choose up to 10 buildings':'最多选择 10 栋楼。',
 'Choose requests with the same delivery address':'请勾选送达同一具体地址的订单。',
 'Food arrival times must be within 15 minutes':'已选外卖的到达时间需相差不超过 15 分钟。',
 'A selected order changed. Refresh and choose again.':'所选订单已变化，请刷新后重新选择。'
};
Page({
 data:{destinationType:'dorm',stations:[],deliveryAddress:'',pickupAddress:'',waypoint:'',otherStation:'',...require('../../utils/motion').data(),"category":"takeout","when":"now","time":"18:30","duration":30,"durations":[10,20,30],"station":"","stations":[],"stationHints":[],"profileDorm":"","dorm":"D01","capacity":5,"waiting":0,"requestIds":[],"selectionEdited":false,"recommendedOrders":[],"selectedCount":0,"selectedBoxes":0,"reward":"0.00","departLabel":"","joinLabel":"","remindLabel":"","error":"","starting":false,"customDurationOpen":false,"customDurationInput":"15","stationOptions":[],"stationManual":false,"areaIndex":0,"areaLabels":[],"buildingIndex":0,"buildingCodes":[],"buildingLabels":[],"dorms":[],"buildingChips":[]},
 onLoad(o={}){const p=store.get().profile;this.setData({dorm:p.dorm||'D01',profileDorm:p.dorm||'',time:f.clock(Math.min(Date.now()+60*60000,f.todayAt('23:59')))});if(['parcel','other'].includes(o.category))this.changeCategory({currentTarget:{dataset:{value:o.category}}});if(o.selfRequestId){const r=store.get().requests.find(x=>x.id===o.selfRequestId&&x.isMine);if(r)this.setData({selfRequestId:r.id,station:r.category==='takeout'?(r.pickupPoint||''):r.station,stationManual:!!r.pickupPoint,dorm:r.dorm,dorms:[r.dorm],stations:[r.station]});}this.refresh();},
 onShow(){if(wx.setNavigationBarTitle)wx.setNavigationBarTitle({title:zh()?'发起行程':'Start a trip'});orders.bind(this);
  // 只有通过认证的跑手才能发起/分享行程；延后一帧再判断，避免在首次渲染期间跳转导致白屏
  setTimeout(() => this.gate(), 0);
 },
 async gate(){
  const account=require('../../utils/account');
  const next='/pages/trip-start/index?category='+this.data.category+(this.data.selfRequestId?'&selfRequestId='+this.data.selfRequestId:'');
  try{
   const r=await account.call('status'), a=r&&r.account;
   if(!a||a.loggedOut){require('../../utils/nav').navigateTo({url:'/pages/welcome/index'});return;}
   if(!a.verification||a.verification.status!=='verified'){
    // 先问一句，用户确认后再去认证；取消则留在当前页（或退回上一页）
    wx.showModal({
      title: zh()?'还不是跑腿员':'Not a runner yet',
      content: zh()?'发起行程需要先通过跑腿员认证，是否现在前往注册？':'Creating a trip needs runner verification. Go to the application now?',
      confirmText: zh()?'前往':'Go',
      cancelText: zh()?'取消':'Cancel',
      success:(res)=>{
        if(res.confirm) wx.redirectTo({url:'/pages/student-check/index?next='+encodeURIComponent(next)});
        else { const pages=getCurrentPages(); if(pages.length>1)wx.navigateBack(); }
      }
    });
   }
  }catch(_){/* 网络失败时保持当前页，用户可重试 */}
 },
 onHide(){orders.unbind(this);},
 onUnload(){orders.unbind(this);},
 selectionState(){const s=store.get();return {...s,requests:s.requests.filter(r=>!r.isMine)};},
 selectionMessage(error){const message=error.message||String(error);if(message==='Invalid trip.'&&!zh())return 'The cloud trip service needs an update. Deploy the latest orderService and retry.';return zh()?(selectionMessages[message]||rc.name(message,store.get().language)):message;},
 refresh(){
  const language=store.get().language,isZh=zh();this.setData({zh:isZh,names:rc.names(language)});this.syncDestination();this.syncStations();this.markStations();
  try{
   const state=this.selectionState(),rows=f.matchingTripOrders(state,this.data),available=new Set(rows.map(r=>r.id));
   const {requestIds:previousIds,...automaticConfig}=this.data;
   const requestIds=this.data.selectionEdited?previousIds.filter(id=>available.has(id)):f.previewTrip(state,automaticConfig).ids,selected=new Set(requestIds);
   const chosen=rows.filter(r=>selected.has(r.id));
   this.setData({requestIds,waiting:rows.length,selectedCount:chosen.length,selectedBoxes:chosen.reduce((n,r)=>n+d.boxes(r),0),reward:chosen.reduce((n,r)=>n+r.reward,0).toFixed(2),recommendedOrders:rows.map(r=>({id:r.id,category:r.category,selected:selected.has(r.id),route:rc.name(r.category==='takeout'?(r.pickupPoint||r.station):r.station,language)+' → '+(r.destinationType==='place'?(r.deliveryAddress||r.dorm):r.dorm),boxes:d.boxes(r),rewardText:r.reward.toFixed(2),timeLabel:r.category==='takeout'?(r.arrived?(isZh?'已到取件点':'At pickup point'):(isZh?'预计到达 ':'Arrives ')+f.clock(r.arrivalAt)):(r.closesAt?(isZh?'送达截止 ':'Deliver by ')+f.clock(r.closesAt):isZh?'等待取件':'Waiting for pickup'),night:!!r.night,fragile:!!r.fragile}))});
   const p=f.previewTrip(state,{...this.data,requestIds});
   this.setData({departLabel:f.clock(p.trip.departAt),joinLabel:f.clock(p.trip.joinUntil),remindLabel:f.clock(p.trip.remindAt),error:''});
  }catch(e){if(!String(this.data.station||'').trim()||this.data.destinationType==='place'&&!String(this.data.deliveryAddress||'').trim())this.setData({requestIds:[],recommendedOrders:[],waiting:0,selectedCount:0,selectedBoxes:0,reward:'0.00'});this.setData({error:this.selectionMessage(e)});if(this.data.when==='later'&&/^\d{1,2}:\d{2}$/.test(String(this.data.time||''))){try{const at=f.todayAt(this.data.time);this.setData({departLabel:f.clock(at),joinLabel:f.clock(at-10*60000)});}catch(_){}}}
 },
 toggleOrder(e){
  if(this.data.starting)return;
  const id=e.currentTarget.dataset.id;if(!this.data.recommendedOrders.some(r=>r.id===id))return;
  const removing=this.data.requestIds.includes(id),requestIds=removing?this.data.requestIds.filter(x=>x!==id):this.data.requestIds.concat(id);
  if(!removing){try{f.previewTrip(this.selectionState(),{...this.data,requestIds});}catch(error){ui.toast(this.selectionMessage(error));return;}}
  this.setData({requestIds,selectionEdited:true});this.refresh();
 },
 clearOrders(){if(this.data.starting)return;this.setData({requestIds:[],selectionEdited:true});this.refresh();},
 changeCategory(e){if(this.data.starting)return;const category=e.currentTarget.dataset.value;if(!['takeout','parcel','other'].includes(category))return;const otherStation=this.data.category==='other'?this.data.station:this.data.otherStation;this.setData({otherStation,requestIds:[],selectionEdited:false,category,station:category==='other'?otherStation:category==='takeout'?'':'North gate Cainiao station',stationManual:false,capacity:Math.min(category==='takeout'?5:12,this.data.capacity)});this.refresh();},
 select(e){if(this.data.starting)return;const field=e.currentTarget.dataset.field,value=e.currentTarget.dataset.value,patch={[field]:value,requestIds:[],selectionEdited:false};if(field==='duration')patch.customDurationOpen=false;this.setData(patch);this.refresh();},
 text(e){if(this.data.starting)return;this.setData({requestIds:[],selectionEdited:false,[e.currentTarget.dataset.field]:e.detail.value});this.refresh();},
 changeCapacity(e){if(this.data.starting)return;this.setData({capacity:Math.max(1,Math.min(this.data.category==='takeout'?5:12,this.data.capacity+Number(e.currentTarget.dataset.delta)))});this.refresh();},
 async start(){
  if(this.data.starting)return;
  this.setData({starting:true});
  try{
   // 发起顺路行程只要求登录，不要求已是跑腿员（学生也能顺路带一单）
   const prof=store.get().profile||{};
   if(prof.loggedOut){require('../../utils/nav').navigateTo({url:'/pages/welcome/index'});return;}
   // Account refresh can update orders; validate the current selection and clock again.
   f.previewTrip(this.selectionState(),this.data);
   this.setData({error:''});
   const a=this.data,data={category:a.category,when:a.when,time:a.time,duration:a.duration,station:a.station,stations:(a.stationManual?[]:(a.stations&&a.stations.length?a.stations:[a.station])),pickupAddress:a.category==='other'?a.pickupAddress:'',waypoint:a.category==='other'?a.waypoint:'',destinationType:a.destinationType,deliveryAddress:a.deliveryAddress,dorm:a.dorm,...(a.destinationType==='place'?{}:{dorms:a.dorms.slice()}),capacity:a.capacity,requestIds:a.requestIds.slice(),...(a.selfRequestId?{selfRequestId:a.selfRequestId}:{})};
   const t=await orders.act('startTrip',{data});wx.redirectTo({url:'/pages/trip/index?id='+t.id});
  }catch(e){ui.toast(this.selectionMessage(e));orders.sync().catch(()=>{});}finally{this.setData({starting:false});}
 },
 syncStations(){if(this.data.category==='other'){this.setData({stationOptions:[],stationManual:false});return;}const language=store.get().language==='en'?'en':'zh';if(this.data.category==='takeout'){const locker=require('../../utils/takeaway-lockers').options({dorm:this.data.dorm},language),options=locker.items.filter(x=>x.value).map(x=>({value:x.value,label:x.label,manual:false,wide:x.value.length>12}));if(locker.items.some(x=>!x.value))options.push({value:'',label:language==='en'?'Other (type it yourself)':'其他外卖柜',manual:true});if(!options.length)options.push({value:'',label:language==='en'?'Enter a takeaway locker':'填写外卖柜',manual:true});const previous=this.data.station||'',selected=options.find(x=>x.value&&x.value===previous),manual=!!(options.some(x=>x.manual)&&!selected&&this.data.stationManual),station=selected?selected.value:manual?previous:(options.find(x=>x.value)||{}).value||'';this.setData({stationList:options.filter(x=>x.value).map(x=>x.value),stationOptions:options,stationManual:manual,station});return;}const stations=['North gate Cainiao station','Wenyuan Cainiao station','Wenyuan takeaway locker','Hanlin Mama station','East gate JD point'],names=rc.names(language),hints=stations.map(()=>language==='en'?'Parcel pickup':'快递取件点');this.setData({stationList:stations,stationOptions:stations.map((value,i)=>({value,label:names[value]||value,hint:hints[i],manual:false})),stationManual:false,station:stations.includes(this.data.station)?this.data.station:stations[0]});},
 destinationTypeChoice(e){if(this.data.starting)return;const destinationType=e.currentTarget.dataset.value;if(!['dorm','place'].includes(destinationType))return;this.setData({destinationType,requestIds:[],selectionEdited:false});this.refresh();},
 syncDestination(){const language=store.get().language==='en'?'en':'zh',area=campus.areaOfBuilding(this.data.dorm)||campus.AREAS[Math.max(0,Math.min(campus.AREAS.length-1,Number(this.data.areaIndex)||0))],areaIndex=Math.max(0,campus.AREAS.findIndex(x=>x.id===area.id)),buildings=area.buildings,buildingIndex=Math.max(0,buildings.indexOf(this.data.dorm));let dorms=buildings.filter(x=>(this.data.dorms||[]).includes(x));if(!dorms.length)dorms=[buildings[buildingIndex]||buildings[0]];const dorm=dorms[0];this.setData({areaIndex,areaLabels:campus.AREAS.map(x=>language==='en'?x.en:x.zh),buildingCodes:buildings,buildingLabels:buildings.map(x=>campus.buildingLabel(x,language)),buildingIndex:buildings.indexOf(dorm),dorm,dorms,buildingChips:buildings.map(code=>({code,label:campus.buildingLabel(code,language),on:dorms.includes(code)}))});},
 destinationArea(e){if(this.data.starting)return;const area=campus.AREAS[Number(e.detail.value)]||campus.AREAS[0],areaIndex=campus.AREAS.indexOf(area),dorm=area.buildings[0];this.setData({requestIds:[],selectionEdited:false,areaIndex,dorm,dorms:[dorm],buildingIndex:0});this.refresh();},
 // 2026-11-21: tap a building to add it to the trip or take it off; at least one stays chosen.
 toggleBuilding(e){if(this.data.starting)return;const code=e.currentTarget.dataset.code,now=this.data.dorms||[];if(!this.data.buildingCodes.includes(code))return;let dorms=now.includes(code)?now.filter(x=>x!==code):now.concat(code);if(!dorms.length){wx.showToast({title:zh()?'至少选择一栋楼':'Choose at least one building',icon:'none'});return;}dorms=this.data.buildingCodes.filter(x=>dorms.includes(x));this.setData({requestIds:[],selectionEdited:false,dorms,dorm:dorms[0]});this.refresh();},
 destinationBuilding(e){if(this.data.starting)return;const buildingIndex=Number(e.detail.value),dorm=this.data.buildingCodes[buildingIndex]||this.data.buildingCodes[0];this.setData({requestIds:[],selectionEdited:false,buildingIndex,dorm});this.refresh();},
 markStations(){const picked=this.data.stations||[];
  const options=(this.data.stationOptions||[]).map(o=>({...o,on:!!o.manual?!!this.data.stationManual:picked.indexOf(String(o.value||o.label||''))>=0}));
  this.setData({stationOptions:options});},
 stationChoice(e){if(this.data.starting)return;const option=this.data.stationOptions[Number(e.currentTarget.dataset.index)];if(!option)return;
  const prev=this.data.stations||[];
  const key=String(option.value||option.label||'');
  console.log('[trip] station tap', key, 'prev', JSON.stringify(prev));
  const list=option.manual?[]:(prev.indexOf(key)>=0?prev.filter(v=>v!==key):prev.concat(key));
  this.setData({requestIds:[],selectionEdited:false,stationManual:!!option.manual,station:option.manual?'':key,stations:list,stationPickCount:list.length});this.markStations();this.refresh();},
 toggleCustomDuration(){if(this.data.starting)return;const customDurationInput=this.data.customDurationInput||'15';this.setData({requestIds:[],selectionEdited:false,customDurationOpen:true,customDurationInput,duration:Number(customDurationInput)});this.refresh();},
 setCustomDuration(e){if(this.data.starting)return;const customDurationInput=String(e.detail.value||'');this.setData({requestIds:[],selectionEdited:false,customDurationInput,duration:customDurationInput===''?0:Number(customDurationInput)});this.refresh();}
});
