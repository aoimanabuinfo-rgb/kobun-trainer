/* Kobun Trainer: private, device-local, opt-in score record. No network requests. */
(function(){
'use strict';
const KEY='kobun:scoreboard:v1',UNITS=['jodoshi','yougen','culture'],DAILY_LIMIT=200;
const freshCounts=()=>({right:0,wrong:0,viewed:0});
const fresh=()=>({v:1,xp:0,totals:Object.fromEntries(UNITS.map(u=>[u,freshCounts()])),best:{},weak:{},day:{date:'',counted:{jodoshi:[],yougen:[],culture:[]},rewarded:[],points:0},recent:[]});
const num=x=>Number.isSafeInteger(x)&&x>=0&&x<=10000000?x:0;
const validId=x=>typeof x==='string'&&x.length>0&&x.length<=85&&/^[a-zA-Z0-9:_-]+$/.test(x);
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
function read(){
 const d=fresh();let obj;try{obj=JSON.parse(localStorage.getItem(KEY)||'null')}catch{return d}
 if(!obj||obj.v!==1||typeof obj!=='object')return d;
 d.xp=Math.min(num(obj.xp),10000000);
 for(const u of UNITS){
  const t=obj.totals?.[u]||{};
  d.totals[u]={right:num(t.right),wrong:num(t.wrong),viewed:num(t.viewed)};
  const b=obj.best?.[u];if(b&&Number.isInteger(b.rate)&&b.rate>=0&&b.rate<=100&&num(b.n)>=5&&num(b.n)<=150&&typeof b.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(b.date))d.best[u]={rate:b.rate,n:b.n,date:b.date};
 }
 if(obj.weak&&typeof obj.weak==='object'&&!Array.isArray(obj.weak))for(const [k,v] of Object.entries(obj.weak).slice(-350))if(validId(k)&&v===1)d.weak[k]=1;
 const day=obj.day;
 if(day&&typeof day.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day.date)){
  d.day.date=day.date;d.day.points=Math.min(num(day.points),DAILY_LIMIT);
  for(const u of UNITS){d.day.counted[u]=Array.isArray(day.counted?.[u])?[...new Set(day.counted[u].filter(validId))].slice(0,300):[]}
  d.day.rewarded=Array.isArray(day.rewarded)?[...new Set(day.rewarded.filter(validId))].slice(0,900):[];
 }
 if(Array.isArray(obj.recent))for(const item of obj.recent.slice(0,60)){
  if(!UNITS.includes(item?.u)||typeof item.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(item.date))continue;
  const r=num(item.right),w=num(item.wrong),v=num(item.viewed);
  if(r+w+v>150)continue;
  d.recent.push({u:item.u,date:item.date,right:r,wrong:w,viewed:v,earned:Math.min(num(item.earned),DAILY_LIMIT),format:typeof item.format==='string'?item.format.slice(0,24):''});
 }
 return d
}
function record(unit,items,format){
 if(!UNITS.includes(unit)||!Array.isArray(items)||items.length<1)return false;
 const attempts=[],uniq=new Set();
 for(const a of items){
  if(!a||!validId(a.id)||!['right','wrong','viewed'].includes(a.status)||uniq.has(a.id))continue;
  uniq.add(a.id);attempts.push({id:a.id,status:a.status});if(attempts.length>=150)break;
 }
 if(!attempts.length)return false;
 try{
  const d=read(),date=today();
  if(d.day.date!==date)d.day={date,counted:{jodoshi:[],yougen:[],culture:[]},rewarded:[],points:0};
  const credited=new Set(d.day.rewarded),counted=new Set(d.day.counted[unit]);
  let right=0,wrong=0,viewed=0,earned=0;
  for(const a of attempts){
   d.totals[unit][a.status]++;if(a.status==='right')right++;else if(a.status==='wrong')wrong++;else viewed++;
   const key=unit+':'+a.id;
   if(a.status!=='viewed')counted.add(a.id);
   if(a.status==='right'){
    if(!credited.has(key)&&d.day.points<DAILY_LIMIT){
     const points=Math.min(DAILY_LIMIT-d.day.points,10+(d.weak[key]?5:0));
     earned+=points;d.day.points+=points;d.xp=Math.min(10000000,d.xp+points);credited.add(key);
    }
    delete d.weak[key];
   }else d.weak[key]=1;
  }
  d.day.counted[unit]=[...counted].slice(-300);d.day.rewarded=[...credited].slice(-900);
  const keys=Object.keys(d.weak);if(keys.length>350)for(const k of keys.slice(0,keys.length-350))delete d.weak[k];
  const answered=right+wrong,rate=answered?Math.round(right/answered*100):0;
  if(answered>=5&&(!d.best[unit]||rate>d.best[unit].rate||(rate===d.best[unit].rate&&answered>d.best[unit].n)))d.best[unit]={rate,n:answered,date};
  d.recent.unshift({u:unit,date,right,wrong,viewed,earned,format:typeof format==='string'?format.slice(0,24):''});
  d.recent=d.recent.slice(0,60);
  const raw=JSON.stringify(d);
  if(raw.length>230000)return false;
  localStorage.setItem(KEY,raw);return true
 }catch{return false}
}
function clear(){try{localStorage.removeItem(KEY);return true}catch{return false}}
window.KobunScore=Object.freeze({read,record,clear,today,units:UNITS.slice(),dailyLimit:DAILY_LIMIT});
})();
