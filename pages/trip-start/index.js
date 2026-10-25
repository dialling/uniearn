const orders=require('../../utils/orders');
const store=require('../../utils/store'),f=require('../../utils/workflow'),d=require('../../utils/domain'),ui=require('../../utils/ui'),account=require('../../utils/account'),rc=require('../../utils/runner-copy'),campus=require('../../utils/campus'),zh=()=>rc.zh(store.get().language);
const selectionMessages={
 'Too many boxes for this trip':'已选件数超过行程容量，请减少勾选或增加容量。',
 'Up to 5 bags per trip':'每趟最多携带 5 袋外卖。',
 'This trip exceeds your runner limit':'已选赏金超过当前跑手等级上限，请减少勾选。',
 'Choose requests with the same delivery address':'请勾选送达同一具体地址的订单。',
 'Food arrival times must be within 15 minutes':'已选外卖的到达时间需相差不超过 15 分钟。',
 'A selected order changed. Refresh and choose again.':'所选订单已变化，请刷新后重新选择。'
};
Page({
 data:{"category":"takeout","when":"now","time":"18:30","duration":10,"durations":[10,20,30],"station":"","stations":[],"stationHints":[],"profileDorm":"","dorm":"D01","capacity":5,"waiting":0,"requestIds":[],"recommendedOrders":[],"selectedCount":0,"selectedBoxes":0,"reward":"0.00","departLabel":"","joinLabel":"","remindLabel":"","error":"","starting":false,"customDurationOpen":false,"customDurationInput":"15","stationOptions":[],"stationManual":false,"areaIndex":0,"areaLabels":[],"buildingIndex":0,"buildingLabels":[]},
 onLoad(o={}){const p=store.get().profile;this.setData({dorm:p.dorm||'D01',profileDorm:p.dorm||'',time:f.clock(Date.now()+60*60000)});if(o.category==='parcel')this.changeCategory({currentTarget:{dataset:{value:'parcel'}}});if(o.selfRequestId){const r=store.get().requests.find(x=>x.id===o.selfRequestId&&x.isMine);if(r)this.setData({selfRequestId:r.id,station:r.category==='takeout'?(r.pickupPoint||''):r.station,stationManual:!!r.pickupPoint,dorm:r.dorm,stations:[r.station]});}this.refresh();},
 onShow(){if(wx.setNavigationBarTitle)wx.setNavigationBarTitle({title:zh()?'发起行程':'Start a trip'});orders.bind(this);if(!store.get().profile.studentVerified||!store.get().profile.runnerRulesAccepted){const next='/pages/trip-start/index?category='+this.data.category+(this.data.selfRequestId?'&selfRequestId='+this.data.selfRequestId:'');wx.redirectTo({url:'/pages/student-check/index?next='+encodeURIComponent(next)});}},
 onHide(){orders.unbind(this);},
 onUnload(){orders.unbind(this);},
 selectionState(){const s=store.get();return {...s,requests:s.requests.filter(r=>!r.isMine)};},
 selectionMessage(error){const message=error.message||String(error);return zh()?(selectionMessages[message]||rc.name(message,store.get().language)):message;},
 refresh(){
  const language=store.get().language,isZh=zh();this.setData({zh:isZh,names:rc.names(language)});this.syncDestination();this.syncStations();
  try{
   const state=this.selectionState(),rows=f.matchingTripOrders(state,this.data),available=new Set(rows.map(r=>r.id));
   const requestIds=this.data.requestIds.filter(id=>available.has(id)),selected=new Set(requestIds);
   const chosen=rows.filter(r=>selected.has(r.id));
   this.setData({requestIds,waiting:rows.length,selectedCount:chosen.length,selectedBoxes:chosen.reduce((n,r)=>n+d.boxes(r),0),reward:chosen.reduce((n,r)=>n+r.reward,0).toFixed(2),recommendedOrders:rows.map(r=>({id:r.id,selected:selected.has(r.id),route:rc.name(r.station,language)+' → '+r.dorm,boxes:d.boxes(r),rewardText:r.reward.toFixed(2),timeLabel:r.category==='takeout'?(r.arrived?(isZh?'已到取件点':'At pickup point'):(isZh?'预计到达 ':'Arrives ')+f.clock(r.arrivalAt)):(r.closesAt?(isZh?'送达截止 ':'Deliver by ')+f.clock(r.closesAt):isZh?'等待取件':'Waiting for pickup'),night:!!r.night,fragile:!!r.fragile}))});
   const p=f.previewTrip(state,{...this.data,requestIds});
   this.setData({departLabel:f.clock(p.trip.departAt),joinLabel:f.clock(p.trip.joinUntil),remindLabel:f.clock(p.trip.remindAt),error:''});
  }catch(e){this.setData({error:this.selectionMessage(e)});}
 },
 toggleOrder(e){
  if(this.data.starting)return;
  const id=e.currentTarget.dataset.id;if(!this.data.recommendedOrders.some(r=>r.id===id))return;
  const removing=this.data.requestIds.includes(id),requestIds=removing?this.data.requestIds.filter(x=>x!==id):this.data.requestIds.concat(id);
  if(!removing){try{f.previewTrip(this.selectionState(),{...this.data,requestIds});}catch(error){ui.toast(this.selectionMessage(error));return;}}
  this.setData({requestIds});this.refresh();
 },
 clearOrders(){if(this.data.starting)return;this.setData({requestIds:[]});this.refresh();},
 changeCategory(e){if(this.data.starting)return;const category=e.currentTarget.dataset.value;this.setData({requestIds:[],category,station:category==='takeout'?'':'North gate Cainiao station',stationManual:false,capacity:Math.min(category==='takeout'?5:12,this.data.capacity)});this.refresh();},
 select(e){if(this.data.starting)return;const field=e.currentTarget.dataset.field,value=e.currentTarget.dataset.value,patch={[field]:value,requestIds:[]};if(field==='duration')patch.customDurationOpen=false;this.setData(patch);this.refresh();},
 text(e){if(this.data.starting)return;this.setData({requestIds:[],[e.currentTarget.dataset.field]:e.detail.value});this.refresh();},
 changeCapacity(e){if(this.data.starting)return;this.setData({capacity:Math.max(1,Math.min(this.data.category==='takeout'?5:12,this.data.capacity+Number(e.currentTarget.dataset.delta)))});this.refresh();},
 async start(){
  if(this.data.starting||this.data.error)return;
  this.setData({starting:true});
  try{
   if(!await account.requireRunner())return;
   const a=this.data,data={category:a.category,when:a.when,time:a.time,duration:a.duration,station:a.station,dorm:a.dorm,capacity:a.capacity,requestIds:a.requestIds.slice(),...(a.selfRequestId?{selfRequestId:a.selfRequestId}:{})};
   const t=await orders.act('startTrip',{data});wx.redirectTo({url:'/pages/trip/index?id='+t.id});
  }catch(e){ui.toast(this.selectionMessage(e));orders.sync().catch(()=>{});}finally{this.setData({starting:false});}
 },
 syncStations(){const language=store.get().language==='en'?'en':'zh';if(this.data.category==='takeout'){const locker=require('../../utils/takeaway-lockers').options({dorm:this.data.dorm},language),options=locker.items.filter(x=>x.value).map(x=>({value:x.value,label:x.label,manual:false,wide:x.value.length>12}));if(locker.items.some(x=>!x.value))options.push({value:'',label:language==='en'?'Other (type it yourself)':'其他外卖柜',manual:true});if(!options.length)options.push({value:'',label:language==='en'?'Enter a takeaway locker':'填写外卖柜',manual:true});const previous=this.data.station||'',selected=options.find(x=>x.value&&x.value===previous),manual=!!(options.some(x=>x.manual)&&!selected&&this.data.stationManual),station=selected?selected.value:manual?previous:(options.find(x=>x.value)||{}).value||'';this.setData({stations:options.filter(x=>x.value).map(x=>x.value),stationOptions:options,stationManual:manual,station});return;}const stations=['North gate Cainiao station','Wenyuan Cainiao station','Wenyuan takeaway locker','Hanlin Mama station','East gate JD point'],names=rc.names(language),hints=stations.map(()=>language==='en'?'Parcel pickup':'快递取件点');this.setData({stations,stationOptions:stations.map((value,i)=>({value,label:names[value]||value,hint:hints[i],manual:false})),stationManual:false,station:stations.includes(this.data.station)?this.data.station:stations[0]});},
 syncDestination(){const language=store.get().language==='en'?'en':'zh',area=campus.areaOfBuilding(this.data.dorm)||campus.AREAS[Math.max(0,Math.min(campus.AREAS.length-1,Number(this.data.areaIndex)||0))],areaIndex=Math.max(0,campus.AREAS.findIndex(x=>x.id===area.id)),buildings=area.buildings,buildingIndex=Math.max(0,buildings.indexOf(this.data.dorm)),dorm=buildings[buildingIndex]||buildings[0];this.setData({areaIndex,areaLabels:campus.AREAS.map(x=>language==='en'?x.en:x.zh),buildingLabels:buildings,buildingIndex,dorm});},
 destinationArea(e){if(this.data.starting)return;const area=campus.AREAS[Number(e.detail.value)]||campus.AREAS[0],areaIndex=campus.AREAS.indexOf(area),dorm=area.buildings[0];this.setData({requestIds:[],areaIndex,dorm,buildingIndex:0});this.refresh();},
 destinationBuilding(e){if(this.data.starting)return;const buildingIndex=Number(e.detail.value),dorm=this.data.buildingLabels[buildingIndex]||this.data.buildingLabels[0];this.setData({requestIds:[],buildingIndex,dorm});this.refresh();},
 stationChoice(e){if(this.data.starting)return;const option=this.data.stationOptions[Number(e.currentTarget.dataset.index)];if(!option)return;this.setData({requestIds:[],stationManual:!!option.manual,station:option.manual?'':option.value});this.refresh();},
 toggleCustomDuration(){if(this.data.starting)return;const customDurationInput=this.data.customDurationInput||'70';this.setData({requestIds:[],customDurationOpen:true,customDurationInput,duration:Number(customDurationInput)});this.refresh();},
 setCustomDuration(e){if(this.data.starting)return;const customDurationInput=String(e.detail.value||'');this.setData({requestIds:[],customDurationInput,duration:customDurationInput===''?0:Number(customDurationInput)});this.refresh();}
});
