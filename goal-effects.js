import {FIELD_SCALE,FIELD_GRAVITY} from './visual-scale.js?v=20261114-fix3';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function stepGoalBall(match,dt){
  const n=match.goalNet;if(!n)return;const b=match.ball;n.elapsed+=dt;
  b.x+=b.vx*dt;b.z+=b.vz*dt;b.y+=b.vy*dt-(4.905*FIELD_GRAVITY)*dt*dt;b.vy-=(9.81*FIELD_GRAVITY)*dt;
  if(b.x*n.side>54.65){b.x=n.side*54.65;b.vx=-n.side*Math.abs(b.vx)*.22;n.hitAt=n.elapsed;n.impact={y:clamp(b.y,.34,2.3),z:clamp(b.z,-3.5,3.5)};}
  if(b.x*n.side<52.9){b.x=n.side*52.9;b.vx=n.side*Math.abs(b.vx)*.2;}
  if(Math.abs(b.z)>3.45){b.z=Math.sign(b.z)*3.45;b.vz*=-.3;n.hitAt=n.elapsed;n.impact={y:clamp(b.y,.34,2.3),z:b.z};}
  if(b.y>2.35){b.y=2.35;b.vy=-Math.abs(b.vy)*.25;}
  if(b.y<.34){b.y=.34;b.vy=b.vy<-1?-b.vy*.26:0;}
  const drag=Math.exp(-(b.y<.36?2.8:.8)*dt);b.vx*=drag;b.vz*=drag;
}
export function netOffset(x,y,z,side,state){
  if(!state||state.side!==side||state.hitAt===null)return 0;
  const t=state.elapsed-state.hitAt;if(t<0||t>3.5)return 0;
  const distance=Math.hypot((state.impact?.y??1)-y,(state.impact?.z??0)-z),anchor=Math.sin(Math.PI*clamp(y/2.5,0,1))*.75+.25;
  return side*Math.max(0,Math.abs(x)/2)*anchor*Math.exp(-distance*.4)*Math.exp(-t*1.8)*Math.sin(t*19-distance*2.3)*.58*state.strength;
}
