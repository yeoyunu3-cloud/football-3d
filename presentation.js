const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function officialStep(position,target,dt,speed=4.3){const dx=target.x-position.x,dz=target.z-position.z,d=Math.hypot(dx,dz),step=Math.min(d,Math.max(0,dt)*speed);return {x:position.x+dx/(d||1)*step,z:position.z+dz/(d||1)*step,distance:step};}
export function celebrationPose(kind,elapsed,stride=0){
  if(kind==='embrace')return {rootY:.12+Math.sin(elapsed*7)*.025,lean:.12,legX:[0,0],legZ:[0,0],armZ:[1.3,-1.3],armX:-.7,elbowX:-.65,yaw:0};
  if(elapsed<1.25){const swing=Math.sin(stride)*.7;return {rootY:.12+Math.abs(Math.sin(stride))*.07,lean:.1,legX:[swing,-swing],kneeX:.35,legZ:[0,0],armZ:[-.3,.3],armX:0,yaw:0};}
  if(kind==='slide'){const t=clamp((elapsed-1.25)/.28,0,1)*(1-clamp((elapsed-5.05)/.55,0,1));return {rootY:.12-t*.53,lean:-t*.4,legX:[-.3*t,-.3*t],kneeX:1.95*t,legZ:[0,0],armZ:[-1.9*t,1.9*t],armX:0,yaw:0};}
  const t=elapsed-1.25,w=Math.sin(t*6);
  if(kind==='airplane')return {rootY:.12+Math.abs(w)*.025,lean:.08,legX:[Math.sin(stride)*.45,-Math.sin(stride)*.45],kneeX:.28,legZ:[0,0],armZ:[-1.45,1.45],armX:0,elbowX:-.15,yaw:Math.sin(t*2)*.12};
  if(kind==='fistPump')return {rootY:.12+Math.max(0,w)*.06,lean:.04,legX:[-.12,.12],kneeX:.15,legZ:[0,0],armZ:[-.5,.35],armX:-.9+Math.sin(t*7)*.35,elbowX:[-1.4,-.55],yaw:Math.sin(t*3)*.08};
  if(kind==='dance')return {rootY:.12+Math.abs(w)*.05,lean:.03,legX:[w*.22,-w*.22],kneeX:.28+Math.abs(w)*.2,legZ:[-.08,.08],armZ:[-.9+w*.25,.9+w*.25],armX:-.7+w*.35,elbowX:-.8,yaw:Math.sin(t*3)*.35};
  if(kind==='salute')return {rootY:.12,lean:0,legX:[0,0],kneeX:.05,legZ:[-.08,.08],armZ:[-.8,.08],armX:-.9,elbowX:[-1.6,-.1],yaw:.15};
  if(kind==='clap')return {rootY:.12,lean:.04,legX:[0,0],kneeX:.08,legZ:[0,0],armZ:[.35+w*.15,-.35-w*.15],armX:-.9,elbowX:-1.2,yaw:0};
  if(kind==='highFive')return {rootY:.12+Math.max(0,w)*.08,lean:.06,legX:[-.08,.08],kneeX:.15,legZ:[0,0],armZ:[-2.4,.4],armX:-.2,elbowX:[-.35,-.7],yaw:0};
  const u=clamp((elapsed-1.25)/1.15,0,1),jump=Math.sin(u*Math.PI)*.85,land=clamp((elapsed-2.4)/.25,0,1);
  return {rootY:.12+jump,lean:elapsed>2.4?.12*(1-clamp((elapsed-2.4)/.35,0,1)):0,legX:[-.3*Math.sin(u*Math.PI),-.3*Math.sin(u*Math.PI)],kneeX:.5*Math.sin(u*Math.PI),legZ:[-.55*land,.55*land],armZ:elapsed<2.2?[-2.85,2.85]:[-1.05,1.05],armX:elapsed<2.2?-.4:0,yaw:Math.PI*u};
}
