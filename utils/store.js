const domain=require('./domain'),flow=require('./workflow');
// Separate cache: old local sample orders are never uploaded to the server.
const KEY='uniearn_cloud_cache_v1';let memory;const listeners=new Set();
function fresh(){const s=domain.initial();s.requests=[];s.trips=[];s.publicTrips=[];s.photoURLs={};s.cloudRevision=-1;return flow.migrate(s);}
function init(){if(memory)return memory;try{memory=wx.getStorageSync(KEY)||fresh();if(!memory.profile)memory=fresh();}catch(e){memory=fresh();}return memory;}
function get(){return flow.migrate(init());}
function notify(){for(const fn of [...listeners])try{fn();}catch(e){console.error('Local preference update',e);}}
function subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}
function update(fn){const s=get(),out=fn(s);try{wx.setStorageSync(KEY,s);}catch(e){wx.showToast({title:'Could not save local cache',icon:'none'});}notify();return out;}
function reset(){memory=fresh();try{wx.setStorageSync(KEY,memory);}catch(e){}notify();return memory;}
module.exports={get,update,reset,subscribe};
