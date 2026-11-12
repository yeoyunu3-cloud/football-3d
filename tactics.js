export const TACTIC_OPTIONS={buildUp:[['balanced','균형'],['possession','짧은 패스'],['direct','직선 전개'],['counter','역습']],width:[['narrow','좁게'],['balanced','보통'],['wide','넓게']],tempo:[['controlled','차분하게'],['balanced','보통'],['fast','빠르게']],line:[['low','낮게'],['balanced','보통'],['high','높게']]};
export const TACTIC_LABELS={buildUp:'공격 전개',width:'공격 폭',tempo:'공격 속도',line:'수비 라인'};
export const tacticValue=(t,key)=>t?.[key]??'balanced';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function passSafety(match,from,to){
 const dx=to.x-from.x,dz=to.z-from.z,d=Math.hypot(dx,dz),length=d*d||1,speed=27;let margin=3;
 for(const q of match.players){if(q.sentOff||q.team===from.team||q.index===0)continue;
  const projection=clamp(((q.x-from.x)*dx+(q.z-from.z)*dz)/length,.08,1);
  for(const fraction of [projection,1]){const time=d*fraction/speed,anticipation=Math.min(.24,time)*.65,px=from.x+dx*fraction,pz=from.z+dz*fraction,reach=Math.hypot(q.x+(q.vx??0)*anticipation-px,q.z+(q.vz??0)*anticipation-pz);margin=Math.min(margin,(reach-.9)/7.8-time);}
 }
 return margin;
}
export function dribbleTarget(match,p){
  const s=match.attackSign(p.team),options=[0,.4,-.4,.8,-.8,1.2,-1.2,1.65,-1.65,2.1,-2.1],tactic=match.tactics[p.team],direct=tacticValue(tactic,'buildUp')==='direct';
  let best=null,rank=-Infinity;
  for(const angle of options){const point={x:clamp(p.x+s*Math.cos(angle)*6,-49,49),z:clamp(p.z+Math.sin(angle)*6,-28,28)};let space=12,lane=12;
    for(const q of match.players){if(q.team===p.team||q.sentOff||q.index===0)continue;const qx=q.x+q.vx*.2,qz=q.z+q.vz*.2;space=Math.min(space,Math.hypot(qx-point.x,qz-point.z));const dx=point.x-p.x,dz=point.z-p.z,t=clamp(((qx-p.x)*dx+(qz-p.z)*dz)/(dx*dx+dz*dz||1),0,1);lane=Math.min(lane,Math.hypot(qx-p.x-t*dx,qz-p.z-t*dz));}
    const teammates=Math.min(6,...match.players.filter(q=>q.team===p.team&&q.id!==p.id&&!q.sentOff).map(q=>Math.hypot(q.x-point.x,q.z-point.z)));
    const progress=(point.x-p.x)*s,inside=(Math.abs(p.z)-Math.abs(point.z))*(p.x*s>28?.55:.05),turn=p.dribbleTarget?Math.hypot(point.x-p.dribbleTarget.x,point.z-p.dribbleTarget.z)*.14:0;
    const score=Math.min(space,8)*1.1+Math.min(lane,4)*2+progress*(direct?.75:.5)+inside+teammates*.2-turn-Math.abs(point.z)*.035+(p.dribbleSide&&Math.sign(angle)===p.dribbleSide?.9:0)-Math.max(0,3-Math.hypot(point.x-p.x,point.z-p.z))*2-(progress<0&&p.x*s<46?2+Math.abs(progress)*2:0);
    if(score>rank){rank=score;best={...point,side:Math.sign(angle)};}
  }return best;
}
