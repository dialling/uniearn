const orders=require('../../utils/orders'),store=require('../../utils/store'),f=require('../../utils/workflow'),copy=require('../../utils/orders-copy'),yuni=require('../../utils/yuni'),routeLabel=require('../../utils/route-label'),stickerCatalog=require('../../utils/chat-stickers');
const QUICK_REPLIES=[["我在路上了","I’m on my way"],["我到楼下了","I’m downstairs"],["谢谢！","Thank you!"],["已取到物品","I’ve picked up your items"],["物品已送达","Your items have been delivered"],["已放在门口","I’ve left them at your door"],["请下楼取一下","Please come downstairs to collect them"],["请稍等一下","Please give me a moment"],["收到，辛苦啦！","Got it, thank you for your help!"],["方便接电话吗？","Can you take a call?"]];
function stickerToken(id){return '[[uniearn-sticker:'+id+']]';}
function stickerId(text){const match=String(text||'').match(/^\[\[uniearn-sticker:([a-z0-9_-]{1,40})\]\]$/);return match&&match[1]||'';}
function stickers(zh){return stickerCatalog.list(zh);}
Page({
 data:{...require('../../utils/motion').data(),request:null,text:'',canSend:false,sending:false,messages:[],quick:QUICK_REPLIES.map(pair=>pair[1]),zh:false,menuOpen:false,stickerOpen:false,stickers:[],stickersReady:false,stickerError:''},
 onLoad(o){this.id=o.id;},
 onShow(){const zh=store.get().language!=='en';this.setData({zh,quick:QUICK_REPLIES.map(pair=>pair[zh?0:1])});if(wx.setNavigationBarTitle&&zh)wx.setNavigationBarTitle({title:'聊天'});orders.bind(this);this.loadStickers();},
 onHide(){orders.unbind(this);},
 onUnload(){orders.unbind(this);},
 refresh(){const zh=this.data.zh,r=store.get().requests.find(x=>x.id===this.id&&(x.isMine||x.isRunner));if(!r)return;const v=f.view(r,zh?'zh':'en'),available=stickers(zh);this.setData({request:{...v,pickupLabel:routeLabel.pickup(r,zh?'zh':'en'),destinationLabel:routeLabel.destination(r,zh?'zh':'en'),unitLabel:copy.translate(v.unit,zh?'zh':'en')},peer:require('../../utils/contact-identity')(r,r.isMine,zh),name:(r.isMine?r.runnerName:r.owner)||(zh?'同学':'Student'),initial:Array.from(String((r.isMine?r.runnerName:r.owner)||'U').trim()||'U')[0].toUpperCase(),contactMeta:r.isMine?(zh?'跑手 · 已完成 '+((r.runnerStats||{}).jobsDone||0)+' 单':'Runner · '+((r.runnerStats||{}).jobsDone||0)+' completed'):(zh?'同学':'Student')+(r.dorm?' · '+r.dorm:''),phone:r.isMine?r.runnerPhone:r.phone,messages:(r.messages||[]).map(m=>{const id=stickerId(m.text),sticker=stickerCatalog.lookup(id,zh);return{...m,photo:m.photo?orders.photoURL(m.photo):'',time:f.clock(m.at),isSticker:!!sticker,stickerSrc:sticker&&sticker.src,stickerLabel:sticker&&sticker.name};}),stickers:available,closed:!!r.deliveredAt&&Date.now()>=r.deliveredAt+86400000});if(r.unread&&!this.reading){this.reading=true;orders.readMessages(this.id).catch(e=>console.warn('Message read receipt failed; retry on next refresh',e)).finally(()=>{this.reading=false;});}},
 input(e){const text=e.detail.value;this.setData({text,canSend:!!text.trim()});},
 async send(){const text=this.data.text.trim();if(this.data.sending||!text||this.data.closed)return;this.setData({sending:true});try{await orders.act('message',{id:this.id,text});this.setData({text:'',canSend:false,menuOpen:false,stickerOpen:false});}catch(e){wx.showToast({title:e.message,icon:'none'});}finally{this.setData({sending:false});}},
 toggleMenu(){if(this.data.closed||this.data.sending)return;wx.hideKeyboard?.();this.setData({menuOpen:!this.data.menuOpen,stickerOpen:false});},
 async loadStickers(){if(this.loadingStickers||this.data.stickersReady)return;this.loadingStickers=true;this.setData({stickerError:''});try{await stickerCatalog.load();this.setData({stickersReady:true});}catch(e){this.setData({stickerError:this.data.zh?'贴纸加载失败，点击重试':'Could not load stickers. Tap to retry.'});}finally{this.loadingStickers=false;}},
 toggleStickers(){if(this.data.closed||this.data.sending)return;this.setData({menuOpen:true,stickerOpen:true});this.loadStickers();},
 backToMenu(){this.setData({stickerOpen:false});},
 closeMenu(){this.setData({menuOpen:false,stickerOpen:false});},
 async sendPhoto(e){
   if(this.data.sending||this.data.closed)return;
   const source=e.currentTarget.dataset.source;
   if(!['camera','album'].includes(source))return;
   this.setData({sending:true});
   try{
     const path=await require('../../utils/ui').photo([source]);
     const photo=await orders.upload(path);
     await orders.act('message',{id:this.id,photo});
     this.closeMenu();
   }catch(error){if(!/cancel/i.test(error.errMsg||error.message||''))wx.showToast({title:error.message||'发送失败',icon:'none'});}
   finally{this.setData({sending:false});}
 },
 previewPhoto(e){require('../../utils/ui').preview(e.currentTarget.dataset.photo);},
 async sendSticker(e){const id=String(e.currentTarget.dataset.id||''),sticker=this.data.stickers.find(x=>x.id===id);if(this.data.sending||this.data.closed||!this.data.stickersReady||!sticker)return;this.setData({sending:true});try{await orders.act('message',{id:this.id,text:stickerToken(id)});this.setData({menuOpen:false,stickerOpen:false});}catch(err){wx.showToast({title:err.message,icon:'none'});}finally{this.setData({sending:false});}},
 quickReply(e){const text=e.currentTarget.dataset.text;this.setData({text,canSend:!!text.trim()});},
 call(){if(this.data.phone)wx.makePhoneCall({phoneNumber:this.data.phone});else wx.showToast({title:this.data.zh?'暂无可用的手机号':'No phone number available',icon:'none'});},
 order(){const r=store.get().requests.find(x=>x.id===this.id);require('../../utils/nav').navigateTo({url:(r&&r.category==='task'?'/pages/task/index':'/pages/request/index')+'?id='+this.id});}
});
