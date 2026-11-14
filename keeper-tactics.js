import {keeperBias} from './opponent-adaptation.js?v=20261114-runs2';
import {forecastBall} from './ball-flight.js?v=20261114-runs2';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function keeperTarget(match,p,carrier){
  const s=match.attackSign(p.team),b=match.ball,bx=b.x*s,goal=-s*52.3,own=carrier?.team===p.team;
  const opponents=match.players.filter(q=>q.team!==p.team&&!q.sentOff&&q.index>0),defenders=match.players.filter(q=>q.team===p.team&&!q.sentOff&&q.index>0);
  const shot=match.owner<0&&match.lastKick?.isShot&&b.vx*s<-.5;
  const pressure=Math.min(50,...opponents.map(q=>distance(q,b)));
  const box=point=>point.x*s<-35.8&&point.x*s>-53&&Math.abs(point.z)<19.5;
  // Rush (W while defending): sprint at the ball or the carrier's next touch to smother the chance.
  if(p.rushUntil>match.controlTime&&!shot&&bx<-18){const aim=carrier?forecastBall(b,.18):forecastBall(b,.3);p.keeperIntent='rush';return {x:clamp(aim.x,-52,52),z:clamp(aim.z,-26,26),speed:8.6};}
  if(!carrier&&!shot&&bx<-22&&Math.abs(b.z)<26){
    for(let t=.12;t<=1.8;t+=.12){const point=forecastBall(b,t),arrival=distance(p,point)/8.2+.08,enemy=Math.min(50,...opponents.map(q=>distance(q,point)/8.3)),friend=Math.min(50,...defenders.map(q=>distance(q,point)/8.3));
      if(point.y<1.45&&point.x*s<-24&&Math.abs(point.z)<26&&arrival<t+.3&&(arrival+.1<enemy||distance(p,b)<3)&&(arrival<friend+.2||box(point))){
        p.keeperIntent=box(point)&&pressure>3?'collect':'clear';return {x:point.x,z:point.z,speed:8.2};
      }
    }
  }
  if(carrier&&carrier.team!==p.team&&bx<-38&&Math.abs(b.z)>8.5){const depth=clamp((52.3+bx)*.1,.55,1.35);p.keeperIntent='nearPost';return {x:goal+s*depth,z:Math.sign(b.z)*clamp(2.4+(Math.abs(b.z)-8.5)*.1,2.4,3.2),speed:7.2};}
  if(carrier&&carrier.team!==p.team&&bx<-34&&Math.abs(b.z)<21){
    const cover=Math.min(50,...defenders.map(q=>distance(q,carrier))),gap=distance(p,b),exposed=distance(carrier,b)>.8;
    if(cover>3.5&&gap<19){p.keeperIntent='closeDown';if(bx<-43||exposed){const target=forecastBall(b,.12);return {x:clamp(target.x,-51.5,51.5),z:clamp(target.z,-20,20),speed:7.6};}const advance=clamp((52.3+bx)*.43,3,7);return {x:goal+s*advance,z:clamp(b.z*advance/Math.max(3,52.3+bx),-4,4),speed:6.8};}
  }
  const depth=shot?1.45:own?clamp((bx+52)*.14,3,12):clamp((bx+52)*.12,1.5,5.5);
  let z=b.z*depth/Math.max(3,52.3+bx)+(shot?0:keeperBias(match,p.team));
  if(shot&&p.reaction<=0){const t=(p.x-b.x)/(b.vx||1);if(t>0&&t<.75)z=forecastBall(b,t).z;}
  p.keeperIntent=shot?'set':bx<-28?'guard':'support';return {x:goal+s*depth,z:clamp(z,-3.15,3.15),speed:shot?5.4:5.6};
}
export function keeperCanHandle(match,p){const b=match.ball,s=match.attackSign(p.team),ownPass=match.lastTouch>=0&&match.players[match.lastTouch].team===p.team&&['pass','through','cross','loft','clearance'].includes(match.lastKick?.type);return b.x*s<-36&&Math.abs(b.z)<20&&!ownPass&&!(p.keeperReleased&&match.lastTouch===p.id);}
