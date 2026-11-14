import {FIELD_SCALE,FIELD_GRAVITY} from './visual-scale.js?v=20261114-corner3';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function shotOffset(flight,elapsed){
  if(!flight)return {x:0,z:0,y:0,vx:0,vz:0,vy:0};
  const u=clamp(elapsed/flight.duration,0,1),w=Math.sin(Math.PI*u)**2,dw=Math.PI*Math.sin(2*Math.PI*u),a=flight.amplitude;
  let lateral=0,dl=0,vertical=0,dv=0;
  if(flight.type==='curl'){lateral=a*w;dl=a*dw;}
  if(flight.type==='knuckle'){lateral=a*w*Math.sin(4*Math.PI*u);dl=a*(dw*Math.sin(4*Math.PI*u)+w*4*Math.PI*Math.cos(4*Math.PI*u));}
  if(flight.type==='dip'||flight.type==='chip'){vertical=a*w;dv=a*dw;}
  if(flight.type==='power'){lateral=a*w*Math.sin(2*Math.PI*u);dl=a*(dw*Math.sin(2*Math.PI*u)+w*2*Math.PI*Math.cos(2*Math.PI*u));}
  if(elapsed>=flight.duration)dl=dv=0;
  return {x:lateral*flight.nx,z:lateral*flight.nz,y:vertical,vx:dl*flight.nx/flight.duration,vz:dl*flight.nz/flight.duration,vy:dv/flight.duration};
}
export function flightStep(ball,dt){
  const f=ball.shotFlight,old=shotOffset(f,f?.elapsed??0);
  let vx=ball.vx-old.vx,vz=ball.vz-old.vz,vy=ball.vy-old.vy;
  const air=ball.y>.38||ball.vy>0,drag=air?.12:(ball.flightDrag??.62),decay=Math.exp(-drag*dt),travel=(1-decay)/drag,offset=(dt-travel)/drag,cx=ball.curveRemaining>0?(ball.curlX??0):0,cz=ball.curveRemaining>0?(ball.curlZ??0):0;
  ball.x+=vx*travel+cx*offset;ball.z+=vz*travel+cz*offset;ball.y+=vy*dt-(4.905*FIELD_GRAVITY)*dt*dt;
  vx=vx*decay+cx*travel;vz=vz*decay+cz*travel;vy-=(9.81*FIELD_GRAVITY)*dt;
  if(f){f.elapsed+=dt;const next=shotOffset(f,f.elapsed);ball.x+=next.x-old.x;ball.z+=next.z-old.z;ball.y+=next.y-old.y;vx+=next.vx;vz+=next.vz;vy+=next.vy;}
  Object.assign(ball,{vx,vz,vy});ball.curveRemaining=Math.max(0,(ball.curveRemaining??0)-dt);
  if(ball.y<.34){ball.y=.34;ball.vy=vy<-1.2?-vy*.32:0;ball.shotFlight=null;}
  return ball;
}
export function forecastBall(ball,t){
  const f=ball.shotFlight,old=shotOffset(f,f?.elapsed??0),next=shotOffset(f,(f?.elapsed??0)+t),drag=ball.y>.38||ball.vy>0?.12:(ball.flightDrag??.62),travel=(1-Math.exp(-drag*t))/drag,offset=(t-travel)/drag;
  return {x:ball.x+(ball.vx-old.vx)*travel+(ball.curveRemaining>0?(ball.curlX??0)*offset:0)+next.x-old.x,z:ball.z+(ball.vz-old.vz)*travel+(ball.curveRemaining>0?(ball.curlZ??0)*offset:0)+next.z-old.z,y:Math.max(.34,ball.y+(ball.vy-old.vy)*t-(4.905*FIELD_GRAVITY)*t*t+next.y-old.y)};
}
export function planShot(start,end,{power=.5,human=false,side=1,style='auto',boost=1}={}){
  const dx=end.x-start.x,dz=end.z-start.z,d=Math.hypot(dx,dz),type=style==='finesse'||style==='rabona'?'curl':style==='power'?'power':style==='chip'?'chip':style==='low'?'driven':d>22?(power<.5?'curl':power>.78?'knuckle':'dip'):power>.82?'power':'driven';
  // Human shots follow the charge bar closely: a tap is a soft side-foot, a full bar is a rocket.
  const base=human?(style==='rabona'?18+power*14:type==='power'?28+power*22:type==='chip'?15+power*12:style==='finesse'?19+power*16:19+power*23+(d>23?2:0)):(style==='rabona'?26+power*6:type==='power'?39+power*11:type==='chip'?20+power*7:style==='finesse'?28+power*7:31+power*10+(d>23?3:0));
  const speed=Math.max(base*boost,.12*d+4),duration=-Math.log(Math.max(.05,1-.12*d/speed))/.12,travel=(1-Math.exp(-.12*duration))/.12;
  const height=style==='low'?.42:style==='rabona'?1.3:type==='chip'?1.55:type==='power'?1.25+power*.65:style==='finesse'?1.5:d>22?(human?1.35:1.05):human?1.05+power*.7:.8+power*.5;
  const amplitude=type==='curl'?Math.min(style==='finesse'?2.7:style==='rabona'?2.2:1.8,d*(style==='finesse'||style==='rabona'?.065:.045)):type==='knuckle'?.32:type==='power'?.18:type==='chip'?Math.min(3.2,1.7+d*.035):type==='dip'?.55:0;
  return {vx:dx/travel,vz:dz/travel,vy:(height-start.y+(4.905*FIELD_GRAVITY)*duration**2)/duration,shotFlight:{type,duration,elapsed:0,nx:-dz/(d||1)*(style==='rabona'?-side:side),nz:dx/(d||1)*(style==='rabona'?-side:side),amplitude}};
}
