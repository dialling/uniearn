const sizes=[
 {id:'small',label:'Small',price:3,weight:'Under 1 kg',hint:'Documents, keys, small medicine boxes',desc:'Fits in one hand and in a backpack: document bags, keys, small medicine boxes, phone cases and other small parcels.',examples:'Documents, keychains, small medicine boxes',max:9},
 {id:'medium',label:'Medium',price:4,weight:'1 to <3 kg',hint:'Clothes, shoes, school bags',desc:'From a shoebox to a jacket: clothes, shoes, school bags, small appliances — easy to carry with one hand.',examples:'Clothes, shoes, school bags',max:9},
 {id:'large',label:'Large',price:5,weight:'3 to <10 kg',hint:'Quilts, cartons of tissues',desc:'Needs both hands: quilts, down jackets, cartons of tissues or snacks, large parcel boxes.',examples:'Quilts, cartons of tissues',max:9},
 {id:'oversized',label:'Extra large',price:10,weight:'10–20 kg',hint:'Case of water, bedding, chairs',desc:'Heavy or bulky single items one person can still move but with effort: a case of bottled water, bagged bedding, a suitcase, cartons of tissues, dorm chairs, a folding bed. Keep valuables with you; do not order a pick-up for them.',examples:'Case of water, small chair',max:9}
];
function category(r){return r.category||'parcel';}
function sizeId(r){return r.parcelSize||(r.big?'large':'small');}
function label(r){if(r.parcelItems){const counts={};r.parcelItems.forEach(x=>counts[x.size]=(counts[x.size]||0)+1);return sizes.filter(x=>counts[x.id]).map(x=>x.label+' × '+counts[x.id]).join(' · ');}return category(r)==='takeout'?'Takeaway':(sizes.find(x=>x.id===sizeId(r))||sizes[0]).label;}
module.exports={sizes,category,sizeId,label};
