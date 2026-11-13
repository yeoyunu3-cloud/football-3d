import {predictBall} from './keeper.js?v=20261114-field';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function buildWall(m,r){
 r.wallIds=[];if(!['freeKick','indirect'].includes(r.type)||r.x*m.attackSign(r.team)<10)return;
 const s=m.attackSign(r.team),goal={x:s*52.5,z:0},dx=goal.x-r.x,dz=goal.z-r.z,d=Math.hypot(dx,dz)||1,count=d<24?4:3;
 const wall=m.players.filter(p=>p.team!==r.team&&p.index>0&&!p.sentOff).sort((a,b)=>Math.hypot(a.x-r.x,a.z-r.z)-Math.hypot(b.x-r.x,b.z-r.z)).slice(0,count);
 wall.forEach((p,i)=>{const offset=(i-(wall.length-1)/2)*.64;p.x=clamp(r.x+dx/d*9.3-dz/d*offset,-51,51);p.z=clamp(r.z+dz/d*9.3+dx/d*offset,-32,32);p.heading=Math.atan2(r.x-p.x,r.z-p.z);p.wallUntil=Infinity;p.wallAnchor={x:p.x,z:p.z};r.wallIds.push(p.id);});
}
export function releaseWall(m,r){for(const id of r.wallIds??[]){const p=m.players[id];p.wallUntil=m.controlTime+.75;p.wallJumpTime=0;}}
export function updateWallJumps(m,dt){for(const p of m.players){if(!(p.wallUntil>m.controlTime))continue;const f=predictBall(m.ball,.12);if(!p.wallJumpTime&&m.lastKick?.isShot&&Math.hypot(f.x-p.x,f.z-p.z)<5&&f.y>.8&&f.y<2.8)p.wallJumpTime=.5;if(p.wallJumpTime>0){p.wallJumpTime=Math.max(0,p.wallJumpTime-dt);p.jump=Math.max(p.jump??0,.38*Math.sin(Math.PI*(1-p.wallJumpTime/.5)));}}}
