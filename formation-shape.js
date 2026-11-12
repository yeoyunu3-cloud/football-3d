const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function shapeTarget(match,p,carrier,primary,target){
 if(p.index===0||p.id===carrier?.id||primary?.id===p.id||p.id===match.receiver||p.runUntil>match.time||match.crossUntil>match.time||match.formations[p.team]==='custom')return target;
 const s=match.attackSign(p.team),base=match.basePosition(p),own=carrier?.team===p.team,bx=match.ball.x*s,bz=match.ball.z;
 let {x,z,speed}=target;
 // Without a carrier, retain separate back/midfield/forward lines. Only the
 // assigned chasers leave the shape, rather than every player chasing the ball.
 if(!carrier&&match.lastTouch>=0&&match.players[match.lastTouch].team!==p.team&&match.teamAI?.[p.team]?.secondary!==p.id){x=s*clamp(base[0]*.82+bx*.42+3,-46,37);z=clamp((p.index<=4?(p.defensiveLaneZ??p.z):base[1]*s)*.86+bz*.15,-29,29);}
 const wide=['LM','RM','LW','RW'].includes(p.role),boxRun=own&&bx>19&&Math.abs(bz)>14&&['LW','RW'].includes(p.role);
 if(wide&&!boxRun){const sign=Math.sign(base[1]*s)||Math.sign(z)||1,narrow=match.tactics[p.team]?.width==='narrow',minimum=own?(narrow?18:23):17;
  z=sign*clamp(Math.abs(z),minimum,29);
 }
 return {x,z,speed};
}
