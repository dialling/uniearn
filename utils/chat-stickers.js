const items=[
  {
    "id": "yuni-01",
    "name": "我来啦",
    "en": "Here I come",
    "src": "/stickers/sticker-pack-1/01.gif",
    "pack": "sticker-pack-1"
  },
  {
    "id": "yuni-02",
    "name": "马上到",
    "en": "Almost there",
    "src": "/stickers/sticker-pack-1/02.gif",
    "pack": "sticker-pack-1"
  },
  {
    "id": "yuni-03",
    "name": "送达",
    "en": "Delivered",
    "src": "/stickers/sticker-pack-1/03.gif",
    "pack": "sticker-pack-1"
  },
  {
    "id": "yuni-04",
    "name": "谢谢",
    "en": "Thank you",
    "src": "/stickers/sticker-pack-1/04.gif",
    "pack": "sticker-pack-1"
  },
  {
    "id": "yuni-05",
    "name": "拜拜",
    "en": "Bye",
    "src": "/stickers/sticker-pack-1/05.gif",
    "pack": "sticker-pack-1"
  },
  {
    "id": "yuni-06",
    "name": "在接单",
    "en": "Taking orders",
    "src": "/stickers/sticker-pack-1/06.gif",
    "pack": "sticker-pack-1"
  },
  {
    "id": "yuni-07",
    "name": "思考中",
    "en": "Thinking",
    "src": "/stickers/sticker-pack-2/07.gif",
    "pack": "sticker-pack-2"
  },
  {
    "id": "yuni-08",
    "name": "好的",
    "en": "Got it",
    "src": "/stickers/sticker-pack-2/08.gif",
    "pack": "sticker-pack-2"
  },
  {
    "id": "yuni-09",
    "name": "加油",
    "en": "Keep going",
    "src": "/stickers/sticker-pack-2/09.gif",
    "pack": "sticker-pack-2"
  },
  {
    "id": "yuni-10",
    "name": "安排",
    "en": "On it",
    "src": "/stickers/sticker-pack-2/10.gif",
    "pack": "sticker-pack-2"
  },
  {
    "id": "yuni-11",
    "name": "累趴了",
    "en": "Exhausted",
    "src": "/stickers/sticker-pack-2/11.gif",
    "pack": "sticker-pack-2"
  },
  {
    "id": "yuni-12",
    "name": "奶茶时间",
    "en": "Tea time",
    "src": "/stickers/sticker-pack-2/12.gif",
    "pack": "sticker-pack-2"
  },
  {
    "id": "yuni-16",
    "name": "震惊",
    "en": "Shocked",
    "src": "/stickers/sticker-pack-3/16.gif",
    "pack": "sticker-pack-3"
  },
  {
    "id": "yuni-17",
    "name": "爱心",
    "en": "Love",
    "src": "/stickers/sticker-pack-3/17.gif",
    "pack": "sticker-pack-3"
  },
  {
    "id": "yuni-18",
    "name": "OK",
    "en": "OK",
    "src": "/stickers/sticker-pack-3/18.gif",
    "pack": "sticker-pack-3"
  },
  {
    "id": "yuni-19",
    "name": "冲鸭",
    "en": "Let’s go",
    "src": "/stickers/sticker-pack-3/19.gif",
    "pack": "sticker-pack-3"
  },
  {
    "id": "yuni-20",
    "name": "辛苦啦",
    "en": "Thanks for your work",
    "src": "/stickers/sticker-pack-3/20.gif",
    "pack": "sticker-pack-3"
  }
];
const oldIds={hello:'yuni-01',post:'yuni-06',run:'yuni-02',chat:'yuni-05',thanks:'yuni-04',paid:'yuni-20'};
const loading={};
function list(zh=true){return items.map(s=>({...s,name:zh?s.name:s.en}));}
function lookup(id,zh=true){return list(zh).find(s=>s.id===(oldIds[id]||id));}
function load(){
 const loaders={
  'sticker-pack-1':()=>require.async('../stickers/sticker-pack-1/ready.js'),
  'sticker-pack-2':()=>require.async('../stickers/sticker-pack-2/ready.js'),
  'sticker-pack-3':()=>require.async('../stickers/sticker-pack-3/ready.js')
 };
 return Promise.all(Object.keys(loaders).map(name=>{
  if(!loading[name])loading[name]=Promise.resolve().then(loaders[name]).catch(e=>{delete loading[name];throw e;});
  return loading[name];
 }));
}
module.exports={list,lookup,load};
