const domain=require('./domain'),flow=require('./workflow');
// Separate cache: old local sample orders are never uploaded to the server.
const KEY='uniearn_cloud_cache_v1';let memory, testMemory;const listeners=new Set();
// Persisting the whole cache is a synchronous JSON write; coalesce it so taps are
// not blocked behind serialising every order, trip and photo url.
let writeTimer=null, writePending=false;
const WRITE_DELAY=300;
function persist(){if(testMemory)return;writePending=true;if(writeTimer)return;writeTimer=setTimeout(()=>{writeTimer=null;if(!writePending)return;writePending=false;try{wx.setStorageSync(KEY,memory);}catch(e){}},WRITE_DELAY);}
function flush(){if(writeTimer){clearTimeout(writeTimer);writeTimer=null;}if(!writePending||testMemory)return;writePending=false;try{wx.setStorageSync(KEY,memory);}catch(e){}}
function fresh(){const s=domain.initial();s.requests=[];s.trips=[];s.publicTrips=[];s.photoURLs={};s.cloudRevision=-1;return flow.migrate(s);}
function init(){if(memory)return memory;try{memory=wx.getStorageSync(KEY)||fresh();if(!memory.profile)memory=fresh();}catch(e){memory=fresh();}return memory;}
function get(){return flow.migrate(testMemory||init());}
function notify(){for(const fn of [...listeners])try{fn();}catch(e){console.error('Local preference update',e);}}
function subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}
function update(fn){const s=get(),out=fn(s);persist();notify();return out;}
function reset(){memory=fresh();persist();notify();return memory;}
function testScope(enabled){
 testMemory=enabled?JSON.parse(JSON.stringify(init())):null;
 if(testMemory){Object.assign(testMemory.profile,{onboarded:true,loggedOut:false,universityId:"xjtlu",campusId:"sip"});testMemory.agreements={...testMemory.agreements,terms:true};Object.assign(testMemory,{requests:[],trips:[],publicJobs:[],publicTrips:[],cloudRevision:-1});delete testMemory.pendingOrderOperation;}
}
module.exports={get,update,reset,subscribe,testScope,flush};
