const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function planThroughPass(match,passer,runner,power=.4,aim=null){
  const ball=match.ball,s=match.attackSign(passer.team),opponents=match.players.filter(q=>q.team!==passer.team&&!q.sentOff),backs=opponents.filter(q=>q.index>0&&(q.x-ball.x)*s>2&&(q.x-ball.x)*s<40),lead=6+power*8;
  const candidates=[];
  for(const offset of [-6,-3,0,3,6])candidates.push({x:clamp(runner.x+s*lead,-48,48),z:clamp(runner.z+runner.vz*.35+offset,-29,29),gate:null});
  for(let i=0;i<backs.length;i++)for(let j=i+1;j<backs.length;j++){
    const a=backs[i],b=backs[j],low=Math.min(a.z,b.z)+.25,high=Math.max(a.z,b.z)-.25,gx=(a.x+b.x)/2;
    if(Math.abs(a.x-b.x)>7||Math.abs(a.z-b.z)<3.1||high-low<1.8||high-low>19||runner.x*s<gx*s-9)continue;
    const endX=s*clamp(Math.max(runner.x*s+lead,gx*s+3),-45,48);
    for(const gz of [(low+high)/2,clamp(runner.z+runner.vz*.3,low,high),low,high]){
      const z=ball.z+(gz-ball.z)*(endX-ball.x)/(gx-ball.x);if(Math.abs(z)>29)continue;
      const point={x:endX,z,gate:{x:gx,z:gz,width:high-low+.5}};if(distance(runner,point)<19)candidates.push(point);
    }
  }
  let best=null,rank=-Infinity;
  for(const point of candidates){
    const dx=point.x-ball.x,dz=point.z-ball.z,d=Math.hypot(dx,dz);if(d<5||d>60)continue;
    const input=aim??{x:s,z:0},inputLength=Math.hypot(input.x,input.z),alignment=inputLength>.15?(dx*input.x+dz*input.z)/(d*inputLength):dx*s/d;if(alignment<.12)continue;
    const speed=clamp(26+power*10+(d-25)*.12,23,39),desiredTime=Math.max(d/(speed*.82),distance(runner,point)/8.8+.1);let lo=.18,hi=1.35;for(let n=0;n<18;n++){const mid=(lo+hi)/2,travel=speed*(1-Math.exp(-mid*desiredTime))/mid;if(travel>d)lo=mid;else hi=mid;}const drag=(lo+hi)/2,flight=-Math.log(Math.max(.05,1-drag*d/speed))/drag;
    let clearance=12;
    for(const q of opponents){
      const projection=clamp(((q.x-ball.x)*dx+(q.z-ball.z)*dz)/(d*d),.12,.98),pressure=match.tactics[q.team]?.pressure,maxSpeed=q.index===0?7:pressure==='high'?8.6:pressure==='low'?6.6:8.2;
      for(const fraction of [clamp(projection-.1,.12,.98),projection,clamp(projection+.1,.12,.98)]){
        const cross={x:ball.x+dx*fraction,z:ball.z+dz*fraction},time=-Math.log(Math.max(.05,1-drag*d*fraction/speed))/drag,reaction=Math.min(time,.13),remaining=Math.max(0,time-reaction),start={x:q.x+q.vx*reaction,z:q.z+q.vz*reaction},qx=cross.x-start.x,qz=cross.z-start.z,qd=Math.hypot(qx,qz),desired=Math.min(maxSpeed,qd/Math.max(.04,remaining)),vx=qx/(qd||1)*desired,vz=qz/(qd||1)*desired,delta=Math.hypot(vx-q.vx,vz-q.vz),ramp=Math.min(remaining,delta/25),blend=delta>0?Math.min(1,25*ramp/delta):1;
        const after={x:start.x+q.vx*ramp+(vx-q.vx)*blend*ramp*.5+vx*(remaining-ramp),z:start.z+q.vz*ramp+(vz-q.vz)*blend*ramp*.5+vz*(remaining-ramp)};
        clearance=Math.min(clearance,distance(after,cross));
      }
    }
    const space=Math.min(12,...opponents.filter(q=>q.index>0).map(q=>distance(q,point))),runDistance=distance(runner,point),gateBonus=point.gate?12+Math.min(point.gate.width,9)*.35:0;
    const score=clamp(clearance,-5,5)*4+space*.35+alignment*6+gateBonus-runDistance*.48-Math.abs(point.z-runner.z)*.15;
    if(score>rank){rank=score;best={...point,speed,drag,flight,clearance,score};}
  }
  return best??{x:clamp(runner.x+s*lead,-48,48),z:clamp(runner.z,-29,29),gate:null,speed:29,drag:.5,flight:1.2,clearance:-3,score:-30};
}
