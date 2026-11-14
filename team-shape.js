import {hasTrait} from './player-traits.js?v=20261114-runs';
// Off-ball positioning built from real football principles rather than ball-chasing:
//  - Out of possession the team defends as one compact block (flat back line, ~25 m deep),
//    sliding across with the ball; only one player presses, and only on a pressing trigger.
//  - In possession the team stretches: width from wide players, a pivot and rest defence
//    behind the ball, diagonal support for the carrier, forwards on the offside line, timed runs.
// Coordinates inside this module are team-relative: u = metres toward the opponent goal
// (x * attackSign), w = lateral metres (z * attackSign), matching basePosition().
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const WIDE=['LM','RM','LW','RW'],DEFENDERS=['LB','CB','RB'],FORWARDS=['ST','LW','RW'];

function frame(m,team){
  const s=m.attackSign(team),bases=m.players.filter(q=>q.team===team&&q.index>=1&&q.index<=4).map(q=>m.basePosition(q)[0]);
  return {s,defBase:bases.reduce((a,b)=>a+b,0)/Math.max(1,bases.length)};
}
const toWorld=(s,u,w)=>({x:s*u,z:s*w});
// Second-last opponent (keeper included) or the ball / halfway line, whichever is furthest forward.
function offsideU(m,team,s,ballU){return Math.max(0,ballU,m.players.filter(o=>o.team!==team&&!o.sentOff).map(o=>o.x*s).sort((a,b)=>b-a)[1]??52.5);}
function paceTo(p,target){const d=dist(p,target);return d>10?8.1:d>4?7:5.8;}

// Pressing triggers: a player presses only when the carrier is vulnerable.
// inBlock: the carrier has reached the defending team's half, where a mid-block engages him.
export function pressTrigger(m,carrier,{block=true}={}){
  if(!carrier)return false;
  const sc=m.attackSign(carrier.team),facing=Math.sin(carrier.heading)*sc;
  const backToGoal=facing<-.35,touchline=Math.abs(carrier.z)>25,firstTouch=m.possessionTime<.6,danger=carrier.x*sc>22;
  const justLost=m.time-(m.possessionWonAt?.[carrier.team]??-9)<2.2;
  const inBlock=block&&carrier.x*sc>5;
  return backToGoal||touchline||firstTouch||danger||justLost||inBlock;
}

function defendBlock(m,p,ball,carrier){
  const {s,defBase}=frame(m,p.team),base=m.basePosition(p),bu=ball.x*s,bw=ball.z*s;
  const setting=m.tactics[p.team]?.line??'balanced';
  let line=bu-(setting==='high'?20:setting==='low'?30:25);
  line=clamp(line,-46,setting==='high'?2:-6);line=Math.max(-47,Math.min(line,bu-4));
  const depth=(base[0]-defBase)*1.1;
  let u,w;
  if(DEFENDERS.includes(p.role)){
    u=line+(Math.sign(base[1])===Math.sign(bw)&&p.role!=='CB'?1:0);
    w=clamp(base[1]*.92+bw*.25,-29,29);
  }else if(FORWARDS.includes(p.role)){
    u=Math.min(line+depth*.95,bu+6);w=clamp(base[1]*1.3+bw*.2,-24,24);
  }else{
    u=line+depth;w=clamp(base[1]*.92+bw*.25,WIDE.includes(p.role)?-29:-22,WIDE.includes(p.role)?29:22);
  }
  // Zonal: an opponent who enters this player's zone is shadowed from the goal side.
  const threat=m.players.filter(o=>o.team!==p.team&&!o.sentOff&&o.index>0&&o.id!==carrier?.id).map(o=>({o,ou:o.x*s,ow:o.z*s}))
    .filter(t=>Math.abs(t.ow-w)<8&&t.ou>u-6&&t.ou<u+12).sort((a,b)=>Math.hypot(a.ou-u,a.ow-w)-Math.hypot(b.ou-u,b.ow-w))[0];
  if(threat){
    if(DEFENDERS.includes(p.role))w=w*.75+threat.ow*.25;
    else{u=Math.min(u,threat.ou-1.6)*.35+u*.65;w=w*.75+threat.ow*.25;}
  }
  const t=toWorld(s,clamp(u,-48,40),clamp(w,-29,29));return {...t,speed:paceTo(p,t)};
}

function primaryPress(m,p,carrier){
  const s=m.attackSign(p.team),b=m.ball,ownGoal={x:-s*52.5,z:0},gap=dist(p,carrier),carry=Math.hypot(carrier.vx,carrier.vz);
  const human=m.mode==='player'&&carrier.team===0&&carrier.id===m.selected,trigger=pressTrigger(m,carrier);
  const gx=ownGoal.x-carrier.x,gz=ownGoal.z-carrier.z,gl=Math.hypot(gx,gz)||1;
  if(trigger&&!human){const close=gap<4;return {x:close?b.x+carrier.vx*.08:carrier.x+gx/gl*1.7+carrier.vx*.15,z:close?b.z+carrier.vz*.08:carrier.z+gz/gl*1.7+carrier.vz*.15,speed:8.4};}
  // Contain: stay goal-side between the ball and goal; tight only when triggered.
  const standOff=trigger?(human&&!pressTrigger(m,carrier,{block:false})?2.6:1.9):gap<6?3.4:5.5;
  return {x:carrier.x+gx/gl*standOff+carrier.vx*.12,z:carrier.z+gz/gl*standOff+carrier.vz*.12,speed:trigger?Math.min(7.4,carry+1.6):gap<6?Math.min(6.4,carry+.6):6};
}

function coverPress(m,p,carrier,primary){
  // Second defender covers the inside lane behind the presser, only once the press is on.
  const s=m.attackSign(p.team),side=primary&&primary.z>=carrier.z?-1:1;
  return {x:clamp(carrier.x-s*4.5,-48,48),z:clamp(carrier.z+side*3.6,-29,29),speed:7.2};
}

function attackShape(m,p,ball,carrier){
  const {s}=frame(m,p.team),base=m.basePosition(p),bu=ball.x*s,bw=ball.z*s,side=Math.sign(base[1])||(p.index%2?1:-1);
  const off=offsideU(m,p.team,s,bu),ballSide=Math.abs(bw)<5||Math.sign(bw)===side;
  const oppMid=m.players.filter(o=>o.team!==p.team&&!o.sentOff&&o.index>4).map(o=>o.x*s);
  const oppMidU=oppMid.length?oppMid.reduce((a,c)=>a+c,0)/oppMid.length:bu;
  const back=clamp(bu-24,-40,12),wideFinal=bu>28&&Math.abs(bw)>14,ballSign=Math.sign(bw)||1;
  const sts=m.players.filter(q=>q.team===p.team&&q.role==='ST'&&!q.sentOff).sort((a,c)=>a.index-c.index);
  let u,w;
  switch(p.role){
    case 'CB':u=back;w=side*clamp(Math.abs(base[1])*1.3,8,14)+bw*.12;break;
    case 'LB':case 'RB':
      if(carrier&&WIDE.includes(carrier.role)&&Math.sign(carrier.z*s)===side&&bu>0){u=carrier.x*s+8;w=carrier.z*s-side*3;}
      else if(bu>-5){u=ballSide?bu-6:bu-14;w=side*(ballSide?26:21);}else{u=back+6;w=side*24;}break;
    case 'DM':u=clamp(bu-13,-35,25);w=bw*.3;break;
    case 'CM':if(ballSide){u=bu-7;w=clamp(bw+side*13,-24,24);}else{u=bu+9;w=clamp(bw*.3+side*13,-22,22);}break;
    case 'AM':u=clamp(oppMidU+4,bu-2,off-6);w=bw*.5;break;
    case 'LM':case 'RM':case 'LW':case 'RW':
      if(!ballSide&&bu>25){u=42;w=side*10;}else{u=Math.min(bu+(ballSide?4:0),off-1.5);w=side*(ballSide?26:22);}break;
    case 'ST':{
      const second=sts.length>1&&sts[1].id===p.id;
      if(second){u=Math.min(off-1,bu+10)-(bu<20?8:0);w=clamp(-ballSign*11+bw*.2,-18,18);}
      else{u=off-1;w=clamp(ballSign*5+bw*.25,-16,16);}break;}
    default:u=base[0]+bu*.5;w=base[1];
  }
  // Ball wide in the final third: occupy near post, far post, the edge of the box and the back post.
  if(wideFinal){
    if(p.role==='ST'){const second=sts.length>1&&sts[1].id===p.id;u=second?44.5:46;w=second?-ballSign*4:ballSign*3;}
    else if(WIDE.includes(p.role)&&!ballSide){u=42;w=-ballSign*11;}
    else if(p.role==='AM'||p.role==='CM'&&!ballSide){u=34;w=0;}
  }
  u=Math.min(u,off-.6);
  let t=toWorld(s,clamp(u,-46,48),clamp(w,-29,29));
  // Step out of a blocked passing lane.
  if(carrier&&p.index>4&&m.laneClearance(carrier,t,p.team)<2.2&&dist(p,t)>3){
    const options=[-4,4].map(o=>({x:t.x,z:clamp(t.z+o,-29,29)})).sort((a,c)=>m.laneClearance(carrier,c,p.team)-m.laneClearance(carrier,a,p.team));t=options[0];
  }
  return {...t,speed:paceTo(p,t)};
}

// Forwards make their own timed runs in behind when the carrier has time and is facing forward.
export function updateAutoRuns(m,carrier){
  if(!carrier||m.mode!=='player'&&m.mode!=='manager')return;
  const team=carrier.team,s=m.attackSign(team);m.autoRunAt??=[0,0];
  if(m.time<m.autoRunAt[team]||carrier.x*s<-15)return;
  const facing=Math.sin(carrier.heading)*s,pressure=Math.min(...m.players.filter(o=>o.team!==team&&!o.sentOff).map(o=>dist(o,carrier)));
  if(facing<.3||pressure<4.5)return;
  if(team===0&&m.players.some(q=>q.team===0&&(q.calledUntil??0)>m.time))return;
  const off=offsideU(m,team,s,m.ball.x*s);
  const candidates=m.players.filter(r=>r.team===team&&!r.sentOff&&r.id!==carrier.id&&(['ST','LW','RW','AM'].includes(r.role)||hasTrait(r,'lineBreaker'))&&!(r.runUntil>m.time)&&r.x*s<=off+.1&&off-r.x*s<6);
  let best=null,space=-Infinity;
  for(const r of candidates){const target={x:s*clamp(off+9,0,47),z:clamp(r.z,-24,24)};const free=Math.min(...m.players.filter(o=>o.team!==team&&!o.sentOff&&o.index>0).map(o=>dist(o,target)));const rank=free+(hasTrait(r,'lineBreaker')?3:0);if(rank>space){space=rank;best={r,target};}}
  const human=m.mode==='player'&&team===0;
  // 라인 브레이커 keeps looking for the next run sooner.
  m.autoRunAt[team]=m.time+((human?5:3.2)+((m.random??Math.random)())*2)*(best&&hasTrait(best.r,'lineBreaker')?.55:1);
  if(!best||space<4)return;
  best.r.runTarget=best.target;best.r.runUntil=m.time+2.2;
}

// Keep team-mates apart: a target closer than MIN_GAP to another team-mate's target is pushed away from it.
const MIN_GAP=9;
function spread(m,p,t){
  let {x,z}=t;
  for(const q of m.players){
    if(q.team!==p.team||q.id===p.id||q.sentOff||q.index===0)continue;
    const o=q.shapeTarget&&m.controlTime-q.shapeTarget.at<.5?q.shapeTarget:q,dx=x-o.x,dz=z-o.z,d=Math.hypot(dx,dz);
    if(d<MIN_GAP){const push=(MIN_GAP-d)*.5,nx=d>.05?dx/d:(p.id<q.id?1:-1)*.3,nz=d>.05?dz/d:(p.id<q.id?1:-1);x+=nx*push;z+=nz*push;}
  }
  x=clamp(x,-50,50);z=clamp(z,-31,31);p.shapeTarget={x,z,at:m.controlTime};return {...t,x,z};
}

// Returns a target for players the shape system owns, or null to defer to the specialised logic.
export function teamShapeTarget(m,p,carrier,primary){
  if(p.index===0||p.sentOff)return null;
  if(m.crossUntil>m.time&&m.crossTeam===p.team&&['ST','AM','LW','RW'].includes(p.role))return null;
  if((p.calledUntil??0)>m.time)return null;
  if(carrier){
    if(carrier.team===p.team){
      if(p.runUntil>m.time&&p.runTarget)return {x:p.runTarget.x,z:p.runTarget.z,speed:8.8};
      return spread(m,p,attackShape(m,p,m.ball,carrier));
    }
    if(primary?.id===p.id)return primaryPress(m,p,carrier);
    const state=m.teamAI?.[p.team];
    // Q (수비 도움 요청): the human's second defender goes straight at the ball for a moment.
    if(p.team===0&&m.helpPressUntil>m.time&&state?.secondary===p.id)return {x:m.ball.x,z:m.ball.z,speed:8.4};
    if(state?.secondary===p.id&&pressTrigger(m,carrier,{block:false})&&dist(p,carrier)<10)return coverPress(m,p,carrier,primary);
    return spread(m,p,defendBlock(m,p,m.ball,carrier));
  }
  // Ball loose or travelling: chasers and the receiver are handled elsewhere; everyone else keeps shape
  // around where the ball is going.
  if(p.id===m.receiver||primary?.id===p.id||m.teamAI?.[p.team]?.secondary===p.id)return null;
  if(m.lastTouch<0)return null;
  const toward=m.receiveTarget&&m.receiver>=0?m.receiveTarget:{x:m.ball.x+m.ball.vx*.5,z:m.ball.z+m.ball.vz*.5};
  const own=m.players[m.lastTouch].team===p.team;
  if(own&&p.runUntil>m.time&&p.runTarget)return null;
  return spread(m,p,own?attackShape(m,p,toward,null):defendBlock(m,p,toward,null));
}
