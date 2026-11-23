const assert=require('node:assert/strict'),fs=require('node:fs');
let definition;global.Page=d=>definition=d;
global.wx={getStorageSync:()=>null,setStorageSync(){},showToast(){},pageScrollTo(){}};
require('../pages/rewards/index');
const page={...definition,data:structuredClone(definition.data),setData(patch){Object.assign(this.data,patch);}};
assert.equal(page.openActivity,undefined,'Rank has no live entry handler');
page.openSection({currentTarget:{dataset:{screen:'activity'}}});assert.equal(page.data.screen,'home','activity cannot be opened through generic sections');
const xml=fs.readFileSync('pages/rewards/index.wxml','utf8');assert.doesNotMatch(xml,/rankingRows|activityTab|screen==='activity'/);assert.match(xml,/rank-coming-soon/);assert.match(xml,/aria-disabled="true"/);
console.log('Activity leaderboard: hidden entry and coming-soon guard passed.');
