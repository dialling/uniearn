'use strict';
// Yuni's shop, wardrobe and fishing rules (2026-11-15).
// utils/yuni-catalog.js is an identical copy for the mini program; tests/yuni-play.test.js keeps them in sync.
// slot: where the item goes. price: shop price in points. level: free reward at that Yuni level.
// odds: a fishing tool; chances in % of a [common, rare, super rare] catch.
const ITEMS = [
  { id: 'rod', slot: 'hand', zh: '竹制鱼竿', en: 'Bamboo rod', price: 120, tier: 1, odds: [70, 25, 5] },
  { id: 'rod2', slot: 'hand', zh: '碳素鱼竿', en: 'Carbon rod', price: 200, tier: 2, odds: [55, 33, 12] },
  { id: 'rod3', slot: 'hand', zh: '黄金鱼竿', en: 'Golden rod', price: 400, tier: 3, odds: [40, 38, 22] },
  { id: 'trident', slot: 'hand', zh: '船长三叉戟', en: 'Captain\'s trident', level: 5, tier: 4, odds: [30, 40, 30], strike: true },
  { id: 'captain', slot: 'hat', zh: '船长帽', en: 'Captain\'s hat', price: 0 },
  { id: 'straw', slot: 'hat', zh: '草帽', en: 'Straw hat', price: 60 },
  { id: 'beanie', slot: 'hat', zh: '毛线帽', en: 'Wool beanie', price: 80 },
  { id: 'crown', slot: 'hat', zh: '金色皇冠', en: 'Gold crown', price: 400 },
  { id: 'green', slot: 'scarf', zh: '校园绿', en: 'Campus green', price: 0, color: ['#0B7A55', '#08603F'] },
  { id: 'coral', slot: 'scarf', zh: '珊瑚红', en: 'Coral', price: 30, color: ['#e8604c', '#b9412f'] },
  { id: 'sky', slot: 'scarf', zh: '天空蓝', en: 'Sky blue', price: 30, color: ['#3f8fe0', '#2a67ad'] },
  { id: 'sun', slot: 'scarf', zh: '向日葵黄', en: 'Sunflower', price: 30, color: ['#f2b233', '#c98a12'] },
  { id: 'satchel', slot: 'bag', zh: '跑腿挎包', en: 'Delivery satchel', level: 2 },
  { id: 'backpack', slot: 'bag', zh: '双肩包', en: 'Backpack', price: 90 },
  { id: 'epaulettes', slot: 'badge', zh: '金色肩章', en: 'Gold epaulettes', level: 3 },
  { id: 'cape', slot: 'back', zh: '披风与勋章', en: 'Cape and medal', level: 4 },
  { id: 'balloon', slot: 'left', zh: '红气球', en: 'Red balloon', price: 50 },
  { id: 'morning', slot: 'scene', zh: '清晨海面', en: 'Morning sea', price: 0, sw: ['#a9dfc9', '#0b7a55'] },
  { id: 'sunset', slot: 'scene', zh: '日落海湾', en: 'Sunset bay', price: 60, sw: ['#ff8f73', '#b9544c'] },
  { id: 'aurora', slot: 'scene', zh: '极光之夜', en: 'Aurora night', price: 90, sw: ['#1d3a6c', '#124a66'] },
  { id: 'lagoon', slot: 'scene', zh: '椰林潟湖', en: 'Palm lagoon', price: 90, sw: ['#7fd0ff', '#14a8ba'] },
  { id: 'sakura', slot: 'scene', zh: '樱花海岸', en: 'Cherry blossom', price: 80, sw: ['#ffc6d9', '#5fb8b0'] },
  { id: 'snow', slot: 'scene', zh: '雪花冰原', en: 'Snowfall', price: 100, sw: ['#cfe3f7', '#4f86b8'] },
  { id: 'starry', slot: 'scene', zh: '星空夜海', en: 'Starry night', price: 120, sw: ['#151c4a', '#2a3f8f'] },
  { id: 'rainbow', slot: 'scene', zh: '彩虹晴空', en: 'Rainbow sky', price: 150, sw: ['#9be3ff', '#2bb3a3'] },
  { id: 'floe', slot: 'ride', zh: '浮冰', en: 'Ice floe', price: 0 },
  { id: 'ring', slot: 'ride', zh: '游泳圈', en: 'Swim ring', price: 90 },
  { id: 'boat', slot: 'ride', zh: '小木船', en: 'Little boat', price: 140 },
  // helper: chance in % that the friend catches an extra fish after Yuni lands one, and the odds of that fish.
  { id: 'eagle', slot: 'friend', zh: '海鹰伙伴', en: 'Eagle friend', price: 300, helper: { chance: 30, odds: [80, 17, 3] } }
];
const TABS = [
  { zh: '鱼竿', en: 'Fishing rods', slots: ['hand'] },
  { zh: '场景', en: 'Scenes', slots: ['scene'] },
  { zh: '帽子', en: 'Hats', slots: ['hat'] },
  { zh: '围巾', en: 'Scarves', slots: ['scarf'] },
  { zh: '背包与装备', en: 'Bags and gear', slots: ['bag', 'badge', 'back', 'left'] },
  { zh: '坐骑', en: 'Rides', slots: ['ride'] },
  { zh: '伙伴', en: 'Friends', slots: ['friend'] }
];
// Slots that always hold something.
const DEFAULT_WORN = { hat: 'captain', scarf: 'green', scene: 'morning', ride: 'floe' };
const REQUIRED = ['scarf', 'scene', 'ride'];
const RARITY = { common: { zh: '普通', en: 'Common', points: 2 }, rare: { zh: '稀有', en: 'Rare', points: 5 }, super: { zh: '超稀有', en: 'Super rare', points: 10 } };
const FISH = [
  { id: 'sardine', zh: '银色沙丁鱼', en: 'Silver sardine', r: 'common', a: '#a9cde8', b: '#6b9ac0' },
  { id: 'anchovy', zh: '蓝色凤尾鱼', en: 'Blue anchovy', r: 'common', a: '#6fa8f0', b: '#3f6fc4', shape: 'long' },
  { id: 'mackerel', zh: '青花鱼', en: 'Green mackerel', r: 'common', a: '#7fd6a4', b: '#2f9e6c', pattern: 'stripes' },
  { id: 'goby', zh: '沙滩虾虎鱼', en: 'Sand goby', r: 'common', a: '#ecd29a', b: '#c2a05a', pattern: 'spots' },
  { id: 'squid', zh: '小鱿鱼', en: 'Little squid', r: 'common', a: '#f6b8d2', b: '#d9799f', shape: 'squid' },
  { id: 'herring', zh: '小鲱鱼', en: 'Little herring', r: 'common', a: '#c9d6e2', b: '#7f93a8', shape: 'long' },
  { id: 'goldfish', zh: '小金鱼', en: 'Goldfish', r: 'common', a: '#ffb347', b: '#f07f1a' },
  { id: 'bream', zh: '粉色鲷鱼', en: 'Pink sea bream', r: 'common', a: '#f6b0a8', b: '#d6736a', pattern: 'spots' },
  { id: 'bass', zh: '条纹鲈鱼', en: 'Striped bass', r: 'common', a: '#b4cf94', b: '#6b8a4a', pattern: 'stripes' },
  { id: 'bluecrab', zh: '蓝色小蟹', en: 'Blue crab', r: 'common', a: '#7fb3e0', b: '#3a6f9e', shape: 'crab' },
  { id: 'snapper', zh: '条纹鲷鱼', en: 'Striped snapper', r: 'rare', a: '#ff9a5c', b: '#e0572e', pattern: 'stripes' },
  { id: 'clown', zh: '小丑鱼', en: 'Clownfish', r: 'rare', a: '#ff8a2a', b: '#d9601a', pattern: 'bands' },
  { id: 'puffer', zh: '河豚', en: 'Pufferfish', r: 'rare', a: '#ffe27a', b: '#d9a92a', shape: 'round' },
  { id: 'crab', zh: '红螃蟹', en: 'Red crab', r: 'rare', a: '#f0604c', b: '#b9382a', shape: 'crab' },
  { id: 'tang', zh: '蓝吊鱼', en: 'Blue tang', r: 'rare', a: '#3f7fe8', b: '#1f3f99', pattern: 'spots' },
  { id: 'lion', zh: '狮子鱼', en: 'Lionfish', r: 'rare', a: '#ffd2c2', b: '#d9442e', pattern: 'bands' },
  { id: 'octopus', zh: '紫色章鱼', en: 'Purple octopus', r: 'rare', a: '#b58be0', b: '#7a4fb5', shape: 'squid' },
  { id: 'parrot', zh: '鹦嘴鱼', en: 'Parrotfish', r: 'rare', a: '#5fe0c0', b: '#e85f9a', pattern: 'stripes' },
  { id: 'koi', zh: '黄金锦鲤', en: 'Golden koi', r: 'super', a: '#ffe08a', b: '#f2a91e', pattern: 'spots' },
  { id: 'rainbow', zh: '彩虹鱼', en: 'Rainbow fish', r: 'super', a: 'url(#rb)', b: '#8a5ad6' },
  { id: 'shark', zh: '鲨鱼宝宝', en: 'Baby shark', r: 'super', a: '#9fb2c6', b: '#62788f', shape: 'shark' },
  { id: 'moon', zh: '月光河豚', en: 'Moon puffer', r: 'super', a: '#eef3ff', b: '#9aa8d6', shape: 'round' },
  { id: 'ruby', zh: '红宝石蟹', en: 'Ruby crab', r: 'super', a: '#e0245e', b: '#8f1240', shape: 'crab' },
  { id: 'ghost', zh: '幽灵鲨', en: 'Ghost shark', r: 'super', a: '#e6f2f7', b: '#a5c4d4', shape: 'shark' },
  { id: 'dragon', zh: '海龙', en: 'Sea dragon', r: 'super', a: '#7fe0b0', b: '#f2a91e', pattern: 'bands', shape: 'long' }
];
// Fishing opens when orders peak (China time): one try in each window.
const WINDOWS = [{ id: 'lunch', zh: '午餐', en: 'lunch', from: 11, to: 14 }, { id: 'dinner', zh: '晚餐', en: 'dinner', from: 17, to: 20 }];
const PULLS_NEEDED = 3, PULL_WINDOW_MS = 2400, BUCKET_MAX = 10;
// Lucky draw: every catch rolls on its own, so a coupon can come on any catch, even the first (1% each; at most one every 7 days). Weights pick the prize.
const COUPON_CHANCE = 0.01, COUPON_COOLDOWN_DAYS = 7;
const COUPON_PRIZES = [
  { id: 'yuni-bottle-1', weight: 60, title: '¥1 off any order', short: '¥1 off', face: '¥1', sub: 'off', description: 'Fished up with Yuni · for your next order', max: 1, kind: 'total', days: 14, zh: '任意订单立减 ¥1' },
  { id: 'yuni-bottle-2', weight: 30, title: '¥2 off any order', short: '¥2 off', face: '¥2', sub: 'off', description: 'Fished up with Yuni · for your next order', max: 2, kind: 'total', days: 14, zh: '任意订单立减 ¥2' },
  { id: 'yuni-bottle-free', weight: 10, title: 'Free delivery', short: 'Free delivery', face: 'FREE', sub: 'delivery', description: 'Fished up with Yuni · up to ¥8 off the delivery fee', max: 8, kind: 'delivery', days: 14, zh: '免配送费（最高 ¥8）' }
];
const item = id => ITEMS.find(i => i.id === id) || null;
const fish = id => FISH.find(f => f.id === id) || null;
module.exports = { ITEMS, TABS, DEFAULT_WORN, REQUIRED, RARITY, FISH, WINDOWS, PULLS_NEEDED, PULL_WINDOW_MS, BUCKET_MAX, COUPON_CHANCE, COUPON_COOLDOWN_DAYS, COUPON_PRIZES, item, fish };
