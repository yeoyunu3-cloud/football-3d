import {KIT_PRESETS,kitData} from './kits.js?v=20261112-20-release';
import {FORMATION,FORMATIONS,NAMES,NUMBERS,ROLES} from './match.js?v=20261113-skills';
export const CLUB_KEY='soccer3d.club.v1';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const number=(value,fallback,a,b)=>Number.isFinite(Number(value))?clamp(Number(value),a,b):fallback;
const color=(value,fallback)=>/^#[0-9a-f]{6}$/i.test(String(value))?value:fallback;
export function defaultClub(){return {version:3,name:'내 스쿼드',kit:kitData(KIT_PRESETS[0]),formation:'4-4-2',players:NAMES.map((name,i)=>({name,number:NUMBERS[i],height:i===0?190:176+i%5*2,weight:i===0?84:70+i%5*3,skin:['#e4b18f','#c18e69','#935b41'][i%3],hair:'#292329',role:ROLES[i],x:FORMATION[i][0],z:FORMATION[i][1]}))};}
export function sanitizeClub(raw){
  const result=defaultClub();if(!raw||!Array.isArray(raw.players))return result;
  result.formation=[...Object.keys(FORMATIONS),'custom'].includes(raw.formation)?raw.formation:'4-4-2';
  const used=new Set();
  result.name=String(raw.name??result.name).trim().slice(0,30)||result.name;
  result.kit=kitData(KIT_PRESETS.find(kit=>kit.id===raw.kit?.id)??KIT_PRESETS[0]);
  const sanitize=(base,p,i)=>{
    p=p??{};const name=String(p.name??base.name).replace(/[\u0000-\u001f]/g,'').trim().slice(0,20)||base.name;
    let jersey=Math.round(number(p.number,base.number,1,99));if(used.has(jersey))jersey=Array.from({length:99},(_,j)=>j+1).find(n=>!used.has(n));used.add(jersey);
    return {name,number:jersey,height:Math.round(number(p.height,base.height,150,210)),weight:Math.round(number(p.weight,base.weight,45,120)),skin:color(p.skin,base.skin),hair:color(p.hair,base.hair),role:i===0?'GK':['GK','LB','CB','RB','LM','RM','DM','CM','AM','LW','RW','ST'].includes(p.role)&&p.role!=='GK'?p.role:base.role,x:number(p.x,base.x,-50,-1),z:number(p.z,base.z,-31,31)};
  };
  result.players=result.players.map((base,i)=>sanitize(base,raw.players[i],i));
  return result;
}
export function loadClub(storage){try{return sanitizeClub(JSON.parse(storage.getItem(CLUB_KEY)));}catch{return defaultClub();}}
export function saveClub(storage,club){try{storage.setItem(CLUB_KEY,JSON.stringify(sanitizeClub(club)));return true;}catch{return false;}}
export function applyClub(match,club,team=0){
  const safe=sanitizeClub(club);
  if(team===0){match.squadName=safe.name;match.kit=safe.kit;match.customBases=safe.players.map(p=>[p.x,p.z]);}
  else{match.awaySquadName=safe.name;match.awayKit=safe.kit;match.awayCustomBases=safe.players.map(p=>[p.x,p.z]);}
  match.formations[team]=safe.formation;
  safe.players.forEach((profile,i)=>Object.assign(match.players[team*11+i],{...profile,profile:{...profile}}));
  if(!match.running)match.kickoff(0);
}
