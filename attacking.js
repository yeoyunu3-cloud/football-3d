import {variation} from './match-variation.js?v=20261114-corner3';
import {passSafety,tacticValue} from './tactics.js?v=20261114-corner3';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function attackPlan(match,carrier){
  const team=carrier.team,s=match.attackSign(team),all=match.players.filter(p=>p.team===team&&!p.sentOff&&p.index>0&&p.id!==carrier.id),opponents=match.players.filter(p=>p.team!==team&&!p.sentOff&&p.index>0),side=Math.sign(carrier.z)||1,wide=Math.abs(carrier.z)>14,depth=carrier.x*s;
  const pressure=Math.min(40,...opponents.map(p=>distance(p,carrier))),crowded=opponents.filter(p=>distance(p,carrier)<14&&Math.sign(p.z)===side).length>=3;
  const forwards=all.filter(p=>['ST','LW','RW','AM'].includes(p.role)).sort((a,b)=>b.x*s-a.x*s),support=all.filter(p=>p.index>4&&distance(p,carrier)>4&&distance(p,carrier)<23&&passSafety(match,carrier,p)>-.05).sort((a,b)=>(['CM','DM','AM'].includes(b.role)?2:0)-(['CM','DM','AM'].includes(a.role)?2:0)+passSafety(match,carrier,b)-passSafety(match,carrier,a)+(distance(a,carrier)-distance(b,carrier))*.04)[0];
  const overlap=all.filter(p=>['LB','RB','CM'].includes(p.role)&&Math.sign(p.z)===side&&p.x*s<depth+3).sort((a,b)=>distance(a,carrier)-distance(b,carrier))[0],opposite=all.filter(p=>['LM','RM','LW','RW'].includes(p.role)&&Math.sign(p.z)!==side).sort((a,b)=>Math.abs(b.z)-Math.abs(a.z))[0];
  const transition=match.time-(match.possessionWonAt?.[team]??-20)<6&&(match.possessionWonAt?.[team]??0)>.01,build=tacticValue(match.tactics[team],'buildUp');
  let kind=wide&&depth>35?'cutback':wide&&crowded&&opposite?'switch':wide&&overlap?'overlap':pressure<4.8&&support?'oneTwo':transition&&build!=='possession'?'counter':'probe';
  if(!wide&&support&&depth>-15&&depth<30&&['probe','oneTwo'].includes(kind)&&variation(match,`plan:${carrier.id}:${Math.floor(match.time/3)}`)>.6)kind='thirdMan';
  return {kind,team,carrier:carrier.id,side,forwards:forwards.map(p=>p.id),support:support?.id,overlap:overlap?.id,opposite:opposite?.id,createdAt:match.time};
}
export function attackPosition(match,p,carrier,plan,target){
  if(!plan||p.id===carrier.id||p.index===0||p.runUntil>match.time)return target;
  const s=match.attackSign(p.team),rank=plan.forwards.indexOf(p.id),side=plan.side;let result={...target};
  if(plan.kind==='cutback'&&rank>=0&&rank<3)result={x:s*[45,39,43][rank],z:[side*3,0,-side*6][rank],speed:8.5};
  if(plan.kind==='overlap'&&p.id===plan.overlap)result={x:clamp(carrier.x+s*9,-48,48),z:clamp(carrier.z+side*3,-29,29),speed:8.7};
  if(plan.kind==='overlap'&&rank===0)result={x:s*clamp(carrier.x*s+11,20,46),z:side*4,speed:8.4};
  if(plan.kind==='switch'&&p.id===plan.opposite)result={x:clamp(carrier.x+s*5,-42,44),z:-side*25,speed:8.4};
  if(['oneTwo','probe','thirdMan'].includes(plan.kind)&&p.id===plan.support)result={x:clamp(carrier.x+s*3,-39,43),z:clamp(carrier.z+(p.z>=carrier.z?8:-8),-24,24),speed:7.8};
  if(plan.kind==='counter'&&rank>=0&&rank<3)result={x:s*clamp(carrier.x*s+16+(rank%2)*3,-10,47),z:['LW','RW'].includes(p.role)?Math.sign(match.basePosition(p)[1]*s)*25:(rank-1)*11,speed:8.9};
  if(plan.kind==='thirdMan'&&rank===0)result={x:s*clamp(carrier.x*s+13,-12,45),z:clamp(carrier.z+(p.z>=carrier.z?11:-11),-23,23),speed:8.5};
  return result;
}
