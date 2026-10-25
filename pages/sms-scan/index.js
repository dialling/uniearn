const {ensureCloud} = require('../../utils/cloud');
const {normalizePoint}=require('../../utils/pickup-point');
const store=require('../../utils/store');
const zhText={'Read pickup SMS':'识别取件短信','Read pickup screenshot':'识别取件截图','Read pending pickup list':'识别待取件列表','Read parcel details':'识别包裹详情','Pickup code':'取件码','Time unclear':'时间不清晰','All detected codes are listed. Select up to 12 from one pickup point.':'已列出识别到的取件码，请核对每个包裹的驿站，最多选择 12 个。','Review the codes and select parcels from one pickup point.':'请核对取件码，并选择同一取件点的包裹。','No pickup codes found. Try a clearer screenshot.':'未找到取件码。请换一张更清晰的截图。','Could not start upload.':'无法开始上传。','Could not read the SMS.':'无法识别短信。','Different pickup points found. Select codes for one point per request.':'识别到不同的取件点。每个订单请只选择同一取件点的取件码。','Select codes for one pickup point per request.':'每个订单请只选择同一取件点的取件码。','Select 1–12 pickup codes.':'请选择 1–12 个取件码。','Fill in each code and remove duplicates.':'请填写每个取件码，并删除重复项。','Please confirm the pickup point.':'请确认取件点。','These messages have different pickup points. Select one point per request.':'这些短信的取件点不同。每个订单请只选择一个取件点。'};
Page({
  data:{zh:true,labels:zhText,mode:'sms',heading:'Read pickup SMS',busy:false,error:'',note:'',candidates:[],selectedCount:0,pickupPoint:'',pickupAddress:'',preview:''},
  onLoad(o={}){const mode=['detail','list'].includes(o.mode)?o.mode:'sms';this.autoCapture=o.auto==='1';this.setData({mode});this.localize();},
  onReady(){if(this.autoCapture){this.autoCapture=false;this.capture();}},
  onShow(){this.localize();},
  localize(){const zh=store.get().language!=='en',mode=this.data.mode,heading=mode==='sms'?'Read pickup screenshot':mode==='list'?'Read pending pickup list':'Read parcel details';this.setData({zh,labels:zh?zhText:{},heading:zh?zhText[heading]:heading});if(wx.setNavigationBarTitle)wx.setNavigationBarTitle({title:this.data.heading});},
  t(value){if(value==='All detected codes are listed. Select up to 12 from one pickup point.')return this.data.zh?'已列出识别到的取件码，请核对每个包裹的驿站，最多选择 12 个。':'Review the station for each parcel and select up to 12 codes.';if(value==='No pickup codes found. Try a clearer photo or paste the SMS.')value='No pickup codes found. Try a clearer screenshot.';return this.data.zh&&zhText[value]||value;},
  async capture(e) {
    if(this.data.busy)return;
    let path;
    try {
      const r=await new Promise((resolve,reject)=>wx.chooseMedia({count:1,mediaType:['image'],sourceType:['album'],success:resolve,fail:reject}));
      path=r.tempFiles[0].tempFilePath;
    }catch(_){return;}
    this.setData({busy:true,error:''});let fileID='',cloud;
    try{
      cloud=ensureCloud();
      if(this.data.mode!=='sms'){
        const fields=await require('../../utils/ocr').recognize(path);
        const candidates=fields.candidates||fields.pickupCodes.map((code,i)=>({id:String(i),code,point:fields.pickupPoint,address:fields.pickupAddress,selected:true,label:'Pickup code',text:''}));
        this.setData({preview:path});this.applyResult({candidates,note:this.t('All detected codes are listed. Select up to 12 from one pickup point.')});
        return;
      }
      const prep=(await cloud.callFunction({name:'parseSmsScreenshot',data:{action:'prepareUpload'}})).result;
      if(!prep||!prep.ok)throw Error(prep&&prep.error||this.t('Could not start upload.'));
      fileID=(await cloud.uploadFile({cloudPath:prep.cloudPath,filePath:path})).fileID;
      const r=(await cloud.callFunction({name:'parseSmsScreenshot',data:{fileID}})).result;
      if(!r||!r.ok)throw Error(r&&r.error||this.t('Could not read the SMS.'));
      this.setData({preview:path});this.applyResult(r.fields);
    }catch(e){this.setData({error:e.message||e.errMsg||this.t('Could not read the SMS.')});}
    finally{if(fileID)try{await cloud.deleteFile({fileList:[fileID]});}catch(_){}this.setData({busy:false});}
  },
  applyResult(r){const candidates=(r.candidates||[]).map(x=>({...x,point:normalizePoint(x.point)})),points=[...new Set(candidates.filter(x=>x.selected&&x.point).map(x=>x.point))];this.setData({candidates,note:this.t('All detected codes are listed. Select up to 12 from one pickup point.'),pickupPoint:points.length===1?points[0]:'',pickupAddress:(candidates.find(x=>x.selected&&x.address)||{}).address||'',error:''});this.recount();},
  recount(){this.setData({selectedCount:this.data.candidates.filter(x=>x.selected).length});},
  toggle(e){const i=Number(e.currentTarget.dataset.i),candidates=this.data.candidates.map((x,j)=>j===i?{...x,selected:!x.selected}:x);const points=[...new Set(candidates.filter(x=>x.selected&&x.point).map(x=>x.point))];this.setData({candidates,pickupPoint:points.length===1?points[0]:'',pickupAddress:(candidates.find(x=>x.selected&&x.address)||{}).address||'',error:''});this.recount();},
  editCode(e){this.setData({['candidates['+e.currentTarget.dataset.i+'].code']:e.detail.value});},
  editPoint(e){this.setData({['candidates['+e.currentTarget.dataset.i+'].point']:e.detail.value});},
  field(e){this.setData({[e.currentTarget.dataset.field]:e.detail.value});},
  confirm(){
    const selected=this.data.candidates.filter(x=>x.selected),codes=selected.map(x=>x.code.trim()).filter(Boolean);
    if(!codes.length||codes.length>12){this.setData({error:this.t('Select 1–12 pickup codes.')});return;}
    if(codes.length!==selected.length||new Set(codes).size!==codes.length){this.setData({error:this.t('Fill in each code and remove duplicates.')});return;}
    const pickupPoints=selected.map(x=>String(x.point||'').trim()),points=[...new Set(pickupPoints.filter(Boolean))];
    this.getOpenerEventChannel().emit('smsSelected',{codes,pickupPoints,pickupPoint:points.join('、'),pickupAddress:this.data.pickupAddress.trim(),preview:this.data.preview});
    wx.navigateBack();
  }
});
