import {outletRisk} from './opponent-adaptation.js?v=20261114-traits3';
import {variation} from './match-variation.js?v=20261114-traits3';
import {predictBall} from './keeper.js?v=20261114-traits3';
import {passSafety,tacticValue} from './tactics.js?v=20261114-traits3';
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function deliveryLane(match,from,to){
  const dx=to.x-from.x,dz=to.z-from.z,length=dx*dx+dz*dz;
  let clearance=12;
  for(const q of match.players){
    if(q.team===from.team||q.sentOff)continue;
    const projection=((q.x-from.x)*dx+(q.z-from.z)*dz)/(length||1);
    // A defender chasing from behind cannot block every forward outlet.
    if(projection<0||projection>1.03)continue;
    const t=clamp(projection,0,1);
    clearance=Math.min(clearance,Math.hypot(q.x-from.x-dx*t,q.z-from.z-dz*t));
  }
  return clearance;
}

// Both sides share assignments. A player keeps a job until another can do it
// materially sooner; merely moving a few centimetres cannot swap the presser.
export function coordinateTeam(match,team,carrier){
  match.teamAI??=[null,null];
  const phase=carrier?carrier.team===team?'attack':'defend':'flight';
  const previous=match.teamAI[team],now=match.controlTime;
  if(previous&&previous.phase===phase&&previous.owner===(carrier?.id??-1)&&now<previous.nextAt&& !match.players[previous.primary]?.sentOff)return previous;
  const excluded=carrier?.team!==team&&carrier&&match.mode==='player'&&team===0?match.selected:-1;
  const players=match.players.filter(p=>p.team===team&&p.index>0&&!p.sentOff&&p.id!==excluded);
  const samples=carrier?[]:Array.from({length:13},(_,i)=>{const t=.12+i*.16;return {t,f:predictBall(match.ball,t)};});
  const ranks=players.map(p=>{
    let arrival=Infinity,point=carrier??match.ball;
    if(carrier)arrival=dist(p,carrier)/8.2+(['CB'].includes(p.role)&&dist(p,carrier)>10?.25:0);
    else for(const {t,f} of samples){if(f.y>1.6)continue;const distance=dist(p,f),toward=((f.x-p.x)*p.vx+(f.z-p.z)*p.vz)/(distance||1),reach=Math.max(0,distance-1.1)/8.4+Math.max(0,6-toward)/35;if(reach<=t){arrival=t;point=f;break;}}
    if(!Number.isFinite(arrival))arrival=dist(p,point)/8.4+.6;
    return {p,arrival};
  }).sort((a,b)=>a.arrival-b.arrival);
  let primary=ranks[0]?.p;
  const incumbent=ranks.find(r=>r.p.id===previous?.primary);
  if(incumbent&&previous.phase===phase&&previous.owner===(carrier?.id??-1)&&primary?.id!==incumbent.p.id){
    const advantage=incumbent.arrival-ranks[0].arrival;
    if(advantage<.32||(now-previous.since<.55&&advantage<.8))primary=incumbent.p;
  }
  if(!carrier&&match.receiveAssist>0){const receiver=match.players[match.receiver];if(receiver?.team===team&&!receiver.sentOff)primary=receiver;}
  const support=ranks.filter(r=>r.p.id!==primary?.id).sort((a,b)=>a.arrival-b.arrival)[0]?.p;
  const state={phase,owner:carrier?.id??-1,primary:primary?.id??-1,secondary:support?.id??-1,since:previous&&primary?.id===previous.primary?previous.since:now,nextAt:now+.18};
  match.teamAI[team]=state;return state;
}

export function coverTarget(match,p,carrier,target){
  const state=match.teamAI?.[p.team];
  if(!state||state.phase!=='defend'||state.secondary!==p.id||p.index===0||state.primary===p.id)return target;
  const s=match.attackSign(p.team),primary=match.players[state.primary];
  // The second defender closes the inside lane, rather than running into the
  // same tackle. A centre back stays in the back line when cover is distant.
  if(dist(p,carrier)>15||p.role==='CB'&&dist(p,carrier)>9)return target;
  // The human carrier is only doubled up when he is already close; otherwise keep the shape.
  const human=match.mode==='player'&&carrier.team===0&&carrier.id===match.selected;
  if(human&&dist(p,carrier)>9)return target;
  const side=primary&&primary.z>=carrier.z?-1:1;
  const beaten=primary&&(primary.x-carrier.x)*s>.8;
  if(beaten&&dist(p,carrier)<8)return {x:carrier.x+carrier.vx*.22,z:carrier.z+carrier.vz*.22,speed:human?7.2:8.5};
  return {x:clamp(carrier.x-s*5.2,-48,48),z:clamp(carrier.z+side*3.8,-29,29),speed:human?6.6:7.8};
}

export function openSupport(match,p,carrier,target){
  if(p.index<=4||p.id===carrier.id||p.runUntil>match.time||match.crossUntil>match.time||dist(p,carrier)>30)return target;
  if(match.laneClearance(carrier,target,p.team)>2.7)return target;
  const s=match.attackSign(p.team),width=tacticValue(match.tactics[p.team],'width'),spread=width==='wide'?6:width==='narrow'?3.2:4.5;
  let best={...target},score=-Infinity;
  for(const [dx,dz] of [[0,0],[-2,-spread],[-2,spread],[2,-spread],[2,spread],[-5,0]]){
    const point={x:clamp(target.x+s*dx,-43,47),z:clamp(target.z+dz,-29,29)};
    const lane=match.laneClearance(carrier,point,p.team),space=Math.min(12,...match.players.filter(q=>q.team!==p.team&&!q.sentOff).map(q=>dist(q,point)));
    const separation=Math.min(8,...match.players.filter(q=>q.team===p.team&&!q.sentOff&&q.id!==p.id&&q.id!==carrier.id).map(q=>dist(q,point)));
    const value=Math.min(lane,5)*2+space*.5+separation*.4-dist(point,target)*.35+(p.supportSpot&&dist(point,p.supportSpot)<2?1.2:0);
    if(value>score){score=value;best={...point,speed:target.speed};}
  }
  p.supportSpot=best;return best;
}

// Compare productive options together, instead of selecting one receiver and
// giving up on every other option when that lane is blocked.
export function bestOutlet(match,p){
  const s=match.attackSign(p.team),tempo=tacticValue(match.tactics[p.team],'tempo'),build=tacticValue(match.tactics[p.team],'buildUp');
  const opponents=match.players.filter(q=>q.team!==p.team&&!q.sentOff),line=Math.max(0,match.ball.x*s,...opponents.map(q=>q.x*s).sort((a,b)=>b-a).slice(1,2));
  const pressure=Math.min(40,...opponents.filter(q=>q.index>0).map(q=>dist(q,p)));
  let best=null;const options=[];
  for(const q of match.players){
    const d=dist(p,q),progress=(q.x-p.x)*s;
    if(q.team!==p.team||q.sentOff||q.id===p.id||q.index===0||d<4||d>39||q.x*s>line+.1)continue;
    const safety=passSafety(match,p,q),lane=deliveryLane(match,p,q);
    if(safety<-.02||lane<1.5||progress<0&&pressure>(progress>-4?5:2.6)&&build!=='possession')continue;
    const space=Math.min(12,...opponents.map(o=>dist(o,q))),centralGain=(Math.abs(p.z)-Math.abs(q.z))*(p.x*s>23?.32:.04);
    const repeat=match.lastDistribution?.[p.team],returning=repeat&&repeat.from===q.id&&match.time-repeat.time<4;
    let score=-outletRisk(match,p.team,q.z)+progress*.32+Math.min(safety,.6)*7+Math.min(lane,5)*.6+Math.min(space,8)*.45+centralGain-Math.max(0,d-23)*.14-(returning?5.5:0);
    if(build==='possession')score+=Math.max(0,18-d)*.13;
    if(progress<0)score-=1.5+Math.abs(progress)*.25;
    const hold=tempo==='fast'?.45:tempo==='controlled'?1:.7;
    if(match.possessionTime<hold&&pressure>4)continue;
    // A carrier with open grass should draw a defender before releasing.
    if(pressure>8&&progress<5&&centralGain<1)continue;
    const option={receiver:q,type:'pass',power:build==='direct'?.65:.42,score};
    options.push(option);
    if(!best||option.score>best.score)best=option;
  }
  for(const option of options.sort((a,b)=>b.score-a.score).slice(0,2)){
    const q=option.receiver,progress=(q.x-p.x)*s;
    if(progress>4&&q.index>4&&q.x*s>0&&q.x*s<44&&build!=='possession'){
      const plan=match.throughSpace(p,q,.5),room=plan.clearance??-10;
      if(plan.gate&&room>1.15&&plan.x*s>q.x*s+3&&plan.score>0){const through={...option,type:'through',power:.5,score:option.score+2+Math.min(3,room*2)};if(through.score>best.score)best=through;}
    }
  }
  if(best&&best.type==='pass'){const close=options.filter(o=>o.score>=best.score-1.5&&o.score>(pressure<5?2.3:4.2));if(close.length>1)best=close[Math.floor(variation(match,`outlet:${p.id}:${Math.floor(match.time*3)}`)*close.length)];}
  return best&&best.score>(pressure<5?2.3:4.2)?best:null;
}

export function shootingWindow(match,p){
  const s=match.attackSign(p.team),keeper=match.players[(1-p.team)*11];
  let best=null;
  for(const z of [-2.6,-1.2,1.2,2.6]){
    const point={x:s*53.5,z},lane=match.laneClearance(p,point,p.team);
    const keeperRoom=Math.abs(z-(keeper.z+keeper.vz*.12));
    const score=Math.min(lane,3)*2+keeperRoom*.45;
    if(!best||score>best.score)best={z,lane,score};
  }
  return best;
}
