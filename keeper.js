import {distributionPose} from './keeper-control.js?v=20261112-20-release';
import {forecastBall} from './ball-flight.js?v=20261113-fc2';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const length=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const predictBall=forecastBall;
export function predictPlane(ball,x){
  const dx=x-ball.x;if(!ball.vx||dx/ball.vx<0)return null;
  const drag=ball.y>.38||ball.vy>0?.12:(ball.flightDrag??.62),v=1-drag*dx/ball.vx;
  if(v<=0)return null;let t=-Math.log(v)/drag;if(t>2)return null;
  if(ball.shotFlight){for(let i=0;i<3;i++){const hit=predictBall(ball,t);t=clamp(t+(x-hit.x)/ball.vx,0,2);}}
  return {...predictBall(ball,t),t};
}
export function chooseKeeperAction(p,ball,{incoming=true,cross=false,pressure=20}={}){
  let hit=predictPlane(ball,p.x);
  if(cross){
    for(let t=.18;t<1.05;t+=.06){const point=predictBall(ball,t);if(point.y>1.35&&point.y<3.2&&Math.abs(point.x)>36&&length(p,point)<6.6*t+1.1){hit={...point,t};break;}}
  }
  // A near-post shot can already be goal-side of the keeper's standing plane.
  if((!hit||Math.abs(hit.z)>(cross?16:6)||hit.y>3.35)&&incoming){for(let t=.025;t<=.45;t+=.025){const point=predictBall(ball,t);if(Math.abs(point.x)>52.85)break;if(point.y<3.3&&length(p,point)<1.35+5.5*t){hit={...point,t};break;}}}
  if(!hit||hit.t>(cross?1.05:.65)||!incoming)return null;
  if(Math.abs(hit.z)>(cross?16:6)||hit.y>3.35)return null;
  const lateral=hit.z-p.z,speed=Math.hypot(ball.vx,ball.vz),side=lateral>=0?1:-1;
  let kind;
  if(cross&&hit.y>1.35)kind=pressure<4||speed>27?'punch':'aerialCatch';
  else if(hit.y>1.25&&Math.abs(lateral)>1.05)kind=Math.abs(lateral)>2.75?'fingertip':'highDive';
  else if(hit.t<.18)kind=hit.y<.85&&Math.abs(lateral)>.6?'footSave':'reflex';
  else if(Math.abs(lateral)<.9&&hit.y<.8)kind=speed<27?'lowCatch':'reflex';
  else if(Math.abs(lateral)<1.15&&hit.y<2.1)kind=speed<29?'chestCatch':'punch';
  else if(Math.abs(lateral)>2.75&&hit.y>1.2)kind='fingertip';
  else kind=hit.y>1.15?'highDive':'lowDive';
  const baseDuration={lowCatch:.62,chestCatch:.68,reflex:.52,footSave:.66,lowDive:.95,highDive:1.12,fingertip:1.16,aerialCatch:1.08,punch:.95}[kind],duration=Math.max(baseDuration,hit.t+.38);
  return {kind,duration,elapsed:0,side,target:hit,origin:{x:p.x,z:p.z},contacted:false,catchable:['lowCatch','chestCatch','aerialCatch'].includes(kind)&&speed<29&&pressure>3.4,contactAt:hit.t,launchAt:Math.max(0,hit.t-(['lowDive','highDive','fingertip'].includes(kind)?.3:.2))};
}
export function keeperPose(p){
  const a=p.keeperAction;
  const neutral={rootY:.12,leanX:0,leanZ:0,armX:[-.35,-.35],armZ:[.28,-.28],elbowX:[-.45,-.45],legX:[-.1,-.1],legZ:[0,0]};
  if(p.distribution){const d=distributionPose(p.distribution);return {...neutral,armX:d.armX,armZ:d.armZ,elbowX:d.elbows,legX:d.legX,leanX:Math.cos(p.heading)*d.lean,leanZ:-Math.sin(p.heading)*d.lean};}
  if(!a)return p.holdingBall?{...neutral,armX:[-1,-1],elbowX:[-1.1,-1.1]}:neutral;
  const t=clamp(a.elapsed/a.duration,0,1),launch=a.launchAt??Math.max(0,a.contactAt-.3),progress=clamp((a.elapsed-launch)/Math.max(.09,a.contactAt-launch),0,1),reach=progress*progress*(3-2*progress),recovery=t>.7?clamp((1-t)/.3,0,1):1,r=reach*recovery;
  const jump=Math.sin(Math.PI*clamp((a.elapsed-launch)/Math.max(.25,Math.min(a.duration-launch,(a.contactAt-launch)*2)),0,1)),side=a.side;
  const pose={...neutral,armX:[-.2*r,-.2*r],armZ:[2.65*r,-2.65*r],legX:[-.15*r,.15*r]};
  switch(a.kind){
    case 'lowCatch':pose.rootY-=.37*r;pose.legX=[.95*r,.95*r];pose.armX=[-.05*r,-.05*r];pose.armZ=[.45*r,-.45*r];pose.leanZ=-Math.sin(p.heading)*.25*r;break;
    case 'chestCatch':pose.armX=[-1.7*r,-1.7*r];pose.armZ=[.2*r,-.2*r];break;
    case 'lowDive':pose.leanX=side*1.4*r;pose.rootY+=.24*jump;break;
    case 'highDive':pose.leanX=side*(a.target.y>1.8?.95:1.15)*r;pose.rootY+=.92*jump;break;
    case 'fingertip':pose.leanX=side*.96*r;pose.rootY+=1.08*jump;pose.armZ=side>0?[2.95*r,-2.7*r]:[2.7*r,-2.95*r];break;
    case 'reflex':pose.armX=[-1.8*r,-1.8*r];pose.armZ=[1.2*r,-1.2*r];pose.leanX=side*.24*r;pose.legZ=[-.3*r,.3*r];pose.rootY+=.08*jump;if(a.target.y<.9){pose.rootY-=.26*r;pose.armX=[-.3*r,-.3*r];}break;
    case 'footSave':{const localSide=-side*Math.sign(Math.sin(p.heading)||1);pose.leanX=-side*.4*r;pose.armZ=[1.15*r,-1.15*r];pose.legX=localSide>0?[.1,-.3*r]:[-.3*r,.1];pose.legZ=localSide>0?[0,.9*r]:[-.9*r,0];break;}
    case 'aerialCatch':pose.rootY+=clamp(a.target.y-2.1*(p.profile?.height??180)/180,.1,.85)*jump;pose.armZ=[2.8*r,-2.8*r];break;
    case 'punch':pose.rootY+=.55*jump;pose.armX=[-.5*r,-.5*r];pose.armZ=[2.85*r,-2.85*r];pose.leanX=side*.28*r;break;
  }
  if(['lowDive','highDive','fingertip'].includes(a.kind)){
    const low=a.kind==='lowDive',flightDuration=Math.max(.16,a.contactAt-launch)+(low?.08:.25),air=clamp((a.elapsed-launch)/flightDuration,0,1),lift=Math.sin(Math.PI*air),localSide=-side*Math.sign(Math.sin(p.heading)||1),amplitude=low?.68:.92+Math.max(0,a.target.y-1.8)*.5;
    pose.rootY=.12+lift*amplitude-.6*r;pose.legX=[.42*r,-.22*r];pose.kneeX=[.85*lift,.45*lift];
    pose.armZ=low?(localSide>0?[-2.42*r,2.8*r]:[-2.8*r,2.42*r]):(localSide>0?[-1.5*r,3*r]:[-3*r,1.5*r]);
    if(a.elapsed>a.contactAt+.15){const plant=clamp((a.elapsed-a.contactAt-.15)/.2,0,1);pose.armX=pose.armX.map(v=>v*(1-plant));}
  }
  pose.elbowX=pose.armZ.map(z=>Math.abs(z)>2.5?-.12:-.8);
  return pose;
}
function rotateY(v,a){return {x:v.x*Math.cos(a)+v.z*Math.sin(a),y:v.y,z:-v.x*Math.sin(a)+v.z*Math.cos(a)};}
function rotateX(v,a){return {x:v.x,y:v.y*Math.cos(a)-v.z*Math.sin(a),z:v.y*Math.sin(a)+v.z*Math.cos(a)};}
function rotateZ(v,a){return {x:v.x*Math.cos(a)-v.y*Math.sin(a),y:v.x*Math.sin(a)+v.y*Math.cos(a),z:v.z};}
export function keeperContacts(p){
  const pose=keeperPose(p),height=(p.profile?.height??180)/180,width=clamp(Math.sqrt((p.profile?.weight??77)/((p.profile?.height??180)/100)**2/24),.8,1.3);
  const world=v=>{v=rotateY({x:v.x*width,y:v.y*height,z:v.z*width},p.heading);v.y-=.9*height;v=rotateX(v,pose.leanX);v=rotateZ(v,pose.leanZ);return {x:p.x+v.x,y:pose.rootY+v.y+.9*height,z:p.z+v.z};};
  const hands=[-1,1].map((side,i)=>{const upper=rotateX(rotateZ({x:0,y:-.32,z:0},pose.armZ[i]),pose.armX[i]),lower=rotateX(rotateZ(rotateX({x:0,y:-.29,z:0},pose.elbowX?.[i]??-.28),pose.armZ[i]),pose.armX[i]);return world({x:side*.2+upper.x+lower.x,y:1.53+upper.y+lower.y,z:upper.z+lower.z});});
  const footSide=-(p.keeperAction?.side??1)*Math.sign(Math.sin(p.heading)||1),leg=pose.legX[footSide>0?1:0],toe=rotateX(rotateZ({x:0,y:-.8,z:.12},pose.legZ[footSide>0?1:0]),leg);
  const foot=world({x:footSide*.22+toe.x,y:.9+toe.y,z:toe.z});
  return {hands,body:world({x:0,y:1.15,z:0}),foot,pose};
}
export function updateKeeper(match,p,dt){
  if(p.keeperAction){
    const a=p.keeperAction;a.elapsed+=dt;
    if(a.elapsed>=a.duration){p.keeperAction=null;p.dive=0;p.recover=.14;p.decision=Math.min(p.decision,.06);return;}
    if(!a.contacted){
      const mobile=['lowDive','highDive','fingertip','aerialCatch','punch'].includes(a.kind);
      if(mobile&&a.elapsed>(a.launchAt??0)){const extension=['lowDive','highDive','fingertip'].includes(a.kind)?Math.min(1.55,Math.abs(a.target.z-a.origin.z)*.65):0;const dx=a.target.x-p.x,dz=a.target.z-a.side*extension-p.z,d=Math.hypot(dx,dz),ramp=clamp((a.elapsed-(a.launchAt??0))/.1,0,1),speed=Math.min(a.kind==='fingertip'?8.8:7.2,d/Math.max(.12,a.contactAt-a.elapsed))*ramp*ramp*(3-2*ramp);p.x+=dx/(d||1)*speed*dt;p.z+=dz/(d||1)*speed*dt;a.vx=dx/(d||1)*speed;a.vz=dz/(d||1)*speed;}
    }
    if(a.contacted&&a.elapsed<a.contactAt+.2){const glide=Math.max(0,1-(a.elapsed-a.contactAt)/.2);p.x=clamp(p.x+(a.vx??0)*dt*glide,-52.3,52.3);p.z=clamp(p.z+(a.vz??0)*dt*glide,-22,22);}
    p.dive=['lowDive','highDive','fingertip'].includes(a.kind)?Math.max(.001,.72*(1-a.elapsed/a.duration)):0;p.vx=p.vz=0;return;
  }
  p.recover=Math.max(0,(p.recover??0)-dt);
  if(match.owner>=0||p.reaction>0||p.decision>0||p.recover>0)return;
  const b=match.ball,s=match.attackSign(p.team),from=match.lastTouch>=0?match.players[match.lastTouch]:null;
  if(from?.team===p.team&&['pass','through','cross','loft','clearance'].includes(match.lastKick?.type))return;
  const cross=match.lastKick?.type==='cross'||!match.lastKick?.isShot&&b.y>2.2;
  if(['pass','through','clearance'].includes(match.lastKick?.type)&&b.y<1.3)return;
  let incoming=b.vx*s<-.5;
  // A cross may travel across the six-yard area with little forward velocity.
  const candidateBall=b;
  if(cross&&!incoming&&Math.abs(b.x)>40&&length(p,b)<11){const future=predictBall(b,.4);if(length(p,future)<5)incoming=true;}
  const pressure=Math.min(...match.players.filter(o=>o.team!==p.team&&!o.sentOff).map(o=>length(o,p)));
  const action=chooseKeeperAction(p,candidateBall,{incoming,cross,pressure});
  if(action){p.keeperAction=action;p.heading=Math.atan2(b.x-p.x,b.z-p.z);p.diveSide=action.side;p.diveHeight=clamp(action.target.y,.35,2.4);p.decision=action.duration+.16;}
}
export function sweepDistance3(point,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,t=clamp(((point.x-a.x)*dx+(point.y-a.y)*dy+(point.z-a.z)*dz)/(dx*dx+dy*dy+dz*dz||1),0,1);
  return Math.hypot(point.x-a.x-dx*t,point.y-a.y-dy*t,point.z-a.z-dz*t);
}
export function tryKeeperSave(match,p,before){
  const b=match.ball,s=match.attackSign(p.team),from=match.lastTouch>=0?match.players[match.lastTouch]:null;
  if(match.owner>=0||Math.abs(p.x)<35||from?.team===p.team&&match.lastKick?.type==='pass')return false;
  if(b.vx*s>=(match.lastKick?.isShot?-.25:-1)&&match.lastKick?.type!=='cross')return false;
  if(p.keeperAction?.contacted)return false;
  if(!p.keeperAction){
    const action=chooseKeeperAction(p,{...b,...before},{incoming:true,cross:match.lastKick?.type==='cross',pressure:20});
    if(!action||action.contactAt>.08)return false;if(p.reaction>0){action.kind='reflex';action.catchable=false;}p.keeperAction=action;p.heading=Math.atan2(b.x-p.x,b.z-p.z);
  }
  const a=p.keeperAction,c=keeperContacts(p),bodyScale=(p.profile?.height??180)/180;
  const handDistance=Math.min(...c.hands.map(h=>sweepDistance3(h,before,b))),bodyDistance=sweepDistance3(c.body,before,b),footDistance=sweepDistance3(c.foot,before,b);
  const reach=.34+.23*bodyScale;
  // Gloves, torso or an extended foot must physically meet the swept ball.
  const lowBody={x:p.x,y:.55*bodyScale,z:p.z},lowDistance=sweepDistance3(lowBody,before,b);
  if(!(handDistance<reach||bodyDistance<.77*bodyScale||['footSave','reflex','lowCatch'].includes(a.kind)&&(footDistance<.8||lowDistance<.68*bodyScale)))return false;
  a.contacted=true;b.curveRemaining=0;b.shotFlight=null;b.flightDrag=null;match.stats.saves[p.team]++;match.recordEvent?.('save',p.team,p.id,{action:a.kind});match.lastTouch=p.id;
  if(a.catchable&&handDistance<.9&&Math.hypot(b.vx,b.vz)<29){
    match.owner=p.id;match.possessionTime=0;match.receiver=-1;p.holdingBall=true;p.heldOffset={x:b.x-p.x,y:b.y,z:b.z-p.z};b.vx=b.vz=b.vy=0;
  }else{
    const outward=s*Math.max(9,Math.abs(b.vx)*.4),side=a.side;
    b.vx=outward;b.vz=side*Math.max(a.kind==='fingertip'?11:7,Math.abs(b.vz)*.6);b.vy=a.kind==='punch'?4.5:2.1;
    match.noCatch=.22;match.receiver=-1;
    if(['fingertip','highDive','reflex'].includes(a.kind))match.highlight={kind:'save',remaining:.55};
  }
  return true;
}
