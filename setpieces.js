import {FIELD_SCALE,FIELD_GRAVITY} from './visual-scale.js?v=20261114-runlead3';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const DRAWABLE_RESTARTS=new Set(['freeKick','indirect','corner','goalKick']);
export function cleanKickPath(start,points){
  const out=[{x:start.x,z:start.z}];
  for(const p of points??[]){if(!Number.isFinite(p?.x)||!Number.isFinite(p?.z))continue;const q={x:clamp(p.x,-52.5,52.5),z:clamp(p.z,-33.5,33.5)};if(Math.hypot(q.x-out.at(-1).x,q.z-out.at(-1).z)>.35)out.push(q);}
  return out.slice(0,160);
}
export function planSetPiece(type,start,points,sign=1){
  const path=cleanKickPath(start,points);if(path.length<2)return null;
  const end={...path.at(-1)},dx=end.x-start.x,dz=end.z-start.z,d=Math.hypot(dx,dz);if(d<3||d>75)return null;
  const goal=['freeKick'].includes(type)&&end.x*sign>50&&Math.abs(end.z)<3.5;
  if(goal)end.x=sign*53.5;
  const distance=Math.hypot(end.x-start.x,end.z-start.z),flight=type==='corner'?clamp(distance/21,1.1,2):type==='goalKick'?clamp(distance/24,.6,2.7):goal?clamp(distance/30,.4,1.5):clamp(distance/23,.65,2);
  const height=type==='corner'?2.05:goal?1.05:distance<18?.45:1.25,drag=.12,travel=(1-Math.exp(-drag*flight))/drag;
  let bend=0;for(let i=1;i<path.length-1;i++){const p=path[i],side=((p.x-start.x)*(-dz)+(p.z-start.z)*dx)/(d||1);if(Math.abs(side)>Math.abs(bend))bend=side;}
  // Constant lateral acceleration produces a curved flight and still reaches the drawn endpoint.
  const curl=clamp(-bend*5/Math.max(.4,flight*flight),-7,7),curlX=-dz/(d||1)*curl,curlZ=dx/(d||1)*curl,offset=(flight-travel)/drag;
  return {path,end,flight,isShot:goal,type:goal?'shoot':type==='corner'?'cross':'loft',vx:(end.x-start.x-curlX*offset)/travel,vz:(end.z-start.z-curlZ*offset)/travel,vy:(height-.34+(4.905*FIELD_GRAVITY)*flight*flight)/flight,curlX,curlZ};
}
export function kickPreview(start,plan){
  if(!plan)return [];const out=[];for(let i=0;i<=40;i++){const t=plan.flight*i/40,drag=.12,travel=(1-Math.exp(-drag*t))/drag,offset=(t-travel)/drag;out.push({x:start.x+plan.vx*travel+plan.curlX*offset,z:start.z+plan.vz*travel+plan.curlZ*offset,y:Math.max(.34,.34+plan.vy*t-(4.905*FIELD_GRAVITY)*t*t)});}return out;
}
