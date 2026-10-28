const orders=require('../../utils/orders'),store=require('../../utils/store'),f=require('../../utils/workflow'),copy=require('../../utils/orders-copy'),yuni=require('../../utils/yuni');
const STICKER_NAMES={hello:['你好！','Hello!'],post:['首次发布','First post'],run:['在路上','On my way'],chat:['打招呼','Say hi'],thanks:['谢谢你','Thank you'],paid:['获得收益','Got paid']};
function stickerToken(id){return '[[uniearn-sticker:'+id+']]';}
function stickerId(text){const match=String(text||'').match(/^\[\[uniearn-sticker:([a-z0-9_-]{1,40})\]\]$/);return match&&match[1]||'';}
function stickers(zh){return yuni.stickers().map(item=>({...item,name:(STICKER_NAMES[item.id]||[item.name,item.name])[zh?0:1]}));}
Page({
 data:{request:null,text:'',canSend:false,sending:false,messages:[],quick:['I’m on my way','I’m downstairs','Thank you!'],zh:false,stickerOpen:false,stickers:[]},
 onLoad(o){this.id=o.id;},
 onShow(){const zh=store.get().language!=='en';this.setData({zh,quick:['I’m on my way','I’m downstairs','Thank you!'].map(x=>copy.translate(x,zh?'zh':'en'))});if(wx.setNavigationBarTitle&&zh)wx.setNavigationBarTitle({title:'聊天'});orders.bind(this);},
 onHide(){orders.unbind(this);},
 onUnload(){orders.unbind(this);},
 refresh(){const zh=this.data.zh,r=store.get().requests.find(x=>x.id===this.id&&(x.isMine||x.isRunner));if(!r)return;const v=f.view(r,zh?'zh':'en'),available=stickers(zh),byId={};available.forEach(x=>{byId[x.id]=x;});this.setData({request:{...v,unitLabel:copy.translate(v.unit,zh?'zh':'en')},name:r.isMine?r.runnerName:r.owner,phone:r.isMine?r.runnerPhone:r.phone,messages:(r.messages||[]).map(m=>{const id=stickerId(m.text),sticker=byId[id];return{...m,time:f.clock(m.at),isSticker:!!sticker,stickerPose:sticker&&sticker.pose,stickerLabel:sticker&&sticker.name};}),stickers:available,closed:!!r.deliveredAt&&Date.now()>=r.deliveredAt+86400000});if(r.unread&&!this.reading){this.reading=true;orders.act('readMessages',{id:this.id}).catch(()=>{}).finally(()=>this.reading=false);}},
 input(e){const text=e.detail.value;this.setData({text,canSend:!!text.trim()});},
 async send(){const text=this.data.text.trim();if(this.data.sending||!text||this.data.closed)return;this.setData({sending:true});try{await orders.act('message',{id:this.id,text});this.setData({text:'',canSend:false,stickerOpen:false});}catch(e){wx.showToast({title:e.message,icon:'none'});}finally{this.setData({sending:false});}},
 toggleStickers(){if(this.data.closed||this.data.sending)return;this.setData({stickerOpen:!this.data.stickerOpen});},
 async sendSticker(e){const id=String(e.currentTarget.dataset.id||''),sticker=this.data.stickers.find(x=>x.id===id);if(this.data.sending||this.data.closed||!sticker)return;this.setData({sending:true});try{await orders.act('message',{id:this.id,text:stickerToken(id)});this.setData({stickerOpen:false});}catch(err){wx.showToast({title:err.message,icon:'none'});}finally{this.setData({sending:false});}},
 quickReply(e){const text=e.currentTarget.dataset.text;this.setData({text,canSend:!!text.trim()});},
 call(){if(this.data.phone)wx.makePhoneCall({phoneNumber:this.data.phone});else wx.showToast({title:this.data.zh?'暂无可用的手机号':'No phone number available',icon:'none'});},
 order(){const r=store.get().requests.find(x=>x.id===this.id);require('../../utils/nav').navigateTo({url:(r&&r.category==='task'?'/pages/task/index':'/pages/request/index')+'?id='+this.id});}
});
