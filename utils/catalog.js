const sizes=[
 {id:'small',label:'Small',price:3,weight:'Under 1 kg',examples:'Documents, keychains, small medicine boxes',max:3},
 {id:'medium',label:'Medium',price:4,weight:'1 to <3 kg',examples:'Clothes, shoes, school bags',max:3},
 {id:'large',label:'Large',price:5,weight:'3 to <10 kg',examples:'Quilts, cartons of tissues',max:1},
 {id:'oversized',label:'Extra large',price:10,weight:'10–20 kg',examples:'Case of water, small chair',max:1}
];
function category(r){return r.category||'parcel';}
function sizeId(r){return r.parcelSize||(r.big?'large':'small');}
function label(r){if(r.parcelItems){const counts={};r.parcelItems.forEach(x=>counts[x.size]=(counts[x.size]||0)+1);return sizes.filter(x=>counts[x.id]).map(x=>x.label+' × '+counts[x.id]).join(' · ');}return category(r)==='takeout'?'Takeaway':(sizes.find(x=>x.id===sizeId(r))||sizes[0]).label;}
module.exports={sizes,category,sizeId,label};
