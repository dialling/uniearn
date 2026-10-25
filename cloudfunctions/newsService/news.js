const crypto=require('crypto');
const MAX_ITEMS=30;
const fail=(code,error)=>({ok:false,code,error});
function clean(input={}){
  const value={};
  for(const [key,max] of Object.entries({titleZh:100,titleEn:160,bodyZh:3000,bodyEn:5000,cover:500})){
    if(input[key]!=null&&typeof input[key]!=='string')throw Error('Invalid text field: '+key);
    value[key]=String(input[key]||'').trim();
    if(value[key].length>max)throw Error(key+' exceeds '+max+' characters.');
  }
  if(!['draft','published'].includes(input.status))throw Error('Invalid publication status.');
  value.status=input.status;
  if(!(value.titleZh&&value.bodyZh)&&!(value.titleEn&&value.bodyEn))throw Error('Complete a title and body in at least one language.');
  if(!!value.titleZh!==!!value.bodyZh||!!value.titleEn!==!!value.bodyEn)throw Error('Each language needs both a title and body.');
  if(value.cover&&!/^cloud:\/\/[A-Za-z0-9._/-]+$/.test(value.cover))throw Error('Upload the cover to cloud storage first.');
  value.pinned=input.pinned===true;
  return value;
}
function publicItems(state){
  return (state.items||[]).filter(x=>x.status==='published').sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.publishedAt-a.publishedAt).map(x=>{
    const {_id,titleZh,titleEn,bodyZh,bodyEn,cover,pinned,publishedAt}=x;
    return {_id,titleZh,titleEn,bodyZh,bodyEn,cover,pinned,publishedAt};
  });
}
async function handleNews({event,isAdmin,repo,id,now}){
  const action=event.action;
  if(action==='newsList'){
    const state=await repo.newsGet();
    return {ok:true,revision:state.revision||0,items:publicItems(state)};
  }
  if(!isAdmin)return fail('FORBIDDEN','请先登录管理员账号 / Admin login required.');
  if(action==='newsAdminList')return {ok:true,...await repo.newsGet(),maxItems:MAX_ITEMS};
  if(!['newsSave','newsDelete'].includes(action))return fail('INVALID_ACTION','Unknown news action.');
  if(!Number.isSafeInteger(event.revision)||event.revision<0)return fail('INVALID_REVISION','Refresh the news list first.');
  const key=event.id||'';
  if(key&&!/^[a-f0-9]{24}$/.test(key))return fail('INVALID_ID','Invalid news ID.');
  let value;
  try{if(action==='newsSave')value=clean(event.item);}catch(e){return fail('INVALID_NEWS',e.message);}
  const newId=crypto.randomBytes(12).toString('hex'),stamp=now();
  return repo.newsMutate(state=>{
    if((state.revision||0)!==event.revision)return fail('NEWS_CONFLICT','内容已更新，请刷新后重试 / News changed. Reload before saving.');
    const items=[...(state.items||[])],index=items.findIndex(x=>x._id===key);
    if(key&&index<0)return fail('NEWS_MISSING','This news item no longer exists.');
    if(action==='newsDelete'){
      if(!key)return fail('INVALID_ID','Choose an item first.');
      items.splice(index,1);
    }else{
      if(index<0&&items.length>=MAX_ITEMS)return fail('NEWS_LIMIT','最多保留 30 条，请删除旧内容 / Remove an old item before adding more (maximum 30).');
      const old=index<0?{}:items[index];
      const item={...value,_id:key||newId,createdAt:old.createdAt||stamp,updatedAt:stamp,updatedBy:id,publishedAt:value.status==='published'?(old.status==='published'?old.publishedAt:stamp):null};
      if(index<0)items.unshift(item);else items[index]=item;
    }
    const next={revision:(state.revision||0)+1,items};
    if(Buffer.byteLength(JSON.stringify(next),'utf8')>650000)return fail('NEWS_SIZE','内容总量过大，请删除旧内容 / Remove older content to free space.');
    return {ok:true,state:next,revision:next.revision,id:key||newId};
  });
}
module.exports={handleNews,clean,publicItems};
