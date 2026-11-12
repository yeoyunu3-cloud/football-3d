export const MATCH_SECONDS=480,HALF_SECONDS=MATCH_SECONDS/2,CLOCK_SCALE=5400/MATCH_SECONDS;
export const clockText=seconds=>`${String(Math.floor(Math.max(0,seconds)/60)).padStart(2,'0')}:${String(Math.floor(Math.max(0,seconds)%60)).padStart(2,'0')}`;
export function resetClock(match){match.remaining=MATCH_SECONDS;match.time=0;match.halfStarted=false;match.lostTime=[0,0];match.addedTime=[0,1].map(()=>({minutes:null,awarded:0,elapsed:0,extension:0}));}
export function advanceClock(match,dt,lost=false){
  const index=match.half-1,a=match.addedTime[index],boundary=index===0?HALF_SECONDS:0;
  match.time+=dt;
  if(match.remaining>boundary+1e-7){const regular=Math.min(dt,match.remaining-boundary);match.remaining=Math.max(boundary,match.remaining-regular);if(lost)match.lostTime[index]+=regular;dt-=regular;}
  if(match.remaining>boundary+1e-7)return false;
  match.remaining=boundary;
  if(a.minutes===null){a.minutes=Math.min(5,Math.ceil(Math.max(0,match.lostTime[index]-1e-6)*CLOCK_SCALE/60));a.awarded=a.minutes*60/CLOCK_SCALE;if(a.minutes>0)match.recordEvent('addedTime',-1,-1,{minutes:a.minutes,half:match.half});}
  if(dt>0){a.elapsed+=dt;if(lost)a.extension=Math.min(120/CLOCK_SCALE,a.extension+dt);}
  return a.elapsed+1e-7>=a.awarded+a.extension;
}
export function regulationText(match){return clockText((MATCH_SECONDS-match.remaining)*CLOCK_SCALE);}
export function addedInfo(match){const a=match.addedTime[match.half-1];return a.minutes===null||a.minutes===0&&a.elapsed<1/CLOCK_SCALE?null:{minutes:a.minutes,elapsed:clockText(a.elapsed*CLOCK_SCALE)};}
