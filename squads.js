import {defaultClub,sanitizeClub,loadClub,saveClub} from './roster.js?v=20261114-fix3';
export const SQUADS_KEY='soccer3d.squads.v2',HISTORY_KEY='soccer3d.matches.v1';
const safeName=(s,f)=>String(s??'').trim().slice(0,30)||f;
let serial=0;
const uid=prefix=>`${prefix}-${Date.now().toString(36)}-${++serial}`;
export function loadSquads(storage){
  try{const raw=JSON.parse(storage.getItem(SQUADS_KEY));if(raw?.squads?.length){const squads=raw.squads.slice(0,100).map((s,i)=>({id:String(s.id??uid('squad')),name:safeName(s.name,`스쿼드 ${i+1}`),club:sanitizeClub(s.club)}));return {version:2,activeId:squads.some(s=>s.id===raw.activeId)?raw.activeId:squads[0].id,squads};}}catch{}
  const club=loadClub(storage);return {version:2,activeId:'squad-default',squads:[{id:'squad-default',name:club.name??'내 스쿼드',club}]};
}
export function saveSquads(storage,library){try{storage.setItem(SQUADS_KEY,JSON.stringify(library));const active=library.squads.find(s=>s.id===library.activeId);if(active)saveClub(storage,active.club);return true;}catch{return false;}}
export function createSquad(library,{copy=false,name}={}){const current=library.squads.find(s=>s.id===library.activeId);const next={id:uid('squad'),name:safeName(name,`스쿼드 ${library.squads.length+1}`),club:copy?sanitizeClub(current.club):defaultClub()};library.squads.push(next);library.activeId=next.id;return next;}
export function deleteSquad(library,id){if(library.squads.length<=1)return false;const i=library.squads.findIndex(s=>s.id===id);if(i<0)return false;library.squads.splice(i,1);if(library.activeId===id)library.activeId=library.squads[0].id;return true;}
export function loadHistory(storage){try{const raw=JSON.parse(storage.getItem(HISTORY_KEY));return Array.isArray(raw)?raw.filter(r=>r&&typeof r.id==='string'&&Array.isArray(r.events)&&r.events.every(e=>e&&typeof e.type==='string')&&Array.isArray(r.score)&&r.score.length===2&&['shots','saves','passes'].every(k=>Array.isArray(r.stats?.[k])&&r.stats[k].length===2)).slice(0,50).map(r=>({...r,shootout:r.shootout&&Array.isArray(r.shootout.score)&&r.shootout.score.length===2&&Array.isArray(r.shootout.kicks)?r.shootout:null})):[];}catch{return [];}}
export function saveMatch(storage,record){try{const previous=loadHistory(storage),next=[record,...previous.filter(r=>r.id!==record.id)].slice(0,50);storage.setItem(HISTORY_KEY,JSON.stringify(next));return true;}catch{return false;}}
export function validateNumber(club,index,value){
  if(!Number.isInteger(value)||value<1||value>99)return '등번호는 1~99 사이 정수로 입력하세요.';
  const all=club.players,other=all.find((p,i)=>i!==index&&p.number===value);
  return other?`${value}번은 ${other.name} 선수가 사용 중입니다. 다른 등번호를 입력하세요.`:'';
}

export function clearHistory(storage){try{storage.removeItem(HISTORY_KEY);return storage.getItem(HISTORY_KEY)===null;}catch{return false;}}
