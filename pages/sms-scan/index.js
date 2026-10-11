const {ensureCloud} = require('../../utils/cloud');
const {normalizePoint}=require('../../utils/pickup-point');
Page({
  data:{mode:'sms',heading:'Read pickup SMS',busy:false,error:'',note:'',candidates:[],selectedCount:0,pickupPoint:'',pickupAddress:'',preview:''},
  onLoad(o={}){const mode=['detail','list'].includes(o.mode)?o.mode:'sms';const heading=mode==='sms'?'Read pickup screenshot':mode==='list'?'Read pending pickup list':'Read parcel details';this.setData({mode,heading});wx.setNavigationBarTitle({title:heading});},
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
        this.setData({preview:path});this.applyResult({candidates,note:'All detected codes are listed. Select up to 5 from one pickup point.'});
        return;
      }
      const prep=(await cloud.callFunction({name:'parseSmsScreenshot',data:{action:'prepareUpload'}})).result;
      if(!prep||!prep.ok)throw Error(prep&&prep.error||'Could not start upload.');
      fileID=(await cloud.uploadFile({cloudPath:prep.cloudPath,filePath:path})).fileID;
      const r=(await cloud.callFunction({name:'parseSmsScreenshot',data:{fileID}})).result;
      if(!r||!r.ok)throw Error(r&&r.error||'Could not read the SMS.');
      this.setData({preview:path});this.applyResult(r.fields);
    }catch(e){this.setData({error:e.message||e.errMsg||'Could not read the SMS.'});}
    finally{if(fileID)try{await cloud.deleteFile({fileList:[fileID]});}catch(_){}this.setData({busy:false});}
  },
  applyResult(r){const candidates=(r.candidates||[]).map(x=>({...x,point:normalizePoint(x.point)})),points=[...new Set(candidates.filter(x=>x.selected&&x.point).map(x=>x.point))];this.setData({candidates,note:r.note||'',pickupPoint:points.length===1?points[0]:'',pickupAddress:(candidates.find(x=>x.selected&&x.address)||{}).address||'',error:points.length>1?'Different pickup points found. Select codes for one point per request.':''});this.recount();},
  recount(){this.setData({selectedCount:this.data.candidates.filter(x=>x.selected).length});},
  toggle(e){const i=Number(e.currentTarget.dataset.i),candidates=this.data.candidates.map((x,j)=>j===i?{...x,selected:!x.selected}:x);const points=[...new Set(candidates.filter(x=>x.selected&&x.point).map(x=>x.point))];this.setData({candidates,pickupPoint:points.length===1?points[0]:'',pickupAddress:(candidates.find(x=>x.selected&&x.address)||{}).address||'',error:points.length>1?'Select codes for one pickup point per request.':''});this.recount();},
  editCode(e){this.setData({['candidates['+e.currentTarget.dataset.i+'].code']:e.detail.value});},
  field(e){this.setData({[e.currentTarget.dataset.field]:e.detail.value});},
  confirm(){
    const selected=this.data.candidates.filter(x=>x.selected),codes=selected.map(x=>x.code.trim()).filter(Boolean);
    if(!codes.length||codes.length>5){this.setData({error:'Select 1–5 pickup codes.'});return;}
    if(codes.length!==selected.length||new Set(codes).size!==codes.length){this.setData({error:'Fill in each code and remove duplicates.'});return;}
    if(!this.data.pickupPoint.trim()){this.setData({error:'Please confirm the pickup point.'});return;}
    if(new Set(selected.map(x=>x.point).filter(Boolean)).size>1){this.setData({error:'These messages have different pickup points. Select one point per request.'});return;}
    this.getOpenerEventChannel().emit('smsSelected',{codes,pickupPoint:this.data.pickupPoint.trim(),pickupAddress:this.data.pickupAddress.trim(),preview:this.data.preview});
    wx.navigateBack();
  }
});
