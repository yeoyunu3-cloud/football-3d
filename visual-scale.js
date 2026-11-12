// Render measurements use metres; the match's existing ball rest height is a
// simulation reference, not its visible radius. Keep flight height above turf.
export const VISUAL_SCALE=Object.freeze({pitchLength:105,pitchWidth:68,turfY:.05,ballRadius:.135,simulationBallRestY:.34,playerHeight:1.8});
export const ballRenderY=y=>VISUAL_SCALE.turfY+VISUAL_SCALE.ballRadius+Math.max(0,y-VISUAL_SCALE.simulationBallRestY);
export function followHeading(current,target,dt){return current+Math.atan2(Math.sin(target-current),Math.cos(target-current))*(1-Math.exp(-Math.max(0,dt)*15));}
export function gaitFor(speed,previous='idle',ownsBall=false){
 if(speed<(previous==='idle'?.28:.16))return 'idle';
 const running=speed>(['run','dribble'].includes(previous)?4.4:5.2);
 return running?(ownsBall?'dribble':'run'):'walk';
}
export function strideRate(speed,kind,scale=1){return kind==='idle'?1:Math.max(.12,Math.min(1.65,speed/((kind==='walk'?5.04:7)*scale)));}
