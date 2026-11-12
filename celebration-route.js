const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function planCelebration(player,sign,kind,impactZ=0){
  const side=Math.sign(player.z)||Math.sign(impactZ)||1,approach=kind==='slide'?{x:sign*44,z:side*21}:{x:sign*47,z:side*28},finish=kind==='slide'?{x:sign*49,z:side*30}:kind==='airplane'?{x:sign*49,z:side*23}:{...approach},origin={x:player.x,z:player.z};
  const distance=Math.hypot(approach.x-origin.x,approach.z-origin.z),runDuration=Math.max(.75,distance/7.8),signatureDuration=kind==='slide'?3.8:kind==='airplane'?3.3:kind==='dance'?3.6:kind==='fistPump'?2.8:2.35,groupAt=runDuration+signatureDuration+.55;
  return {origin,approach,finish,kind,runDuration,signatureDuration,groupAt,duration:groupAt+2.4};
}
export function celebrationStep(route,elapsed){
  const running=elapsed<route.runDuration,signature=elapsed-route.runDuration;
  let x,z,vx=0,vz=0;
  if(running){const u=clamp(elapsed/route.runDuration,0,1);x=route.origin.x+(route.approach.x-route.origin.x)*u;z=route.origin.z+(route.approach.z-route.origin.z)*u;vx=(route.approach.x-route.origin.x)/route.runDuration;vz=(route.approach.z-route.origin.z)/route.runDuration;}
  else if(route.kind==='slide'||route.kind==='airplane'){const u=clamp(signature/route.signatureDuration,0,1),progress=u*(2-u);x=route.approach.x+(route.finish.x-route.approach.x)*progress;z=route.approach.z+(route.finish.z-route.approach.z)*progress;vx=(route.finish.x-route.approach.x)*2*(1-u)/route.signatureDuration;vz=(route.finish.z-route.approach.z)*2*(1-u)/route.signatureDuration;}
  else {x=route.approach.x;z=route.approach.z;}
  const heading=running?Math.atan2(vx,vz):Math.atan2(route.finish.x-route.approach.x||route.approach.x*.01,route.finish.z-route.approach.z||route.approach.z*.01)+(route.kind==='jumpTurn'?-Math.PI:0);
  return {x,z,vx,vz,heading,poseTime:running?Math.max(.001,elapsed/route.runDuration*1.24):1.25+signature,running};
}
