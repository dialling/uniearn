const store=require('./store');let listeners=[],pending=[],current=null,currentListener=null;const seen={};let suspended=false;
function emit(event){if(suspended||!event||seen[event.key])return;seen[event.key]=true;if(store.get().yuniTips===false)return;pending.push(event);flush();}
function flush(){if(suspended)return;if(store.get().yuniTips===false||current||!listeners.length||!pending.length)return;current=pending.shift();currentListener=listeners[listeners.length-1];currentListener(current);}
function subscribe(fn){listeners=listeners.filter(x=>x!==fn);listeners.push(fn);flush();return()=>{listeners=listeners.filter(x=>x!==fn);if(currentListener===fn&&current){pending.unshift(current);current=null;currentListener=null;}flush();};}
function next(){current=null;currentListener=null;flush();}
function suspend(){suspended=true;pending=[];const listener=currentListener;current=null;currentListener=null;if(listener)listener(null);}
function resume(){suspended=false;}
function reset(){pending=[];current=null;currentListener=null;Object.keys(seen).forEach(k=>delete seen[k]);Object.keys(awaitingSettle).forEach(k=>delete awaitingSettle[k]);}
// Discard cosmetic events muted by the user; order notifications use a separate channel.
if(store.subscribe)store.subscribe(()=>{if(store.get().yuniTips===false){pending=[];current=null;currentListener=null;}});
// 结算状态以服务端支付字段为准，不看刚好同步到哪个快照：
// paid_out=已结算；paid=托管待确认；none/unpaid/refunding/refunded=没有钱可结（不能说已结算）。
// 没有支付字段的快照（测试账本）：confirmed 即已结算。
function settleOf(r){
  const ps=String(r.paymentStatus||'');
  if(ps==='paid_out')return 'settled';
  if(ps==='paid')return 'escrow';
  if(ps)return 'none';
  return r.status==='confirmed'?'settled':(r.status==='delivered'?'escrow':'');
}
// 已播报「待确认」的跑手单：结算可能在状态不再变化时落地（后台同步、漏快照），
// reconcile 对照最新快照补发「已结算」弹窗。
const awaitingSettle={};
const awaitingCopy=zh=>zh?'顾客确认后即可入账；若 2 小时内未确认，将自动确认入账。':'The student can confirm to release your earnings, otherwise they arrive automatically after 2 hours.';
// A queued status is valid only while the latest server snapshot still agrees.
function reconcile(snapshot){
 if(!snapshot||!snapshot.accountId)return;
 const valid=e=>!e.orderId||(e.accountId===snapshot.accountId&&(snapshot.requests||[]).some(r=>r.id===e.orderId&&(r.isMine||r.isRunner)&&r.status===e.orderStatus));
 pending=pending.filter(valid);
 if(current&&!valid(current)){const listener=currentListener;current=null;currentListener=null;if(listener)listener(null);}
 // 结算可能在状态不再变化时落地（后台同步、漏快照）：为已播报「待确认」的跑手单补发「已结算」。
 for(const id of Object.keys(awaitingSettle)){
  if(awaitingSettle[id]!==snapshot.accountId)continue;
  const r=(snapshot.requests||[]).find(x=>x.id===id);
  if(!r||!r.isRunner||['cancelled','refunded'].includes(r.status)){delete awaitingSettle[id];continue;}
  if(r.status==='confirmed'&&settleOf(r)==='settled'){delete awaitingSettle[id];status(r,snapshot.revision);}
 }
 flush();
}
function status(r,revision,fromStatus){const zh=store.get().language!=='en',mine=r.isMine,orderMeta={orderId:r.id,orderStatus:r.status,accountId:store.get().profile.accountId};let title='',text='',pose='wave';
// The dedicated success video already confirms a new order; do not queue a second popup.
if(r.status==='waiting'){if(r.cancellation&&mine){title=zh?'订单仍在进行':'Order still active';text=zh?'订单已回到接单大厅，并未取消。可在我的订单中继续查看。':'It is back on the job board and was not cancelled. It stays in My orders.';pose='wave';emit({...orderMeta,key:'order:'+store.get().profile.accountId+':'+r.id+':returned:'+revision,title,text,pose});}return;}
if(r.status==='taken'){title=mine?(zh?'有人接单了！':'A runner is on it!'):(zh?'出发吧！':'Letʼs go!');text=mine?(zh?'留意订单消息，保持联系。':'Keep an eye on order messages.'):(r.category==='task'?(zh?'查看任务详情，按时完成。':'Check the task details and get it done on time.'):(zh?'前往取件地点，核对订单信息。':'Head to '+(require('./route-label').pickup(r,'en')||r.station)+'. Check the order details before pickup.'));pose='go';}
if(r.status==='collected'){title=mine?(zh?'在路上了！':'On the way!'):(zh?'已取到！':'Picked up!');text=mine?(zh?'跑手正在送来。':'Your runner is bringing it to you.'):(zh?'请送到约定地点。':'Deliver to the agreed spot.');pose='bag';}
if(r.status==='delivered'){title=mine?(zh?'送到了！':'Itʼs here!'):(zh?'这单完成了！':'Nice run!');text=mine?(zh?'检查物品后，在订单里确认完成。':'Check it, then confirm completion on the order.'):awaitingCopy(zh);pose=mine?'happy':'deliver';}
if(r.status==='confirmed'){const s=settleOf(r);if(s==='settled'){title=zh?'已确认完成！':'Confirmed!';text=zh?'订单已完成，测试账本已结算。':'The order is complete and the test ledger has settled.';pose='earn';}else if(s==='escrow'){title=zh?'这单完成了！':'Nice run!';text=awaitingCopy(zh);pose='deliver';}else{title=zh?'这单完成了！':'Nice run!';text=zh?'订单已完成。':'The order is complete.';pose='deliver';}}
if(r.status==='cancelled'){title=zh?'订单已取消':'Order cancelled';text=zh?'查看订单了解详情和测试退款记录。':'Open the order for details and its test refund record.';pose='oops';}
if(r.status==='refunded'){title=zh?'无人接单，已退款':'No runner · refunded';text=zh?'订单已关闭，测试退款已记录。':'The order closed and the demo refund is recorded.';pose='oops';}
if(r.status==='disputed'){title=zh?'问题已提交':'Problem reported';text=zh?'赏金已冻结，我们将在 24 小时内审核处理。':'Payment is on hold. We will review the issue within 24 hours.';pose='think';}
if(r.status==='delivered'&&!mine)awaitingSettle[r.id]=orderMeta.accountId;
if(['confirmed','cancelled','refunded'].includes(r.status))delete awaitingSettle[r.id];
if(title)emit({...orderMeta,key:'order:'+store.get().profile.accountId+':'+r.id+':'+r.status+':'+revision,title,text,pose});}
module.exports={suspend,resume,emit,subscribe,next,reset,status,reconcile};
