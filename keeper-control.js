import {FIELD_SCALE,FIELD_GRAVITY} from './visual-scale.js?v=20261114-replay';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const isHumanKeeper=(m,p)=>m.mode==='player'&&p?.team===0&&p.index===0&&m.selected===p.id&&m.owner===p.id;
export function startKeeperRelease(m,p,kind,power=.4,aim=m.input){
 if(m.owner!==p.id||!p.holdingBall||p.distribution||m.paused||m.restart)return false;
 const s=m.attackSign(p.team),len=Math.hypot(aim.x,aim.z),direction=len>.15?{x:aim.x/len,z:aim.z/len}:{x:s,z:0};
 const options=m.players.filter(q=>q.team===p.team&&q.index>0&&!q.sentOff&&dist(q,p)>4&&dist(q,p)<65);
 const wanted=kind==='throw'?9+power*24:23+power*35;
 options.sort((a,b)=>{const score=q=>((q.x-p.x)*direction.x+(q.z-p.z)*direction.z)/(dist(q,p)||1)*18+m.laneClearance(p,q,p.team)*.5-Math.abs(dist(q,p)-wanted)*.4;return score(b)-score(a);});
 const target=options.find(q=>((q.x-p.x)*direction.x+(q.z-p.z)*direction.z)>0),point=target?{x:clamp(target.x+target.vx*.25,-49,49),z:clamp(target.z+target.vz*.25,-30,30)}:{x:clamp(p.x+direction.x*wanted,-49,49),z:clamp(p.z+direction.z*wanted,-30,30)};
 p.heading=Math.atan2(point.x-p.x,point.z-p.z);p.keeperAction=null;p.recover=0;p.kickAnim=0;p.distribution={kind,power,elapsed:0,duration:kind==='drop'?.32:kind==='throw'?.72:.95,releaseAt:kind==='drop'?.18:kind==='throw'?.4:.55,target:target?.id??-1,point,released:false};m.charge=m.pending=null;return true;
}
export function stepKeeperRelease(m,p,dt){
 const a=p.distribution;if(!a)return false;a.elapsed+=dt;p.vx=p.vz=0;
 if(!a.released&&a.elapsed>=a.releaseAt){
  a.released=true;p.holdingBall=false;p.keeperReleased=true;m.directRestart=null;
  if(a.kind==='drop'){m.owner=p.id;Object.assign(m.ball,{x:p.x+Math.sin(p.heading)*.65,z:p.z+Math.cos(p.heading)*.65,y:.34,vx:0,vz:0,vy:0,shotFlight:null});}
  else{const startY=a.kind==='throw'?1.6:.85,d=dist(p,a.point),flight=clamp(d/(a.kind==='throw'?22:30),a.kind==='throw'?.65:1,a.kind==='throw'?1.45:2),drag=.12,travel=(1-Math.exp(-drag*flight))/drag;
   m.offsideSnapshot(p.team,p.id);m.offsideExempt=false;m.owner=-1;m.lastTouch=p.id;m.lastKick={type:a.kind==='throw'?'loft':'clearance',team:p.team,isShot:false,distribution:a.kind};m.noCatch=.45;m.receiver=a.target;m.receiveTarget={...a.point};m.receiveAssist=flight+1.2;m.receiverInputRevision=m.inputRevision;
   Object.assign(m.ball,{x:p.x+Math.sin(p.heading)*.35,z:p.z+Math.cos(p.heading)*.35,y:startY,vx:(a.point.x-p.x)/travel,vz:(a.point.z-p.z)/travel,vy:(.6-startY+(4.905*FIELD_GRAVITY)*flight*flight)/flight,shotFlight:null,flightDrag:null,curlX:0,curlZ:0,curveRemaining:0});
   m.stats.passes[p.team]++;m.recordEvent(a.kind==='throw'?'keeperThrow':'keeperVolley',p.team,p.id);if(p.team===0&&m.mode==='player'&&a.target>=0)m.selected=a.target;
  }
 }
 if(a.elapsed>=a.duration)p.distribution=null;return true;
}
export function distributionPose(a){
 const u=Math.min(1,a.elapsed/a.duration),release=a.releaseAt/a.duration,wind=Math.min(1,u/release),follow=Math.max(0,1-(u-release)/(1-release));
 if(a.kind==='drop')return {armX:[-.8*(1-u),-.8*(1-u)],armZ:[.15,-.15],elbows:[-.5,-.5],legX:[0,0],knees:[.1,.1],lean:.08};
 if(a.kind==='throw')return {armX:[u<release?wind*1.6:-2.1*follow,-.65],armZ:[-.25,-.2],elbows:[-.25,-.8],legX:[-.18,.12],knees:[.15,.1],lean:(u<release?-.12:.18)*follow};
 const swing=u<release?.65*wind:-1.2*follow;return {armX:[-.5,.4],armZ:[.9,-.7],elbows:[-.4,-.7],legX:[swing,.12],knees:[u<release?.6:.12,.16],lean:.14*follow};
}
