const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function locomotionPose({stride=0,speed=0,sprint=false,kick=0,charge=0,trap=0,style='pass',turnRate=0}={}){
  const running=clamp(speed/8,0,1),amplitude=running*(sprint?.82:.67),phase=[stride,stride+Math.PI];
  const pose={hips:phase.map(t=>-Math.sin(t)*amplitude),knees:phase.map(t=>.06+Math.max(0,-Math.sin(t))*(sprint?1.15:.9)*running),arms:phase.map(t=>Math.sin(t)*amplitude*.72),elbows:phase.map(t=>-.3-Math.max(0,-Math.sin(t))*.5*running),lean:running*(sprint?.12:.055),roll:Math.sin(stride)*running*.025+clamp(turnRate*.025,-.09,.09),bob:Math.abs(Math.sin(stride))*running*.035,twist:Math.sin(stride)*running*.035};
  if(charge>0){pose.hips[0]=.26+charge*.24;pose.knees[0]=.45;pose.arms=[-.3,.5];pose.lean=-.035;}
  if(kick>0){const progress=clamp(1-kick/.28,0,1),swing=Math.sin(Math.PI*clamp(progress*1.4+.18,0,1)),power=style==='shoot'||style==='clearance'?1.15:.75;pose.hips[0]=-swing*power;pose.knees[0]=.1+Math.max(0,progress-.65)*1.1;pose.hips[1]=.08;pose.arms=[-.7*swing,.8*swing];pose.twist=-swing*.16;pose.lean=.1*swing;}
  if(trap>0&&!kick){pose.hips[0]-=Math.sin(clamp(trap/.18,0,1)*Math.PI)*.3;pose.knees[0]+=.25;}
  return pose;
}
export const dampJoint=(current,target,dt,rate=22)=>current+(target-current)*(1-Math.exp(-Math.max(0,dt)*rate));
