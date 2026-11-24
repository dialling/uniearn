const crypto=require('crypto'),{promisify}=require('util'),pbkdf2=promisify(crypto.pbkdf2);
const hash=value=>crypto.createHash('sha256').update(String(value||'')).digest('hex');
const equal=(a,b)=>crypto.timingSafeEqual(Buffer.from(hash(a),'hex'),Buffer.from(hash(b),'hex'));
async function passwordHash(password,salt){return (await pbkdf2(password,salt,210000,32,'sha256')).toString('hex');}
async function createAdmin(username,password){
  username=String(username||'').trim();
  if(!/^[A-Za-z0-9_.@-]{3,60}$/.test(username)||typeof password!=='string'||password.length<12||password.length>200)throw Error('账号需 3–60 位英文或数字，密码至少 12 位。');
  const salt=crypto.randomBytes(16).toString('hex');
  return {username,salt,passwordHash:await passwordHash(password,salt),tokenKey:crypto.randomBytes(32).toString('hex'),createdAt:Date.now(),fails:0,lockedUntil:0};
}
async function checkPassword(admin,username,password){
  if(typeof username!=='string'||typeof password!=='string'||password.length>200)return false;
  const derived=await passwordHash(password,admin.salt);
  return equal(derived,admin.passwordHash)&&equal(username.trim(),admin.username);
}
const sign=(value,key)=>crypto.createHmac('sha256',key).update(value).digest('base64url');
const SESSION_TTL=30*86400000;
function mintToken(admin,now){const payload=Buffer.from(JSON.stringify({aud:'uniearn-news',sub:admin._id||'admin',exp:now+SESSION_TTL,nonce:crypto.randomBytes(12).toString('hex')})).toString('base64url');return payload+'.'+sign(payload,admin.tokenKey);}
function tokenExpiry(token){try{return JSON.parse(Buffer.from(String(token).split('.')[0],'base64url').toString()).exp||0;}catch(_){return 0;}}
function tokenSubject(token){try{const p=JSON.parse(Buffer.from(String(token).split('.')[0],'base64url').toString());return p.sub||'admin';}catch(_){return '';}}
function verifyToken(token,admin,now){try{const [payload,signature,...extra]=String(token||'').split('.');if(!payload||!signature||extra.length||!equal(signature,sign(payload,admin.tokenKey)))return false;const value=JSON.parse(Buffer.from(payload,'base64url').toString());return value.aud==='uniearn-news'&&Number.isFinite(value.exp)&&value.exp>now&&value.exp<=now+SESSION_TTL;}catch(_){return false;}}
module.exports={hash,equal,createAdmin,checkPassword,mintToken,verifyToken,tokenSubject,tokenExpiry,SESSION_TTL};
