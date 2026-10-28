// News advertises current campaigns; personal coupon inventory stays in Me.
function display(campaigns,zh,now=Date.now()){
 return (Array.isArray(campaigns)?campaigns:[]).map((c,index)=>({...c,_order:index})).filter(c=>c&&c.id&&c.enabled!==false&&!c.automatic&&!c.returning&&!['welcome-free','welcome-two','return2026'].includes(c.id)&&(!c.start||Number.isFinite(Date.parse(c.start))&&Date.parse(c.start)<=now)&&(!c.end||Number.isFinite(Date.parse(c.end))&&Date.parse(c.end)>now)).sort((a,b)=>b._order-a._order).map(c=>{const {_order,...item}=c;return {...item,title:zh?(c.titleZh||c.title):(c.title||c.titleZh),description:zh?(c.descriptionZh||c.description||''):(c.description||c.descriptionZh||'')};});
}
module.exports={display};
