const store=require('./store');let listeners=[],pending=[],current=null,currentListener=null;const seen={};
function emit(event){if(!event||seen[event.key])return;seen[event.key]=true;pending.push(event);flush();}
function flush(){if(current||!listeners.length||!pending.length)return;current=pending.shift();currentListener=listeners[listeners.length-1];currentListener(current);}
function subscribe(fn){listeners=listeners.filter(x=>x!==fn);listeners.push(fn);flush();return()=>{listeners=listeners.filter(x=>x!==fn);if(currentListener===fn&&current){pending.unshift(current);current=null;currentListener=null;}flush();};}
function next(){current=null;currentListener=null;flush();}
function reset(){pending=[];current=null;currentListener=null;Object.keys(seen).forEach(k=>delete seen[k]);}
function status(r,revision){const zh=store.get().language!=='en',mine=r.isMine;let title='',text='',pose='wave';
// The dedicated success video already confirms a new order; do not queue a second popup.
if(r.status==='waiting')return;
if(r.status==='taken'){title=mine?(zh?'有人接单了！':'A runner is on it!'):(zh?'出发吧！':'Let’s go!');text=mine?(zh?'留意订单消息，保持联系。':'Keep an eye on order messages.'):(zh?'前往取件地点，核对订单信息。':'Head to '+r.station+'. Check the order details before pickup.');pose='go';}
if(r.status==='collected'){title=zh?'已取到！':'Picked up!';text=mine?(zh?'跑手正在送来。':'Your runner is bringing it to you.'):(zh?'请送到约定地点。':'Deliver to the agreed spot.');pose='bag';}
if(r.status==='delivered'){title=mine?(zh?'送到了！':'It’s here!'):(zh?'这单完成了！':'Nice run!');text=mine?(zh?'检查物品后，在订单里确认完成。':'Check it, then confirm completion on the order.'):(zh?'等待同学确认后计入测试收益。':'Your test earnings settle when the student confirms.');pose=mine?'happy':'deliver';}
if(r.status==='confirmed'){title=zh?'已确认完成！':'Confirmed!';text=zh?'订单已完成，测试账本已结算。':'The order is complete and the test ledger has settled.';pose='earn';}
if(['cancelled','refunded'].includes(r.status)){title=zh?'订单已取消':'Order cancelled';text=zh?'查看订单了解详情和测试退款记录。':'Open the order for details and its test refund record.';pose='oops';}
if(r.status==='disputed'){title=zh?'问题已提交':'Problem reported';text=zh?'结算已暂停，等待团队处理。':'Settlement is paused while the team checks.';pose='think';}
if(title)emit({key:'order:'+store.get().profile.accountId+':'+r.id+':'+r.status+':'+revision,title,text,pose});}
module.exports={emit,subscribe,next,reset,status};
