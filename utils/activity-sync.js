const {call}=require('./news');
function subscribe(onData,onError){
 let stopped=false,timer;
 async function pull(){
  try{const result=await call('activityConfig');if(!result.config||!Array.isArray(result.config.tasks))throw Error('Invalid activity configuration');if(!stopped)onData(result.config);}
  catch(e){if(!stopped)onError(e);}
  finally{if(!stopped)timer=setTimeout(pull,5000);}
 }
 pull();return()=>{stopped=true;clearTimeout(timer);};
}
module.exports={subscribe};
