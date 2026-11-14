import {FIELD_SCALE,FIELD_GRAVITY} from './visual-scale.js?v=20261114-field';
import {observeAction,observeCarry,observeLoss,adaptDefense} from './opponent-adaptation.js?v=20261112-20-release';
import {teamShapeTarget,updateAutoRuns} from './team-shape.js?v=20261114-field';
import {buildWall,releaseWall,updateWallJumps} from './restart-wall.js?v=20261112-20-release';
import {isHumanKeeper,startKeeperRelease,stepKeeperRelease} from './keeper-control.js?v=20261114-field';
import {variation,hashSeed,CELEBRATIONS} from './match-variation.js?v=20261112-20-release';
import {shapeTarget} from './formation-shape.js?v=20261112-20-release';
import {coordinateTeam,coverTarget,openSupport,bestOutlet,shootingWindow} from './team-ai.js?v=20261113-shape';
import {attackPlan,attackPosition} from './attacking.js?v=20261112-20-release';
import {planThroughPass} from './through-pass.js?v=20261112-20-release';
import {planCelebration,celebrationStep} from './celebration-route.js?v=20261112-20-release';
import {TACTIC_OPTIONS,tacticValue,passSafety,dribbleTarget} from './tactics.js?v=20261112-20-release';
import {keeperTarget,keeperCanHandle} from './keeper-tactics.js?v=20261112-20-release';
import {flightStep,planShot} from './ball-flight.js?v=20261114-field';
import {stepGoalBall} from './goal-effects.js?v=20261114-field';
import {MATCH_SECONDS,HALF_SECONDS,CLOCK_SCALE,resetClock,advanceClock,regulationText,addedInfo} from './match-clock.js?v=20261112-20-release';
import {Shootout} from './shootout.js?v=20261114-field';
import {DRAWABLE_RESTARTS,planSetPiece} from './setpieces.js?v=20261114-field';
import {predictBall,updateKeeper,tryKeeperSave,keeperContacts,sweepDistance3} from './keeper.js?v=20261114-field';
export const FORMATION = [[-48,0],[-29,-24],[-33,-8],[-33,8],[-29,24],[-14,-24],[-19,-8],[-16,9],[-11,24],[-2,-6],[-6,9]];
export const ROLES = ['GK','LB','CB','CB','RB','LM','CM','CM','RM','ST','ST'];
export const NAMES = ['강지후','윤태오','서준혁','이시우','문하람','정이든','백도현','류건우','오선율','한도윤','차유진'];
export const NUMBERS = [1,3,4,5,2,7,6,8,11,10,9];
export const FORMATIONS = {
  '4-4-2': FORMATION,
  '4-3-3': [[-48,0],[-29,-24],[-33,-8],[-33,8],[-29,24],[-20,-13],[-23,0],[-16,13],[-3,-25],[-1,0],[-3,25]],
  '4-2-3-1': [[-48,0],[-29,-24],[-33,-8],[-33,8],[-29,24],[-20,-10],[-20,10],[-6,-23],[-8,0],[-1,0],[-6,23]],
  '3-5-2': [[-48,0],[-33,-16],[-35,0],[-33,16],[-16,-27],[-18,-11],[-24,0],[-18,11],[-16,27],[-3,-8],[-3,8]]
};
const FORMATION_ROLES = {'4-4-2':ROLES,'4-3-3':['GK','LB','CB','CB','RB','CM','DM','CM','LW','ST','RW'],'4-2-3-1':['GK','LB','CB','CB','RB','DM','DM','LM','AM','ST','RM'],'3-5-2':['GK','CB','CB','CB','LM','CM','DM','CM','RM','ST','ST']};
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
// Skill moves: dur (s), fool = how long nearby defenders are wrong-footed, step(u, side) gives player
// velocity (vf toward goal, vl to the attacker's left) and ball offset (bf, bl, by) at normalised time u.
const wave=u=>Math.sin(Math.PI*2*u);
const SKILLS={
  feint:{dur:.35,fool:.35,step:(u,s)=>({vf:1.5,vl:s*wave(u)*3,bf:.7})},
  bigFeint:{dur:.5,fool:.5,step:(u,s)=>({vf:1,vl:s*wave(u)*4.6,bf:.7})},
  bodyFeint:{dur:.42,fool:.45,step:(u,s)=>u<.4?{vf:1.5,vl:s*4,bf:.7,bl:s*.15}:{vf:4.5,vl:-s*5,bf:.8,bl:-s*.2}},
  sideStep:{dur:.55,fool:.35,step:(u,s)=>({vf:.4,vl:s*4.6,bf:.45,bl:s*.35})},
  ballRoll:{dur:.6,fool:.4,step:(u,s)=>({vf:0,vl:s*3.6,bf:.35,bl:s*(-.4+u*.8)})},
  stepover:{dur:.58,fool:.55,step:(u,s)=>u<.5?{vf:.8,vl:s*wave(u)*2.4,bf:.6,bl:0}:{vf:7,vl:-s*3.4,bf:.9,bl:-s*.2}},
  reverseStepover:{dur:.58,fool:.55,step:(u,s)=>u<.5?{vf:.8,vl:-s*wave(u)*2.4,bf:.6,bl:0}:{vf:7,vl:s*3.4,bf:.9,bl:s*.2}},
  elastico:{dur:.48,fool:.6,step:(u,s)=>u<.4?{vf:1,vl:-s*1.5,bf:.6,bl:-s*.65}:{vf:3.5,vl:s*6.2,bf:.7,bl:s*.75}},
  roulette:{dur:.72,fool:.6,step:(u,s,k,m,p)=>{k.h0??=p.heading;const a=u*Math.PI*2;return {vf:2.2*Math.cos(a),vl:s*4.2,bf:.7*Math.cos(a),bl:.7*Math.sin(a)*s,heading:k.h0-s*a}}},
  heelFlick:{dur:.45,fool:.45,step:(u,s)=>u<.35?{vf:2,vl:0,bf:.7}:{vf:-5.5,vl:0,bf:-.8}},
  dragBack:{dur:.45,fool:.35,step:(u,s)=>u<.4?{vf:0,vl:0,bf:.75-u*3}:{vf:-3.2,vl:0,bf:-.75}},
  turn:{dur:.5,fool:.4,step:(u,s)=>u<.35?{vf:.3,vl:0,bf:.6}:{vf:.5,vl:s*5.2,bf:.4,bl:s*.7}},
  flickUp:{dur:.5,fool:.3,step:(u,s)=>({vf:1.4,vl:0,bf:.55+u*.3,by:Math.sin(Math.PI*u*.5)*1.4,release:u>.85?{f:.6,y:3.6,noCatch:.15}:null})},
  rainbow:{dur:.6,fool:.55,step:(u,s)=>({vf:u<.3?2:8,vl:0,bf:.2,by:u<.3?u*2:0,release:u>=.3?{f:9,y:6.2,noCatch:.3}:null})},
  fakeCut:{dur:.6,fool:.65,reach:6.5,step:(u,s)=>u<.45?{vf:.3,vl:0,bf:.6}:{vf:2.2,vl:s*5.6,bf:.55,bl:s*.6}},
  scoopTurn:{dur:.62,fool:.6,reach:6.5,step:(u,s)=>u<.45?{vf:.3,vl:0,bf:.6}:{vf:-4.6,vl:s*1.5,bf:-.7,bl:s*.2}},
};

const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
const signOf = team => team===0?1:-1;
function segmentDistance(p,a,b) {
  const dx=b.x-a.x,dz=b.z-a.z,t=clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);
  return Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t);
}
function turn(a,b,t) { return a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*Math.min(1,t); }

let matchSerial=0;
export class Match {
  constructor() {
    this.players=Array.from({length:22},(_,id)=>{
      const team=id<11?0:1,index=id%11,s=this.attackSign(team);
      return {id,team,index,name:team===0?NAMES[index]:['서도윤','고시온','권유찬','남도하','신하람','유태민','정시온','한재원','차도겸','노이준','민서준'][index],number:NUMBERS[index],role:ROLES[index],x:FORMATION[index][0]*s,z:FORMATION[index][1]*s,vx:0,vz:0,heading:s*Math.PI/2,stamina:100,stride:0,kickAnim:0,dive:0,diveSide:1,diveHeight:.5,diveVX:0,diveVZ:0,decision:0,reaction:0,targetX:0,targetZ:0};
    });
    this.ball={x:0,z:0,y:.34,vx:0,vz:0,vy:0};
    this.input={x:0,z:0,sprint:false};
    this.mode='player';this.formations=['4-4-2','4-4-2'];this.tactics=[{mentality:'balanced',pressure:'balanced'},{mentality:'attacking',pressure:'high',buildUp:'balanced',tempo:'fast',line:'balanced'}];
    this.reset();
  }
  get lastTouch(){return this._lastTouch??-1;}
  set lastTouch(id){this._lastTouch=id;const p=this.players?.[id];if(p){this.lastTouchByTeam??=[-1,-1];this.lastTouchByTeam[p.team]=id;}}
  reset() {
    this.id=`match-${Date.now().toString(36)}-${++matchSerial}`;this.startedAt=new Date().toISOString();this.variationSeed=hashSeed(this.id);this.lastTouchByTeam=[-1,-1];this.events=[];this.notice=null;this.controlTime=0;this.cardWait=0;this.finishLogged=false;this.throwState=null;this.half=1;this.forfeit=null;this.lastKick=null;this.phase='play';this.restart=null;this.offside=null;this.directRestart=null;this.score=[0,0];resetClock(this);this.shootout=null;this.winner=null;this.penaltyInFlight=false;this.penaltyFlightElapsed=0;this.running=false;this.ended=false;this.paused=false;this.goalWait=0;this.event='';this.stats={shots:[0,0],saves:[0,0],possession:[0,0],passes:[0,0],restarts:[{},{}]};this.manualSelection=false;this.defending=false;this.switchAt=0;this.selectionPossessionTeam=-1;this.charge=null;this.halftimeRemaining=0;this.inputRevision=0;this.highlight=null;this.lastTouchTeam=-1;this.selectionGrace=0;this.possessionWonAt=[0,0];this.lastPossessionTeam=-1;
    for(const p of this.players){p.shootoutGoalkeeper=false;p.shootoutExcluded=false;p.sentOff=false;p.yellow=0;p.fouls=0;p.stamina=100;p.keeperAction=null;p.holdingBall=false;p.aerial=null;p.trap=0;p.recover=0;p.controlCooldown=0;p.celebration=0;p.celebrationLift=0;p.observeCarryAt=0;p.wallUntil=0;p.wallJumpTime=0;p.distribution=null;p.keeperReleased=false;p.dribbleTarget=null;p.dribbleUntil=0;p.dribbleSide=0;p.feint=0;}
    this.kickoff(0);
  }
  get canPause(){return this.mode!=='online';}
  setPaused(value){if(!this.canPause)return false;this.paused=Boolean(value);return true;}
  playerLabel(id){const p=this.players[id];return p?`${p.team===0?'홈':'원정'} ${p.number??NUMBERS[p.index]}번 ${p.name??NAMES[p.index]}`:'';}
  recordEvent(type,team,playerId=-1,details={}){
    const p=this.players[playerId],entry={id:this.events.length+1,type,time:this.displayTime,half:this.half,team,playerId,name:p?.name??'',number:p?.number??(p?NUMBERS[p.index]:null),...details};
    this.events.push(entry);return entry;
  }
  // Input feedback ('info': run called, kick cancelled, penalty hint) is not bannered; only match events are.
  announce(type,title,message,duration=6){if(type==='info')return;this.notice={type,title,message,remaining:duration};}
  cancelKick(){const had=Boolean(this.charge||this.pending||this.restart?.plan||this.restart?.queuedKick);this.charge=null;this.pending=null;if(this.restart){this.restart.plan=null;this.restart.queuedKick=null;}if(had)this.announce('info','동작 취소','패스·슛 입력을 취소했습니다.',2);return had;}
  matchRecord(status=this.ended?'finished':'abandoned'){
    return {winner:this.winner,shootout:this.shootout?{score:[...this.shootout.score],attempts:[...this.shootout.attempts],kicks:this.shootout.kicks.map(k=>({...k})),winner:this.shootout.winner,participants:this.shootout.participants.map(a=>[...a]),excluded:this.shootout.excluded.map(a=>[...a])}:null,addedTime:this.addedTime.map(a=>({...a})),id:this.id,startedAt:this.startedAt,endedAt:new Date().toISOString(),squadName:this.squadName??'내 스쿼드',awaySquadName:this.awaySquadName??'상대 팀',mode:this.mode,status,score:[...this.score],time:this.displayTime,formation:this.formations[0],events:this.events.filter(e=>['goal','foul','yellow','red','penaltyGoal','penaltyMiss'].includes(e.type)).map(e=>({...e})),stats:JSON.parse(JSON.stringify(this.stats)),players:this.players.map(p=>({id:p.id,team:p.team,name:p.name,number:p.number,role:p.role,yellow:p.yellow,sentOff:p.sentOff,fouls:p.fouls}))};
  }
  kickoff(team=0) {
    this.lastTouchByTeam=[-1,-1];this.selectionPossessionTeam=team;this.teamAI=[null,null];this.lastDistribution=[null,null];
    this.attackPlans=[null,null];this.wallPass=[null,null];this.receiveGate=null;this.goalNet=null;this.ball.shotFlight=null;this.ball.flightDrag=null;this.throwState=null;this.receiveTarget=null;this.crossUntil=0;this.crossPoint=null;this.offsideExempt=false;this.ball.curlX=this.ball.curlZ=this.ball.curveRemaining=0;
    for(const p of this.players){p.wallUntil=0;p.wallJumpTime=0;p.distribution=null;p.defensiveLaneZ=null;p.supportFlight=null;p.supportSpot=null;p.celebration=p.celebrationLift=0;p.firstTouchRunUntil=0;p.firstTouchTarget=null;p.runUntil=0;p.runTarget=null;p.controlCooldown=0;p.throwAnim=0;p.recover=0;}
    for(const p of this.players){const s=this.attackSign(p.team);p.x=this.basePosition(p)[0]*s;p.z=this.basePosition(p)[1]*s;p.vx=p.vz=p.kickAnim=p.dive=p.decision=p.reaction=0;p.keeperAction=null;p.holdingBall=false;p.aerial=null;p.jump=0;p.heading=s*Math.PI/2;p.targetX=p.x;p.targetZ=p.z;}
    const takerIndex=this.mode==='manager'&&variation(this,`kickoff-taker:${team}:${this.score.join('-')}`)>.5?10:9;
    const taker=this.players[team*11+takerIndex].sentOff?this.players.find(p=>p.team===team&&!p.sentOff&&p.index>0):this.players[team*11+takerIndex];taker.x=-this.attackSign(team)*.9;taker.z=0;
    for(const p of this.players)if(p.team!==team&&Math.hypot(p.x,p.z)<9.5){const len=Math.hypot(p.x,p.z)||1;p.x*=9.5/len;p.z*=9.5/len;}
    const partner=this.players[team*11+(taker.index===9?10:9)];partner.x=-this.attackSign(team)*4;partner.z=9;
    Object.assign(this.ball,{x:0,z:0,y:.34,vx:0,vz:0,vy:0});
    this.owner=taker.id;this.selected=team===0?taker.id:this.players.find(p=>p.team===0&&p.index>0&&!p.sentOff)?.id??9;this.lastTouch=taker.id;this.noCatch=0;this.possessionTime=0;this.pending=null;this.receiver=-1;this.receiveAssist=0;this.nextKickoff=team;this.lastAim=null;this.manualSelection=false;this.defending=team===1;this.charge=null;this.marking=new Map();
    this.restart=null;this.offside=null;this.directRestart=null;this.setInput(0,0,false);
    const receiver=this.players.filter(p=>p.team===team&&p.index>0&&!p.sentOff&&p.id!==taker.id).sort((a,b)=>Math.abs(a.index-(this.mode==='manager'?(variation(this,`kickoff-receiver:${team}:${this.half}`)>.5?6:7):7))-Math.abs(b.index-(this.mode==='manager'?(variation(this,`kickoff-receiver:${team}:${this.half}`)>.5?6:7):7)))[0];
    // One player at the spot; receiver waits outside the circle in their own half.
    if(receiver){receiver.x=-this.attackSign(team)*10;receiver.z=this.mode==='manager'?(variation(this,`kickoff-side:${team}:${this.half}`)>.5?6:-6):5;}
    this.kickoffState={team,taker:taker.id,receiver:receiver?.id,remaining:1.8};this.event='킥오프';
  }
  releaseKickoff(){
    const k=this.kickoffState;if(!k)return;
    this.kickoffState=null;const p=this.players[k.taker],r=this.players[k.receiver];
    if(!r)return;
    const dx=r.x-this.ball.x,dz=r.z-this.ball.z,d=Math.hypot(dx,dz)||1;
    Object.assign(this.ball,{vx:dx/d*17,vz:dz/d*17,vy:0});p.kickAnim=.28;this.owner=-1;this.lastTouch=p.id;this.noCatch=.2;this.receiver=r.id;this.receiveTarget={x:r.x,z:r.z};this.receiveAssist=1.4;this.receiverInputRevision=this.inputRevision;this.event='';
    this.recordEvent('kickoff',k.team,p.id);this.stats.passes[k.team]++;this.lastKick={type:'pass',team:k.team};this.offside=null;this.directRestart={type:'kickoff',team:k.team,kicker:p.id};
    if(k.team===0&&this.mode==='player')this.selected=r.id;
  }
  attackSign(team){if(this.phase==='shootout'&&this.shootout)return team===this.shootout.turn?1:-1;return signOf(team)*(this.half===2?-1:1);}
  basePosition(p){return this.formations[p.team]==='custom'?(p.team===0?this.customBases:this.awayCustomBases)?.[p.index]??FORMATION[p.index]:FORMATIONS[this.formations[p.team]]?.[p.index]??FORMATION[p.index];}
  get regulationDisplayTime(){return regulationText(this);}
  get addedTimeInfo(){return addedInfo(this);}
  get displayTime(){const a=this.addedTimeInfo;return a?`${this.half===1?'45':'90'}+${a.elapsed}`:this.regulationDisplayTime;}
  endHalf(){
    this.charge=this.pending=null;this.restart=null;this.throwState=null;this.penaltyInFlight=false;this.setInput(0,0);
    if(this.half===1){this.phase='halftime';this.halftimeRemaining=3;this.event='하프타임';this.recordEvent('halftime',-1);return;}
    this.recordEvent('fulltime',-1,-1,{score:[...this.score]});
    if(this.score[0]===this.score[1]){this.phase='shootout';this.goalWait=0;this.shootout=new Shootout(this.players,{firstTeam:(this.random??Math.random)()<.5?0:1,random:this.random??Math.random});this.shootout.prepare(this);this.recordEvent('shootoutStart',-1);}
    else{this.ended=true;this.phase='finished';this.winner=this.score[0]>this.score[1]?0:1;this.event='경기 종료';}
  }
  continueHalf(){
    if(this.phase!=='halftime')return;
    this.halftimeRemaining=0;this.half=2;this.recordEvent('secondHalf',1);this.halfStarted=false;this.phase='play';this.event='';this.goalWait=0;this.kickoff(1);this.paused=false;
    for(const p of this.players)p.stamina=Math.min(100,p.stamina+12);
  }
  takeRestart(type='pass',power=.4,shotStyle='auto'){return this.resumeRestart(type,power,shotStyle);}
  setupRestart(type,team,x,z){
    this.throwState=null;this.ball.shotFlight=null;this.ball.flightDrag=null;this.ball.curlX=this.ball.curlZ=this.ball.curveRemaining=0;
    const manual=this.running&&this.mode==='player'&&team===0;
    const waits={throw:3,corner:5,goalKick:4,freeKick:5,indirect:4,penalty:6};
    this.restart={type,team,x:clamp(x,-52.5,52.5),z:clamp(z,-34,34),manual,wait:waits[type]??4,readyAfter:manual?1.5:0,aimZ:0,aim:{x:this.attackSign(team),z:0}};
    const r=this.restart,s=this.attackSign(team);
    let taker=type==='goalKick'?this.players[team*11]:type==='penalty'?this.players.find(p=>p.team===team&&p.role==='ST'&&!p.sentOff):this.nearest(team,r);
    if(!taker||taker.sentOff)taker=this.players.find(p=>p.team===team&&!p.sentOff);
    r.taker=taker.id;taker.x=clamp(r.x-s*1,-53,53);taker.z=clamp(r.z,-34,34);taker.heading=s*Math.PI/2;
    this.owner=-1;this.offside=null;this.directRestart=null;this.receiver=-1;this.receiveTarget=null;this.receiveAssist=0;this.crossUntil=0;this.pending=null;this.charge=null;this.noCatch=0;
    Object.assign(this.ball,{x:r.x,z:r.z,y:.34,vx:0,vz:0,vy:0});
    const radius=type==='throw'?2:9.15;
    for(const p of this.players){p.vx=p.vz=0;p.wallUntil=0;p.wallJumpTime=0;p.distribution=null;p.keeperAction=null;p.holdingBall=false;p.aerial=null;p.jump=0;p.dive=0;p.decision=0;p.celebration=0;p.runUntil=0;p.runTarget=null;p.trap=p.controlCooldown=p.headerCooldown=p.recover=p.kickAnim=p.throwAnim=0;if(p.id===taker.id||p.sentOff)continue;
      if(type==='penalty'){
        if(p.index===0&&p.team!==team){p.x=s*52.25;p.z=0;continue;}
        p.x=s*Math.min(p.x*s,34);if(Math.abs(p.z)<10)p.z=p.z>=0?10:-10;
      }else if(type==='goalKick'&&p.team!==team&&p.x*s<-36&&Math.abs(p.z)<20.16)p.x=-s*35.5;
      else if(p.team!==team&&distance(p,r)<radius){const dx=p.x-r.x,dz=p.z-r.z,d=Math.hypot(dx,dz)||1;p.x=clamp(r.x+dx/d*radius,-51.5,51.5);p.z=clamp(r.z+dz/d*radius,-33,33);}
    }
    if(type==='goalKick'){
      for(const p of this.players){if(p.sentOff||p.id===taker.id||p.index===0)continue;const base=this.basePosition(p);
        p.x=s*(p.team===team?(p.index<=4?-37+(p.index===1||p.index===4?7:0):p.index>8?8:-15):clamp(-base[0]-28,-30,20));
        p.z=clamp(base[1]*(p.team===team?s:-s),-28,28);
      }
    }
    buildWall(this,r);
    if(type==='corner'){
      r.aim={x:-s*.45,z:-Math.sign(r.z)};
      const available=this.players.filter(p=>p.team===team&&p.id!==taker.id&&p.index>0&&!p.sentOff),short=available.slice().sort((a,b)=>distance(a,r)-distance(b,r))[0];
      if(short){short.x=s*46;short.z=Math.sign(r.z)*25;}
      const runners=available.filter(p=>p!==short).sort((a,b)=>(['ST','AM','LW','RW'].includes(b.role)?10:0)+(b.profile?.height??180)*.02-((['ST','AM','LW','RW'].includes(a.role)?10:0)+(a.profile?.height??180)*.02)).slice(0,3);
      runners.forEach((p,i)=>{p.x=s*[46,43,39][i];p.z=[Math.sign(r.z)*3,-Math.sign(r.z)*6,0][i];});
      const remaining=available.filter(p=>p!==short&&!runners.includes(p));remaining.forEach((p,i)=>{p.x=s*(p.index<=4?5:29);p.z=(i%2?1:-1)*(8+i*2);});
      for(const p of this.players.filter(p=>p.team!==team&&!p.sentOff)){if(p.index===0){p.x=s*50.5;p.z=0;}else{p.x=s*(p.index<=4?44:p.index<=8?38:30);p.z=(p.index%2?1:-1)*(p.index<=4?4+(p.index%3)*3:12);}}
    }
    if(type==='throw'){
      r.aim={x:0,z:-Math.sign(r.z)};taker.x=r.x;taker.z=r.z;taker.heading=r.z>0?Math.PI:0;
      const options=this.players.filter(p=>p.team===team&&p.id!==taker.id&&p.index>0&&!p.sentOff).sort((a,b)=>distance(a,r)-distance(b,r)).slice(0,2);
      options.forEach((p,i)=>{p.x=clamp(r.x+(i? -s*7:s*5),-48,48);p.z=Math.sign(r.z)*(i?21:26);});
    }
    if(manual){this.selected=taker.id;this.manualSelection=false;}
    this.event={throw:'스로인',corner:'코너킥',goalKick:'골킥',freeKick:'프리킥',indirect:'간접 프리킥',penalty:'페널티킥'}[type];
    r.anchors=this.players.map(p=>({x:p.x,z:p.z}));r.support=this.players.filter(p=>p.team===team&&p.id!==taker.id&&p.index>0&&!p.sentOff).sort((a,b)=>distance(a,r)-distance(b,r)).slice(0,2).map(p=>p.id);
    this.stats.restarts[team][type]=(this.stats.restarts[team][type]??0)+1;
    this.recordEvent(type,team,taker.id,{x:r.x,z:r.z});this.announce('restart',`${team===0?'홈':'원정'} ${this.event}`,this.playerLabel(taker.id),4);
  }
  resumeRestart(action=null,power=.4,shotStyle='auto'){
    const r=this.restart;if(!r||r.manual&&(!action||r.readyAfter>0))return false;
    const taker=this.players[r.taker],s=this.attackSign(r.team);
    if(r.manual&&r.type==='penalty'&&action!=='shoot'){this.announce('info','페널티킥 조작','방향키로 조준하고 슛 키로 공을 차세요.',3);return false;}
    releaseWall(this,r);this.restart=null;this.owner=taker.id;this.lastTouch=taker.id;this.possessionTime=0;
    this.offsideExempt=['throw','corner','goalKick'].includes(r.type);
    let type=action??(r.type==='penalty'||r.type==='freeKick'&&Math.abs(r.x)>28?'shoot':r.type==='corner'?'cross':'pass');
    if(r.type==='throw')type='pass';
    this.setPieceContext=r.manual?{type:r.type,aimZ:r.aimZ}:null;
    const chosen=r.manual&&this.selected!==taker.id&&this.players[this.selected]?.team===r.team?this.players[this.selected]:null;
    this.strike(taker,type,power,r.manual?r.aim:null,chosen,shotStyle);this.setPieceContext=null;
    if(r.type==='throw'){
      const inward=-Math.sign(r.z),input=r.manual?r.aim:{x:s*.25,z:inward};
      const dir={x:input.x,z:input.z*inward>.08?input.z:inward*.6};
      const targets=this.players.filter(p=>p.team===r.team&&p.id!==taker.id&&p.index>0&&!p.sentOff&&distance(p,r)<30&&Math.abs(p.z)<32);
      targets.sort((a,b)=>{const rank=p=>((p.x-r.x)*dir.x+(p.z-r.z)*dir.z)/(distance(p,r)||1)*15-Math.abs(distance(p,r)-(7+power*16))*.4;return rank(b)-rank(a);});
      const target=chosen??targets[0],point=target?{x:target.x,z:target.z}:{x:clamp(r.x+dir.x*(8+power*10),-49,49),z:r.z+inward*(8+power*12)};
      const d=distance(r,point),flight=clamp(.65+d*.025,.8,1.3),drag=.12,travel=(1-Math.exp(-drag*flight))/drag;
      const height=2.25*(taker.profile?.height??180)/180;
      const velocity={vx:(point.x-r.x)/travel,vz:(point.z-r.z)/travel,vy:(.65-height+(4.905*FIELD_GRAVITY)*flight*flight)/flight};
      this.receiver=target?.id??-1;this.receiveTarget=point;this.receiveAssist=flight+1.5;this.receiverInputRevision=this.inputRevision;
      if(r.team===0&&this.mode==='player'&&target)this.selected=target.id;
      taker.heading=Math.atan2(point.x-r.x,point.z-r.z);taker.throwAnim=.65;taker.kickAnim=0;
      this.throwState={elapsed:0,taker:taker.id,velocity,height};Object.assign(this.ball,{x:taker.x,z:taker.z,y:height,vx:0,vz:0,vy:0});
    }
    this.penaltyInFlight=r.type==='penalty';this.penaltyFlightElapsed=0;this.directRestart={type:r.type,kicker:taker.id,team:r.team};this.event='';return true;
  }
  setRestartPath(points){
    const r=this.restart;if(!r?.manual||!DRAWABLE_RESTARTS.has(r.type)||this.paused||this.cardWait>0)return false;
    r.plan=planSetPiece(r.type,r,points,this.attackSign(r.team));r.pathError=r.plan?'':'공에서 3m 이상, 75m 이내로 그려 주세요.';return Boolean(r.plan);
  }
  clearRestartPath(){if(this.restart){this.restart.plan=null;this.restart.pathError='';}}
  releaseDrawnRestart(){
    const r=this.restart,plan=r?.plan;if(!r?.manual||!plan||r.readyAfter>0||this.paused||this.cardWait>0)return false;
    const p=this.players[r.taker];releaseWall(this,r);this.restart=null;this.charge=this.pending=null;this.owner=-1;this.lastTouch=p.id;this.possessionTime=0;this.noCatch=.3;
    this.offsideExempt=['throw','corner','goalKick'].includes(r.type);this.offsideSnapshot(r.team,p.id);
    Object.assign(this.ball,{x:r.x,z:r.z,y:.34,vx:plan.vx,vz:plan.vz,vy:plan.vy,curlX:plan.curlX,curlZ:plan.curlZ,curveRemaining:plan.flight});
    p.kickAnim=.28;p.heading=Math.atan2(plan.vx,plan.vz);p.decision=.6;this.lastKick={type:plan.type,team:r.team,isShot:plan.isShot};
    if(plan.isShot)this.stats.shots[r.team]++;else this.stats.passes[r.team]++;
    const targets=this.players.filter(q=>q.team===r.team&&!q.sentOff&&q.id!==p.id&&q.index>0).sort((a,b)=>distance(a,plan.end)-distance(b,plan.end));
    this.receiver=!plan.isShot&&targets.length&&distance(targets[0],plan.end)<15?targets[0].id:-1;this.receiveTarget={...plan.end};this.receiveAssist=plan.flight+1.2;this.receiverInputRevision=this.inputRevision;
    if(this.receiver>=0){const q=this.players[this.receiver];q.runTarget={...plan.end};q.runUntil=this.time+plan.flight+1;if(r.team===0)this.selected=q.id;}
    if(plan.type==='cross'){this.crossUntil=this.time+plan.flight+1;this.crossTeam=r.team;this.crossPoint={...plan.end};}
    this.directRestart={type:r.type,kicker:p.id,team:r.team};this.event='';this.notice=null;this.recordEvent(plan.type,r.team,p.id,{drawn:true});return true;
  }
  offsideSnapshot(team,kicker=this.owner){
    if(this.offsideExempt){this.offsideExempt=false;this.offside=null;return;}
    const s=this.attackSign(team),defenders=this.players.filter(p=>p.team!==team&&!p.sentOff).map(p=>p.x*s).sort((a,b)=>b-a),line=Math.max(0,this.ball.x*s,defenders[1]??52.5);
    this.offside={team,ids:new Set(this.players.filter(p=>p.team===team&&!p.sentOff&&p.id!==kicker&&p.x*s>line+.15).map(p=>p.id))};
  }
  foul(offender,victim,severity=0){
    if(this.restart||this.ended||offender.sentOff)return false;
    offender.fouls++;this.recordEvent('foul',offender.team,offender.id,{victim:this.playerLabel(victim.id),x:victim.x,z:victim.z});
    if(severity>=13){offender.sentOff=true;this.recordEvent('red',offender.team,offender.id,{reason:'위험한 도전'});}
    else if(severity>=9||offender.fouls>=5&&offender.fouls%3===2){offender.yellow++;this.recordEvent('yellow',offender.team,offender.id,{reason:'무리한 도전·반복 반칙'});if(offender.yellow>=2){offender.sentOff=true;this.recordEvent('red',offender.team,offender.id,{reason:'경고 누적'});}}
    const s=this.attackSign(offender.team),penalty=victim.x*s<-36&&Math.abs(victim.z)<20.16;
    this.setupRestart(penalty?'penalty':'freeKick',victim.team,penalty?-s*41.5:victim.x,penalty?0:victim.z);
    if(offender.sentOff){this.event+=' · 퇴장';this.announce('red','퇴장',this.playerLabel(offender.id),8);this.cardWait=5;}else if(severity>=9||offender.fouls>=5&&offender.fouls%3===2){this.event+=' · 경고';this.announce('yellow','경고',this.playerLabel(offender.id),7);this.cardWait=4.5;}
    if(this.players.filter(p=>p.team===offender.team&&!p.sentOff).length<7){this.ended=true;this.phase='finished';this.forfeit=offender.team;this.winner=1-offender.team;this.event='몰수 경기';}
    return true;
  }
  checkBoundary(before){
    if(this.goalWait>0)return true;
    const b=this.ball,events=[];
    if(Math.abs(b.x)>52.84){const edge=Math.sign(b.x)*52.84,t=(edge-before.x)/(b.x-before.x||1);events.push({axis:'x',t:clamp(t,0,1),edge});}
    if(Math.abs(b.z)>34.34){const edge=Math.sign(b.z)*34.34,t=(edge-before.z)/(b.z-before.z||1);events.push({axis:'z',t:clamp(t,0,1),edge});}
    if(!events.length)return false;
    events.sort((a,c)=>a.t-c.t);const e=events[0],x=before.x+(b.x-before.x)*e.t,z=before.z+(b.z-before.z)*e.t;
    const lastTeam=this.lastTouch>=0?this.players[this.lastTouch].team:0;
    if(e.axis==='z'){this.setupRestart('throw',1-lastTeam,x,Math.sign(e.edge)*34);return true;}
    const attackTeam=e.edge*this.attackSign(0)>0?0:1,defendTeam=1-attackTeam;
    const height=(before.y??b.y)+(b.y-(before.y??b.y))*e.t;
    if(Math.abs(z)<3.32&&height<2.16){
      const direct=this.directRestart;
      if(direct?.type==='throw'){this.setupRestart(lastTeam===attackTeam?'goalKick':'corner',lastTeam===attackTeam?defendTeam:attackTeam,lastTeam===attackTeam?Math.sign(e.edge)*47:Math.sign(e.edge)*52.2,lastTeam===attackTeam?0:(z>=0?33.7:-33.7));return true;}
      if(direct?.type==='indirect'||direct&&direct.team!==attackTeam){this.setupRestart(direct.team===attackTeam?'goalKick':'corner',direct.team===attackTeam?defendTeam:attackTeam,Math.sign(e.edge)*(direct.team===attackTeam?47:52.2),direct.team===attackTeam?0:33.7);return true;}
      const scorer=this.lastTouch>=0?this.players[this.lastTouch]:null,ownGoal=!!scorer&&scorer.team!==attackTeam;
      const previousAttacker=this.players[this.lastTouchByTeam?.[attackTeam]],celebrator=!ownGoal?scorer:previousAttacker?.team===attackTeam&&!previousAttacker.sentOff?previousAttacker:this.players.filter(p=>p.team===attackTeam&&p.index>0&&!p.sentOff).sort((a,b)=>distance(a,this.ball)-distance(b,this.ball))[0];
      this.score[attackTeam]++;this.recordEvent('goal',attackTeam,this.lastTouch,{ownGoal,celebrator:celebrator?.id??-1,score:[...this.score]});
      this.announce('goal',ownGoal?'득점 · 자책골':'득점',`${scorer?.number??''}번 ${scorer?.name??''}`.trim(),7.5);this.notice.team=attackTeam;this.celebratingPlayer=celebrator?.id??-1;this.celebrationTeam=attackTeam;
      this.celebrationGroup=this.players.filter(p=>p.team===attackTeam&&!p.sentOff&&p.id!==celebrator?.id&&p.index>0).sort((a,b)=>distance(a,celebrator??this.ball)-distance(b,celebrator??this.ball)).slice(0,5).map(p=>p.id);
      const goalNumber=this.score[0]+this.score[1];this.celebrationKind=CELEBRATIONS[(goalNumber-1)%CELEBRATIONS.length];this.celebrationVariant=Math.floor(variation(this,`celebration:${goalNumber}`)*3);
      this.celebrationRoute=planCelebration(celebrator??{x,z},this.attackSign(attackTeam),this.celebrationKind,z);this.celebrationDuration=this.celebrationRoute.duration;this.notice.remaining=this.celebrationDuration;this.highlight={kind:'goal',remaining:6};this.goalWait=this.celebrationDuration;this.nextKickoff=defendTeam;this.event=attackTeam===0?'홈 팀 득점':'원정 팀 득점';this.owner=-1;this.goalNet={side:Math.sign(e.edge),elapsed:0,hitAt:null,strength:clamp(Math.hypot(b.vx,b.vz)/25,.5,1.4),impact:{y:height,z}};if(Math.abs(b.vx)<1)b.vx=Math.sign(e.edge)*8;b.shotFlight=null;return true;
    }
    const corner=lastTeam===defendTeam;
    this.setupRestart(corner?'corner':'goalKick',corner?attackTeam:defendTeam,Math.sign(e.edge)*(corner?52.2:47),corner?(z>=0?33.7:-33.7):0);return true;
  }
  start(){this.running=true;if(!this.events.some(e=>e.type==='start'))this.recordEvent('start',0);}
  setMode(mode){
    if(this.running||!['player','manager'].includes(mode))return;
    this.mode=mode;if(this.kickoffState)this.kickoff(this.kickoffState.team);this.manualSelection=false;this.charge=null;this.pending=null;this.setInput(0,0);
    if(this.owner>=0&&this.players[this.owner].team===0)this.selected=this.owner;
  }
  setFormation(name,team=0){
    if(this.running||!FORMATIONS[name]&&name!=='custom')return;
    this.formations[team]=name;
    for(const p of this.players)if(p.team===team)p.role=FORMATION_ROLES[name]?.[p.index]??p.role;
    if(!this.running)this.kickoff(this.nextKickoff??0);
  }
  setTactic(key,value,team=0){
    const values=key==='mentality'?['defensive','balanced','attacking']:key==='pressure'?['low','balanced','high']:(TACTIC_OPTIONS[key]??[]).map(([value])=>value);
    if(values.includes(value))this.tactics[team][key]=value;
  }
  setInput(x,z,sprint=false){const len=Math.hypot(x,z),nx=len>1?x/len:x,nz=len>1?z/len:z;if(Math.abs(nx-this.input.x)>.05||Math.abs(nz-this.input.z)>.05)this.inputRevision=(this.inputRevision??0)+1;this.input={x:nx,z:nz,sprint};}
  switchPlayer() {
    if(this.mode==='manager'||this.phase==='shootout')return;
    if(this.restart?.manual){const r=this.restart;if(r.type==='penalty')return;const options=this.players.filter(p=>p.team===0&&p.index>0&&!p.sentOff&&p.id!==r.taker).sort((a,b)=>distance(a,r)-distance(b,r)).map(p=>p.id);options.push(r.taker);this.selected=options[(options.indexOf(this.selected)+1)%options.length];this.charge=null;return;}
    if(this.players[this.selected].sentOff){this.selected=this.nearest(0,this.ball)?.id??0;this.manualSelection=false;}
    if(this.owner>=0&&this.players[this.owner].team===0){this.selected=this.owner;return;}
    const candidates=this.defensiveCandidates();
    this.selected=candidates[0]?.id??this.selected;
    this.switchCandidate=null;this.manualSelection=false;this.defending=true;this.switchAt=this.time;this.receiveAssist=0;this.pending=null;this.charge=null;
  }
  defensiveScore(p){
    const b=this.ball,s=this.attackSign(0),target=predictBall(b,this.owner>=0?.18:.32),goal={x:-s*52.5,z:0},goalSide=(p.x-target.x)*s<0;
    return distance(p,target)+(goalSide?-.8:1.5)+Math.abs(p.z-target.z)*.06+distance(p,goal)*.012;
  }
  defensiveCandidates(){return this.players.filter(p=>p.team===0&&p.index>0&&!p.sentOff&&!(this.owner<0&&this.noCatch>0&&p.id===this.lastTouch)).sort((a,b)=>this.defensiveScore(a)-this.defensiveScore(b));}
  resumeAutoSwitch(){this.manualSelection=false;this.switchAt=-1;this.updateAutoSelection();}
  updateAutoSelection(){
    if(this.mode==='manager'||this.phase==='shootout'||this.restart?.manual)return;
    if(this.players[this.selected].sentOff){this.selected=this.nearest(0,this.ball)?.id??0;this.manualSelection=false;}
    if(this.owner>=0){
      const team=this.players[this.owner].team;
      // A pass can preselect a distant receiver. On an interception, release
      // the old switch cooldown, while retaining the distance/dwell checks.
      if(team===1&&this.selectionPossessionTeam===0)this.switchAt=Math.min(this.switchAt,this.time-1.01);
      this.selectionPossessionTeam=team;
    }
    if(this.owner>=0&&this.players[this.owner].team===0){this.defending=false;this.manualSelection=false;return;}
    if(this.owner>=0&&this.players[this.owner].team===1)this.defending=true;
    this.manualSelection=false;
    if(this.owner<0&&this.receiver>=0&&this.players[this.receiver].team===0&&this.receiveAssist>0&&this.lastTouch>=0&&this.players[this.lastTouch].team===0){const nearest=this.nearest(0,this.ball,this.noCatch>0?this.lastTouch:-1);this.selected=this.receiver;this.defending=false;return;}
    if(this.owner<0)this.defending=true;
    if(!this.defending)return;
    const b=this.ball,t=this.owner>=0?.16:.28,target={x:clamp(b.x+b.vx*t,-51,51),z:clamp(b.z+b.vz*t,-32,32)};
    const candidate=this.defensiveCandidates()[0];if(!candidate)return;
    const current=this.players[this.selected],gap=this.defensiveScore(current)-this.defensiveScore(candidate);
    const currentDistance=distance(current,b),advantage=currentDistance-distance(candidate,b),largeGap=advantage>Math.max(4.8,currentDistance*.28),emergency=advantage>12||current.index===0||current.sentOff;
    if(!largeGap&&!emergency||candidate.id===this.selected){this.switchCandidate=null;return;}
    if(this.switchCandidate?.id!==candidate.id)this.switchCandidate={id:candidate.id,since:this.controlTime};
    if(candidate.id!==this.selected&&(emergency||largeGap&&this.controlTime-this.switchCandidate.since>.18)&&(this.time-this.switchAt>1||emergency)){
      this.selected=candidate.id;this.switchAt=this.time;this.receiveAssist=0;this.pending=null;this.charge=null;
    }
  }
  beginKick(type,shotStyle='auto'){
    if(this.phase==='shootout'){const s=this.shootout;if(this.mode!=='player'||!this.running||this.paused||this.ended||type!=='shoot')return false;if(s.turn===1){s.dive(this);return true;}if(s.stage!=='aim')return false;this.charge??={type,start:this.controlTime,player:this.selected,shotStyle};return true;}
    if(this.mode!=='player'||!this.running||this.paused||this.ended||this.goalWait>0||this.phase!=='play')return;
    if(this.cardWait>0||this.restart&&!this.restart.manual)return false;
    if(this.charge&&this.charge.type!==type||this.pending&&this.pending.type!==type){this.cancelKick();return false;}
    if(this.restart?.manual){this.charge??={type,start:this.controlTime,player:this.selected,shotStyle};return true;}
    if(this.owner<0&&this.ball.y>1.1){this.startHeader(this.players[this.selected],type==='pass'?'pass':'shoot');return;}
    if(!this.charge){this.charge={type,start:this.controlTime,player:this.selected,shotStyle};if(type==='through'&&this.owner===this.selected){const runner=this.throughTarget(this.players[this.selected],.4,this.input);if(runner){this.charge.runner=runner.id;this.charge.runUpdateAt=this.time;runner.runTarget=this.throughSpace(this.players[this.selected],runner,.4,this.input);runner.runUntil=this.time+1.2;}}}
  }
  releaseKick(type){
    if(!this.charge||this.charge.type!==type)return false;
    const charge=this.charge;this.charge=null;const chargeEnd=charge.releasedAt??this.controlTime;
    if(charge.player!==this.selected)return false;
    if(this.restart?.manual&&this.restart.readyAfter>0){this.restart.queuedKick={type,power:clamp((chargeEnd-charge.start)/(.7/FIELD_SCALE),.12,1),shotStyle:charge.shotStyle};return true;}
    const keeper=this.players[this.selected];if(isHumanKeeper(this,keeper)&&keeper.holdingBall)return startKeeperRelease(this,keeper,type==='pass'||type==='through'?'throw':'sideVolley',clamp((chargeEnd-charge.start)/(.7/FIELD_SCALE),.12,1));
    return this.kick(type,clamp((chargeEnd-charge.start)/(.7/FIELD_SCALE),.12,1),charge.shotStyle);
  }
  dropKeeperBall(){const p=this.players[this.selected];return isHumanKeeper(this,p)&&startKeeperRelease(this,p,'drop',0);}
  modifyShotStyle(style){if(!this.charge||this.charge.type!=='shoot'||!['chip','power','finesse','low','rabona'].includes(style))return false;this.charge.shotStyle=style;return true;}
  modifyKickStyle(style){const allowed={shoot:['chip','power','finesse','low','rabona'],cross:['curl','ground','early','low','bounce'],pass:['curl','lead','flair','drive'],through:['lob','driven']}[this.charge?.type];if(!allowed?.includes(style))return false;this.charge.shotStyle=style;return true;}
  // Tap-release: freeze the charge power when the key goes up so a double-tap window does not add power.
  freezeKickPower(type){if(this.charge?.type!==type)return false;this.charge.releasedAt??=this.controlTime;return true;}
  canTackle(p){return this.mode==='player'&&this.running&&!this.paused&&!this.ended&&this.phase==='play'&&!this.restart&&this.goalWait<=0&&this.cardWait<=0&&!this.kickoffState&&p&&!p.sentOff&&p.index!==0&&this.owner!==p.id&&!p.slide&&(p.tackleCooldown??0)<=0;}
  // Standing tackle (FC: Space). Front-on contact near the ball wins it; from behind risks a foul.
  standTackle(){
    const p=this.players[this.selected];if(!this.canTackle(p)||this.owner<0)return false;
    const victim=this.players[this.owner];if(victim.team===p.team)return false;
    const roll=(this.random??Math.random)(),d=distance(p,this.ball);
    p.tackleAnim=.42;p.tackleCooldown=.8;p.heading=Math.atan2(this.ball.x-p.x,this.ball.z-p.z);this.charge=null;this.pending=null;
    if(d>2.2){p.vx*=.35;p.vz*=.35;return true;}
    const front=(p.x-victim.x)*Math.sin(victim.heading)+(p.z-victim.z)*Math.cos(victim.heading);
    if(front<-.35){if(roll<.6){this.foul(p,victim,6+roll*5);return true;}p.vx*=.35;p.vz*=.35;return true;}
    if(roll>clamp(1-d*.35,.25,.75)){p.vx*=.35;p.vz*=.35;return true;}
    if(d<1.5&&roll<.5){this.owner=p.id;this.possessionTime=0;p.decision=.38;}
    else{const b=this.ball,dx=b.x-victim.x,dz=b.z-victim.z,len=Math.hypot(dx,dz)||1;this.owner=-1;Object.assign(b,{vx:dx/len*5+p.vx*.4,vz:dz/len*5+p.vz*.4,vy:.4,y:.34,shotFlight:null,flightDrag:.9,curveRemaining:0});this.noCatch=0;}
    victim.controlCooldown=.55;victim.vx*=.4;victim.vz*=.4;this.lastTouch=p.id;this.offside=null;this.directRestart=null;this.receiver=-1;this.receiveAssist=0;this.recordEvent('interception',p.team,p.id);
    if(p.team===0){this.selected=p.id;this.manualSelection=false;}return true;
  }
  // Sliding tackle (FC: A while defending). Commits to a line; ball first is clean, player first is a foul.
  slideTackle(){
    const p=this.players[this.selected];if(!this.canTackle(p))return false;
    const input=this.input,strength=Math.hypot(input.x,input.z),toBall=Math.atan2(this.ball.x-p.x,this.ball.z-p.z),heading=strength>.15?Math.atan2(input.x,input.z):toBall;
    p.slide={dx:Math.sin(heading),dz:Math.cos(heading),elapsed:0,duration:.55,recover:.6,hit:false};p.heading=heading;p.tackleCooldown=1.4;this.charge=null;this.pending=null;return true;
  }
  stepSlide(p,dt){
    const sl=p.slide;sl.elapsed+=dt;p.previousX=p.x;p.previousZ=p.z;
    const sliding=sl.elapsed<sl.duration,speed=sliding?10.5*(1-sl.elapsed/sl.duration)+2:0;
    p.vx=sl.dx*speed;p.vz=sl.dz*speed;p.x=clamp(p.x+p.vx*dt,-54,54);p.z=clamp(p.z+p.vz*dt,-35.5,35.5);p.heading=Math.atan2(sl.dx,sl.dz);
    if(sliding&&!sl.hit&&this.phase==='play'&&!this.restart){
      const b=this.ball,carrier=this.owner>=0?this.players[this.owner]:null;
      const dBall=distance(p,b),dBody=carrier?distance(p,carrier):Infinity;
      if(b.y<.9&&dBall<1.55&&(!carrier||carrier.team!==p.team&&dBall<dBody)){
        sl.hit=true;if(carrier){carrier.controlCooldown=.6;carrier.vx*=.3;carrier.vz*=.3;}
        this.owner=-1;Object.assign(b,{vx:sl.dx*9+p.vx*.25,vz:sl.dz*9+p.vz*.25,vy:.5,y:.34,shotFlight:null,flightDrag:.7,curveRemaining:0});
        this.lastTouch=p.id;this.noCatch=.25;this.offside=null;this.directRestart=null;this.receiver=-1;this.receiveAssist=0;this.possessionTime=0;this.recordEvent('interception',p.team,p.id);
      }else if(carrier&&carrier.team!==p.team&&dBody<1.3){
        sl.hit=true;const behind=(p.x-carrier.x)*Math.sin(carrier.heading)+(p.z-carrier.z)*Math.cos(carrier.heading)<-.25;this.foul(p,carrier,(behind?9:6)+speed*.35);
      }
    }
    if(sl.elapsed>=sl.duration+sl.recover)p.slide=null;
  }
  // 침투 (FC: Q, 1~4 angle): one attacker sprints in behind. angle is degrees across the attacker's view,
  // 0 = 왼쪽 터치라인 · 90 = 상대 골대 정면 · 180 = 오른쪽 터치라인. No angle runs at the goal behind the line.
  callRun(angle=null){
    const carrier=this.owner>=0?this.players[this.owner]:null;
    if(this.mode!=='player'||!this.running||this.paused||this.ended||this.phase!=='play'||this.restart||this.goalWait>0||!carrier||carrier.team!==0)return null;
    const s=this.attackSign(0),defenders=this.players.filter(o=>o.team===1&&!o.sentOff).map(o=>o.x*s).sort((a,b)=>b-a),line=Math.max(defenders[1]??30,this.ball.x*s,0);
    const roleBonus={ST:6,LW:5,RW:5,LM:5,RM:5,AM:4,CM:1,LB:-4,RB:-4};
    let runner=null,rank=-Infinity;
    for(const r of this.players){if(r.team!==0||r.index===0||r.sentOff||r.id===carrier.id)continue;
      const score=(roleBonus[r.role]??-10)+r.x*s*.2-Math.max(0,distance(r,carrier)-16)*.55;
      if(score>rank){rank=score;runner=r;}}
    if(!runner)return null;
    let dx,dz;
    if(angle===null){const tx=s*clamp(line+10,runner.x*s+6,48),tz=runner.z*.6,len=Math.hypot(tx-runner.x,tz-runner.z)||1;dx=(tx-runner.x)/len;dz=(tz-runner.z)/len;}
    else{const a=angle*Math.PI/180;dx=s*Math.sin(a);dz=-s*Math.cos(a);}
    const reach=14;runner.runTarget={x:clamp(runner.x+dx*reach,-50,50),z:clamp(runner.z+dz*reach,-32,32)};
    runner.runUntil=this.time+3.5;this.calledRun={id:runner.id,until:runner.runUntil,passed:false};
    this.announce('info','침투',`${this.playerLabel(runner.id)} · ${angle===null?'골대 방향':angle+'°'}`,1.6);
    return runner;
  }
  // Skill moves (Shift + arrows, Q feints, Z + back drag-back, D/A then S fakes) for the human carrier.
  // Each move scripts the player's velocity and the ball's offset in the attacker's frame (f = toward goal,
  // l = attacker's left) and wrong-foots defenders close by.
  startSkill(name,side=1){
    const p=this.players[this.selected],def=SKILLS[name];
    if(!def||this.mode!=='player'||!this.running||this.paused||this.ended||this.phase!=='play'||this.restart||this.goalWait>0||this.kickoffState||this.owner!==p?.id||p.index===0||p.skill)return false;
    this.charge=null;this.pending=null;
    p.skill={name,t:0,dur:def.dur,side:side>=0?1:-1,s:this.attackSign(p.team),released:false,ball:{f:.75,l:0,y:0}};
    p.skillImmuneUntil=this.controlTime+def.dur;
    for(const q of this.players)if(q.team!==p.team&&!q.sentOff&&q.index>0&&distance(q,p)<(def.reach??5.5))q.fooledUntil=this.controlTime+(def.fool??.45);
    if(def.kick)p.kickAnim=.28,p.kickStyle=def.kick;
    return true;
  }
  fakeKick(){
    const p=this.players[this.selected];if(!this.charge||!['shoot','cross'].includes(this.charge.type)||this.owner!==p?.id)return false;
    const kind=this.charge.type,s=this.attackSign(p.team),lateral=-this.input.z*s,back=this.input.x*s<-.3;
    this.charge=null;
    return this.startSkill(back?'scoopTurn':'fakeCut',lateral>=0?1:-1)&&(p.kickStyle=kind==='shoot'?'shoot':'cross',true);
  }
  stepSkill(p,dt){
    const k=p.skill,def=SKILLS[k.name];k.t+=dt;const u=clamp(k.t/k.dur,0,1),s=k.s;
    if(this.owner!==p.id&&!k.released){p.skill=null;return;}
    const m=def.step(u,k.side,k,this,p);
    const vx=s*m.vf,vz=-s*m.vl;p.previousX=p.x;p.previousZ=p.z;
    p.vx+=(vx-p.vx)*Math.min(1,dt*14);p.vz+=(vz-p.vz)*Math.min(1,dt*14);
    p.x=clamp(p.x+p.vx*dt,-54,54);p.z=clamp(p.z+p.vz*dt,-35.5,35.5);
    if(m.heading!==undefined)p.heading=m.heading;else if(Math.hypot(p.vx,p.vz)>.6)p.heading=turn(p.heading,Math.atan2(p.vx,p.vz),dt*10);
    k.ball={f:m.bf??.75,l:m.bl??0,y:m.by??0};
    if(m.release&&!k.released&&this.owner===p.id){k.released=true;const r=m.release,b=this.ball;this.owner=-1;Object.assign(b,{vx:p.vx+s*r.f,vz:p.vz-s*(r.l??0),vy:r.y*FIELD_SCALE,y:Math.max(b.y,.4),shotFlight:null,flightDrag:null,curveRemaining:0});this.lastTouch=p.id;this.noCatch=r.noCatch??.25;this.possessionTime=0;this.receiver=-1;}
    if(u>=1)p.skill=null;
  }
  // Q while defending (기본수비 "수비 도움 요청"): the second defender goes to the ball for a moment.
  callDefensiveHelp(){if(this.mode!=='player'||this.owner<0||this.players[this.owner].team===0)return false;this.helpPressUntil=this.time+2.5;return true;}
  // Shift + arrow while defending: hand control to the teammate in that direction.
  switchToward(dx,dz){
    const p=this.players[this.selected],len=Math.hypot(dx,dz);if(!p||len<.1||this.mode!=='player')return false;
    let best=null,score=-Infinity;
    for(const q of this.players){if(q.team!==0||q.index===0||q.sentOff||q.id===p.id)continue;const d=distance(p,q);if(d>38)continue;const align=((q.x-p.x)*dx+(q.z-p.z)*dz)/(d*len);if(align<.5)continue;const sc=align*10-d*.12;if(sc>score){score=sc;best=q;}}
    if(!best)return false;this.selected=best.id;this.manualSelection=true;this.switchAt=this.time;this.charge=null;return true;
  }
  // Knock-on / first touch (FC: CTRL, or E double-tap): push the ball into space and chase it.
  knockOn(){
    const p=this.players[this.selected];
    if(this.mode!=='player'||!this.running||this.paused||this.ended||this.phase!=='play'||this.restart||this.goalWait>0||this.kickoffState||this.owner!==p?.id||p.index===0||this.charge)return false;
    const input=this.input,strength=Math.hypot(input.x,input.z),dx=strength>.15?input.x/strength:Math.sin(p.heading),dz=strength>.15?input.z/strength:Math.cos(p.heading),b=this.ball,push=Math.max(Math.hypot(p.vx,p.vz),5)+9;
    this.owner=-1;Object.assign(b,{x:p.x+dx*.7,z:p.z+dz*.7,y:.34,vx:dx*push,vz:dz*push,vy:0,shotFlight:null,flightDrag:1.2,curveRemaining:0});
    this.lastTouch=p.id;this.noCatch=.3;this.possessionTime=0;this.receiver=-1;p.kickAnim=.2;p.kickStyle='pass';p.heading=Math.atan2(dx,dz);return true;
  }
  get kickPower(){return this.charge?clamp(((this.charge.releasedAt??this.controlTime)-this.charge.start)/(.7/FIELD_SCALE),.12,1):0;}
  laneClearance(from,to,team) {
    let clearance=12;
    for(const opponent of this.players)if(!opponent.sentOff&&opponent.team!==team)clearance=Math.min(clearance,segmentDistance(opponent,from,to));
    return clearance;
  }
  passTarget(player=this.players[this.selected],power=.35,aim=null) {
    const input=aim??this.input,human=this.mode==='player'&&player.id===this.selected;
    const manual=human&&Math.hypot(input.x,input.z)>.15;
    const recent=null;
    const ax=manual?input.x:recent?recent.x:Math.sin(player.heading),az=manual?input.z:recent?recent.z:Math.cos(player.heading);
    const desired=7+power*31,s=this.attackSign(player.team),defense=this.players.filter(p=>p.team!==player.team&&!p.sentOff).map(p=>p.x*s).sort((a,b)=>b-a),offsideLine=Math.max(0,this.ball.x*s,defense[1]??52.5);
    const candidates=[];
    for(const p of this.players){
      if(p.sentOff||p.team!==player.team||p.id===player.id)continue;
      const d=distance(p,player);if(d<2.8||d>49)continue;
      if(!human&&!this.offsideExempt&&p.x*s>offsideLine+.1)continue;
      const alignment=((p.x-player.x)*ax+(p.z-player.z)*az)/d;
      // Direction stays authoritative. Assistance must not turn a forward pass backwards.
      if((manual||recent)&&alignment<.1)continue;
      const space=Math.min(...this.players.filter(o=>o.team!==p.team).map(o=>distance(o,p)));
      const lane=this.laneClearance(player,p,player.team);
      const forward=clamp((p.x-player.x)*s/15,-1,1),safety=passSafety(this,player,p),safe=(lane>2?3:-5)+clamp(safety,-1,1)*(human?4:13),build=tacticValue(this.tactics[player.team],'buildUp'),desiredDistance=build==='possession'?Math.min(desired,15):build==='direct'?Math.max(desired,24):desired;
      const score=alignment*(manual?21:.8)+Math.min(space,10)*.85+Math.min(lane,5)*2.8+safe+forward*(human?1.8:7)+(!human?Math.max(0,(p.x-player.x)*s)*.12:0)-Math.abs(d-desiredDistance)*.42+(p.index===0?-5:0);
      candidates.push({p,score});
    }
    candidates.sort((a,b)=>b.score-a.score);
    return candidates[0]?.p??null;
  }
  kick(type='shoot',power=.35,shotStyle='auto') {
    if(this.phase==='shootout'){if(this.mode!=='player'||this.paused||this.ended||!this.running||type!=='shoot')return false;return this.shootout.turn===0?this.shootout.strike(this,power):this.shootout.dive(this);}
    if(this.mode!=='player'||!this.running||this.paused||this.ended||this.goalWait>0||this.phase!=='play')return false;
    if(this.kickoffState){this.kickoffState.remaining=0;return true;}
    if(this.cardWait>0)return false;
    if(this.restart)return this.restart.manual?(this.restart.plan?this.releaseDrawnRestart():this.takeRestart(type,power,shotStyle)):false;
    if(this.owner<0&&this.ball.y>1.1){return this.startHeader(this.players[this.selected],type==='pass'?'pass':'shoot');}
    this.pending={type,power,shotStyle,aim:{...this.input},player:this.selected,until:this.time+.28};
    return this.tryUserKick();
  }
  tryUserKick() {
    if(!this.pending)return false;
    if(this.pending.until<this.time||this.pending.player!==this.selected){this.pending=null;return false;}
    const p=this.players[this.selected];if(this.owner!==p.id)return false;
    const {type,power,aim,shotStyle}=this.pending;this.pending=null;return this.strike(p,type,power,aim,null,shotStyle);
  }
  strike(p,type,power=.35,aim=null,preferredTarget=null,shotStyle='auto') {
    const s=this.attackSign(p.team),b=this.ball;b.shotFlight=null;b.flightDrag=null;b.curlX=b.curlZ=b.curveRemaining=0;
    this.offsideSnapshot(p.team,p.id);this.lastKick={type,team:p.team,isShot:type==='shoot'};if(['pass','through','cross','loft'].includes(type))for(const q of this.players)if(q.team!==p.team&&q.index>0)q.ballReactionUntil=this.controlTime+.1+Math.min(.07,distance(q,b)/200);
    let tx=s*53.5,tz=0,speed=33,loft=2.6,kickFlight=0;
    if(['pass','through','cross','loft'].includes(type)){
      const target=preferredTarget&&!preferredTarget.sentOff&&preferredTarget.team===p.team?preferredTarget:type==='cross'?this.crossTarget(p,power,aim):type==='through'?this.throughTarget(p,power,aim):this.passTarget(p,power,aim);
      if(target){
        // Variants: pass lead(Q+S)/flair(C+S)/curl(Z+S) · through lob(Q+W)/driven(Z+W) · cross early(Q+A)/low(AAA)/ground(AA)/curl(Z+A).
        const groundCross=type==='cross'&&shotStyle==='ground',lobThrough=type==='through'&&shotStyle==='lob',d=distance(p,target),airPass=type==='cross'&&!groundCross||type==='loft'||lobThrough;let flight=airPass?clamp(d/(24-power*5),1.05,1.9):clamp(.28+d*.032,.4,1.65);
        let lead=type==='through'?1.05:type==='cross'?.35:shotStyle==='lead'?1.15:.48;
        tx=clamp(target.x+target.vx*flight*lead+(type==='through'?s*(4+power*7):type==='pass'&&shotStyle==='lead'?s*(3+power*4):0),-49,49);
        tz=clamp(target.z+target.vz*flight*lead,-30,30);
        if(type==='cross'){const point=this.crossSpace(p,target,power);tx=point.x;tz=point.z;flight=clamp(Math.max(1.15,Math.hypot(tx-b.x,tz-b.z)/22,distance(target,point)/7.4+.45),1.15,2);if(groundCross)flight*=.72;else if(shotStyle==='early')flight*=.8;else if(shotStyle==='low')flight*=.68;else if(shotStyle==='bounce')flight*=.85;}
        kickFlight=flight;
        let throughPlan=null;if(type==='through'){throughPlan=this.throughSpace(p,target,power,aim);tx=throughPlan.x;tz=throughPlan.z;this.receiveGate=throughPlan.gate;}
        const distanceToTarget=Math.hypot(tx-b.x,tz-b.z),drag=airPass?.12:type==='through'?throughPlan.drag:.32;
        if(type==='through'){flight=throughPlan.flight;if(lobThrough){tx=clamp(tx+s*2,-49,49);flight=clamp(Math.hypot(tx-b.x,tz-b.z)/17,1.1,1.8);}else if(shotStyle==='driven')flight*=.75;}
        if(type==='pass'&&shotStyle==='drive')flight*=.68;
        kickFlight=flight;
        speed=clamp(Math.hypot(tx-b.x,tz-b.z)*drag/(1-Math.exp(-drag*flight)),type==='cross'?10:6,42);
        if(!airPass){b.y=.34;b.flightDrag=type==='through'?throughPlan.drag:.32;}
        const arrive=lobThrough?.6:type==='cross'?(shotStyle==='low'?.75:shotStyle==='early'?1.5:shotStyle==='bounce'?.34:2.05):1.1;
        loft=airPass?(arrive-b.y+(4.905*FIELD_GRAVITY)*flight*flight)/flight:0;
        this.receiver=target.id;this.receiveTarget={x:tx,z:tz};this.receiveAssist=flight+.9;this.receiverInputRevision=this.inputRevision;
        if(type==='through'||type==='pass'&&shotStyle==='lead'){target.runUntil=this.time+flight+1.2;target.runTarget={x:tx,z:tz};}
        if(type==='cross'){this.crossUntil=this.time+flight+1.2;this.crossTeam=p.team;this.crossPoint={x:tx,z:tz};target.runUntil=this.crossUntil;target.runTarget={x:tx,z:tz};}
        if(p.team===0&&this.mode==='player'){this.selected=target.id;this.manualSelection=false;}
      }else{
        const input=aim??this.input,len=Math.hypot(input.x,input.z)||1;
        const dx=Math.hypot(input.x,input.z)>.15?input.x/len:Math.sin(p.heading),dz=Math.hypot(input.x,input.z)>.15?input.z/len:Math.cos(p.heading);
        tx=b.x+dx*(8+power*30);tz=b.z+dz*(8+power*30);speed=18+power*15;loft=type==='cross'&&shotStyle!=='ground'?7:.15;this.receiver=-1;
      }
      if(type==='pass'){b.y=.34;b.flightDrag=.32;loft=0;}
      this.stats.passes[p.team]++;
    }else{
      const keeper=this.players[(1-p.team)*11],input=aim??this.input;
      const inputZ=p.id===this.selected&&this.mode==='player'?input.z:0;
      const human=p.id===this.selected&&this.mode==='player',distanceToGoal=Math.abs(tx-b.x);
      const side=keeper.z+keeper.vz*.12>=0?-1:1;
      tz=this.setPieceContext?this.setPieceContext.aimZ:!human&&Number.isFinite(p.aiShotAimZ)?p.aiShotAimZ:human&&Math.abs(inputZ)>.2?inputZ*3.05:side*(distanceToGoal<14?2.45:2.7)+Math.sin(this.time*1.7+p.id)*.22;
      keeper.reaction=clamp((distance(p,keeper)<14?.07:.16)+(Math.abs(keeper.vz)>2?.04:0)+(keeper.decision>0?.04:0)+(human?.05:0)+Math.sin(this.time*.71+p.id)*.035,.055,.28);speed=clamp(27+power*11+Math.abs(tx-p.x)*.05,29,39);const flight=Math.hypot(tx-b.x,tz-b.z)/speed;loft=clamp(((human?1.15:.6)-b.y+(4.905*FIELD_GRAVITY)*flight*flight)/Math.max(.12,flight),.45,6.8);
      this.stats.shots[p.team]++;this.receiver=-1;p.aiShotAimZ=null;
    }
    this.recordEvent(type,p.team,p.id,{power});observeAction(this,p,type,{x:tx,z:tz});
    if(['pass','through','cross','loft'].includes(type)){this.lastDistribution??=[null,null];this.lastDistribution[p.team]={from:p.id,to:this.receiver,time:this.time};}
    const dx=tx-b.x,dz=tz-b.z,len=Math.hypot(dx,dz)||1;
    Object.assign(b,{vx:dx/len*speed,vz:dz/len*speed,vy:loft});
    // Curl (Z + S / Z + A): constant side spin, with the launch angled out so the ball still arrives on target.
    if((shotStyle==='curl'||shotStyle==='flair')&&['pass','cross'].includes(type)&&kickFlight>0){const k=b.flightDrag&&b.y<=.38?b.flightDrag:.12,a=type==='cross'?5.5:shotStyle==='flair'?3.6:4.2,side=(p.z>=0?-1:1)*(shotStyle==='flair'?-1:1),nx=-dz/len*side,nz=dx/len*side,v0=a/k-a*kickFlight/(1-Math.exp(-k*kickFlight));b.vx+=nx*v0;b.vz+=nz*v0;b.curlX=nx*a;b.curlZ=nz*a;b.curveRemaining=kickFlight;}
    if(type==='shoot')Object.assign(b,planShot(b,{x:tx,z:tz},{power,human:p.id===this.selected&&this.mode==='player',side:p.z>=0?-1:1,style:shotStyle}));
    // 깔아차기 (D, D): keep the shot on the turf instead of the planned arc.
    if(type==='shoot'&&shotStyle==='low'){b.y=.34;b.vy=0;b.shotFlight=null;b.flightDrag=.2;b.vx*=1.06;b.vz*=1.06;}
    p.holdingBall=false;this.owner=-1;this.lastTouch=p.id;this.noCatch=['pass','through','cross','loft'].includes(type)?.14:.22;this.possessionTime=0;p.kickAnim=.28;p.kickStyle=type;p.decision=.55;
    return true;
  }
  throughTarget(p,power=.4,aim=null){
    const s=this.attackSign(p.team),input=aim??(this.mode==='player'&&p.id===this.selected?this.input:{x:s,z:0}),len=Math.hypot(input.x,input.z),ax=len>.15?input.x/len:s,az=len>.15?input.z/len:0;
    const defenders=this.players.filter(o=>o.team!==p.team&&!o.sentOff).map(o=>o.x*s).sort((a,b)=>b-a),line=Math.max(this.ball.x*s,defenders[1]??52.5,0);
    const candidates=this.players.filter(r=>r.team===p.team&&!r.sentOff&&r.id!==p.id&&r.index>0&&distance(p,r)>3&&distance(p,r)<44);
    let best=null,rank=-Infinity;
    for(const r of candidates){const d=distance(p,r),alignment=((r.x-p.x)*ax+(r.z-p.z)*az)/d;if(alignment<.3)continue;
      const point=this.throughSpace(p,r,power,{x:ax,z:az}),lane=this.laneClearance(this.ball,point,p.team),onside=r.x*s<=line+.15;
      const score=alignment*13-Math.abs(d-(9+power*22))*.25+point.score*.65+(onside?12:-30)+(['ST','LW','RW','AM'].includes(r.role)?3:0)+(this.calledRun?.id===r.id&&this.calledRun.until>this.time?6:0);
      if(score>rank){rank=score;best=r;}
    }return best;
  }
  throughSpace(p,receiver,power,aim=null){return planThroughPass(this,p,receiver,power,aim);}
  crossSpace(p,receiver,power=.4){
    const s=this.attackSign(p.team),lead=2+power*4;
    return {x:clamp(receiver.x+s*lead,-48,48),z:clamp(receiver.z+receiver.vz*.25+(Math.abs(receiver.z)>12?-Math.sign(receiver.z)*3:0),-28,28)};
  }
  crossTarget(p,power=.4,aim=null){
    const s=this.attackSign(p.team),input=aim??(this.mode==='player'&&p.id===this.selected?this.input:{x:0,z:0}),manual=Math.hypot(input.x,input.z)>.2;
    const goal={x:s*43,z:clamp(-p.z*.15,-6,6)},ax=manual?input.x:goal.x-p.x,az=manual?input.z:goal.z-p.z,len=Math.hypot(ax,az)||1;
    let best=null,rank=-Infinity;
    for(const r of this.players){if(r.team!==p.team||r.id===p.id||r.sentOff||r.index===0)continue;const d=distance(p,r);if(d<4||d>48)continue;
      const alignment=((r.x-p.x)*ax+(r.z-p.z)*az)/(d*len);if(manual&&alignment<-.15)continue;
      const point=this.crossSpace(p,r,power),score=alignment*(manual?13:10)-distance(point,goal)*.35+(['ST','AM','LW','RW'].includes(r.role)?5:0)+Math.min(this.laneClearance(p,point,p.team),5)*.4;
      if(score>rank){best=r;rank=score;}
    }return best;
  }
  interceptTarget(p){
    const b=this.ball;
    if(this.lastKick?.type==='through'&&p.id===this.receiver&&p.runUntil>this.time&&p.runTarget&&distance(p,b)>2.2){for(let t=.08;t<2.1;t+=.045){const future=predictBall(b,t);if(future.y<1.3&&future.x*this.attackSign(p.team)>Math.max(p.x*this.attackSign(p.team)+3.2,this.receiveGate?this.receiveGate.x*this.attackSign(p.team)+.5:-100)&&distance(p,future)<8.8*t+1.35)return {x:clamp(future.x,-50,50),z:clamp(future.z,-32,32)};}return {...p.runTarget};}
    if(this.lastKick?.type==='cross'&&b.y>1.1){for(let t=.1;t<1.8;t+=.05){const f=predictBall(b,t);if(f.y>1.5&&f.y<2.8&&distance(p,f)<8.5*t+.8)return {x:clamp(f.x,-50,50),z:clamp(f.z,-32,32)};}}
    for(let t=.08;t<1.65;t+=.06){const f=predictBall(b,t);if(f.y<1.25&&distance(p,f)<=7.5*t+1.15)return {x:clamp(f.x,-51,51),z:clamp(f.z,-33,33)};}
    const f=predictBall(b,.35);return {x:clamp(f.x,-51,51),z:clamp(f.z,-33,33)};
  }
  startHeader(p,kind='shoot'){
    if(p.sentOff||p.aerial||(p.headerCooldown??0)>0||distance(p,this.ball)>5)return false;
    const expected=predictBall(this.ball,.28).y,head=2*(p.profile?.height??180)/180;
    p.aerial={kind,elapsed:0,duration:.68,hit:false,maxJump:clamp(expected-head,.12,.8)};p.jump=0;return true;
  }
  updateAerials(dt){
    const b=this.ball;
    for(const p of this.players){
      if(p.sentOff||p.index===0)continue;
      p.headerCooldown=Math.max(0,(p.headerCooldown??0)-dt);p.trap=Math.max(0,(p.trap??0)-dt);p.controlCooldown=Math.max(0,(p.controlCooldown??0)-dt);
      if(p.aerial){p.aerial.elapsed+=dt;p.jump=Math.sin(clamp(p.aerial.elapsed/p.aerial.duration,0,1)*Math.PI)*p.aerial.maxJump;
        if(p.aerial.elapsed>=p.aerial.duration){p.aerial=null;p.jump=0;p.headerCooldown=.55;}continue;
      }
      p.jump=0;
      if(this.lastKick?.type==='loft'&&this.receiver===p.id)continue;
      if(this.owner>=0||b.y<1.15||b.y>4.4||p.headerCooldown>0||p.id===this.selected&&this.mode==='player'&&!(this.receiver===p.id&&this.receiveAssist>0&&this.lastKick?.type==='cross'&&!this.charge))continue;
      const future=predictBall(b,.28),attacking=p.x*this.attackSign(p.team)>20;
      if(future.y>1.45&&future.y<3.3&&distance(p,future)<2.7)this.startHeader(p,attacking?'shoot':p.x*this.attackSign(p.team)<-25?'clear':'pass');
    }
  }
  tryHeaders(before){
    const b=this.ball;
    for(const p of this.players){
      if(!p.aerial||p.aerial.hit||p.sentOff)continue;
      const head={x:p.x,y:.12+2*(p.profile?.height??180)/180+(p.jump??0),z:p.z};
      if(sweepDistance3(head,before,b)>.64)continue;
      if(this.offside?.team===p.team&&this.offside.ids.has(p.id)){this.recordEvent('offside',p.team,p.id);this.setupRestart('indirect',1-p.team,p.x,p.z);this.event='오프사이드';this.announce('offside','오프사이드',this.playerLabel(p.id),5);return true;}
      p.aerial.hit=true;const s=this.attackSign(p.team),kind=p.aerial.kind;
      let target=kind==='pass'?this.passTarget(p,.25):null;
      const tx=target?target.x:kind==='clear'?p.x+s*20:s*53.5,tz=target?target.z:kind==='clear'?(p.z>=0?30:-30):this.players[(1-p.team)*11].z>=0?-2.6:2.6;
      const dx=tx-b.x,dz=tz-b.z,d=Math.hypot(dx,dz)||1,speed=kind==='shoot'?23:kind==='clear'?24:17;
      this.offsideSnapshot(p.team,p.id);Object.assign(b,{shotFlight:null,flightDrag:null,curlX:0,curlZ:0,curveRemaining:0,vx:dx/d*speed,vz:dz/d*speed,vy:kind==='clear'?3.6:kind==='shoot'?-2.5:1});
      this.owner=-1;this.lastTouch=p.id;this.noCatch=.2;this.lastKick={type:'header',team:p.team,isShot:kind==='shoot'};this.recordEvent(kind==='shoot'?'headerShot':kind==='clear'?'clearance':'headerPass',p.team,p.id);this.receiver=target?.id??-1;p.headerCooldown=.65;
      if(kind==='shoot')this.stats.shots[p.team]++;return true;
    }
    return false;
  }
  nearest(team,target,exclude=-1) {
    let best=null,bestDistance=Infinity;
    for(const p of this.players){if(p.sentOff||p.team!==team||p.index===0||p.id===exclude)continue;const d=distance(p,target);if(d<bestDistance){bestDistance=d;best=p;}}
    return best;
  }
  tacticalTarget(p,carrier,pressers) {
    const s=this.attackSign(p.team),b=this.ball,own=carrier?.team===p.team,other=carrier&&carrier.team!==p.team;
    const bx=b.x*s,bz=b.z*s,base=this.basePosition(p),tactic=this.tactics[p.team],build=tacticValue(tactic,'buildUp'),width=tacticValue(tactic,'width'),lineSetting=tacticValue(tactic,'line'),attack=tactic.mentality==='attacking'?6:tactic.mentality==='defensive'?-6:0;
    let x,z,speed=6.7;
    if(p.index===0)return keeperTarget(this,p,carrier);
    const primary=pressers[p.team];
    // Shape first (team-shape.js); the older rules below handle chasers, receivers and crosses.
    const shaped=teamShapeTarget(this,p,carrier,primary);if(shaped)return {x:clamp(shaped.x,-50.3,50.3),z:clamp(shaped.z,-32,32),speed:shaped.speed};
    if(!carrier){
      if(this.receiver===p.id){const intercept=this.interceptTarget(p);x=intercept.x;z=intercept.z;speed=distance(p,b)<8?9.1:7.8;}
      else if(primary?.id===p.id&&!(p.ballReactionUntil>this.controlTime)){const t=clamp(distance(p,b)/18,.05,.6);const intercept=this.interceptTarget(p);x=intercept.x;z=intercept.z;speed=distance(p,b)<8?9.1:7.8;}
      else if(this.lastTouch>=0&&this.players[this.lastTouch].team!==p.team){if(p.ballReactionUntil>this.controlTime)return {x:p.x+p.vx*.08,z:p.z+p.vz*.08,speed:Math.hypot(p.vx,p.vz)};x=s*clamp(bx-12+(p.index>4?8:0),-45,25);p.defensiveLaneZ??=p.z;z=p.defensiveLaneZ*.6+s*base[1]*.18+b.z*.22;speed=7.2;}else if(this.receiver>=0&&this.receiveAssist>0&&p.supportFlight&&this.controlTime-p.supportFlight.at<1.7){x=p.supportFlight.x;z=p.supportFlight.z;speed=p.supportFlight.speed;}else {x=s*clamp(base[0]+bx*.48+10,-43,43);z=s*clamp(base[1]+bz*.22,-29,29);}
      if(this.receiver<0&&this.teamAI?.[p.team]?.secondary===p.id&&distance(p,b)<14){const future=predictBall(b,.5);x=clamp(future.x-s*3.8,-49,49);z=clamp(future.z+(p.z>=b.z?3:-3),-31,31);speed=8.1;}
    }else if(own){
      if(['LB','CB','RB'].includes(p.role)){x=s*clamp(bx-25+attack*.6+(p.index===1||p.index===4?5:0),-38,18);z=s*(base[1]*.9+bz*.13);}
      else if(['LM','RM','LW','RW'].includes(p.role)){
        x=s*clamp(bx+9+attack,-17,43);z=s*(Math.sign(base[1])*26+bz*.06);speed=8.2;
      }else if(['CM','DM','AM'].includes(p.role)){
        const side=Math.sign(base[1])||1;x=s*clamp(bx+attack+(p.role==='DM'||p.index===6?-9:p.role==='AM'?9:2),-32,37);z=s*clamp(bz+side*11,-22,22);speed=7.8;
      }else{
        x=s*clamp(bx+16+attack+(p.index===9?3:0),3,47);
        z=s*clamp(base[1]*.85+bz*.28,-24,24);speed=8.6;
      }
      if(bx>19&&Math.abs(bz)>14&&['ST','AM','LW','RW'].includes(p.role)){
        const lane=p.index%3;x=s*clamp(bx+(lane===0?8:lane===1?4:0),31,46);z=(lane===0?-1:lane===1?1:0)*s*7;speed=8.3;
      }
      if(p.runUntil>this.time&&p.runTarget){x=p.runTarget.x;z=p.runTarget.z;speed=this.calledRun?.id===p.id&&this.calledRun.until>this.time?9.6:8.7;}
      if(this.crossUntil>this.time&&this.crossTeam===p.team&&['ST','AM','LW','RW'].includes(p.role)){x=s*clamp((this.crossPoint?.x??s*41)*s+(p.index%3-1)*2,32,47);z=(this.crossPoint?.z??0)+(p.index%3-1)*6;speed=8.4;}
      // Overlap only when a winger has the ball; the opposite fullback holds cover.
      if(['LB','RB'].includes(p.role)&&carrier&&['LW','RW','LM','RM'].includes(carrier.role)&&Math.sign(base[1]*s)===Math.sign(carrier.z)&&bx>0){x=carrier.x+s*8;z=clamp(carrier.z+(p.index%2?3:-3),-30,30);speed=7.8;}
      // If a defender blocks the receiving lane, step across into an open lane.
      const target={x,z};
      if(this.laneClearance(carrier,target,p.team)<2.2&&p.index>4&&distance(p,target)>3){
        const alternatives=[-5,5].map(offset=>({x,z:clamp(z+offset,-29,29)}));
        alternatives.sort((a,b)=>this.laneClearance(carrier,b,p.team)-this.laneClearance(carrier,a,p.team));
        z=alternatives[0].z;
      }
    }else if(other){
      p.defensiveLaneZ=p.z;
      const pressure=tactic.pressure==='high'?1.3:tactic.pressure==='low'?.8:1;
      if(primary?.id===p.id){
        // Close down from the goal side; at tackling range aim for the exposed ball.
        const close=distance(p,carrier)<4,human=this.mode==='player'&&carrier.team===0&&carrier.id===this.selected;
        // Against the human carrier, defend the space like a person would: hold a goal-side position
        // a few metres off and only step in when he comes close or reaches the danger zone.
        if(human){const ownGoal={x:-s*52.5,z:0},danger=distance(carrier,ownGoal)<34,gap=distance(p,carrier),carry=Math.hypot(carrier.vx,carrier.vz);
          const gx=ownGoal.x-carrier.x,gz=ownGoal.z-carrier.z,gl=Math.hypot(gx,gz)||1,standOff=danger?1.9:gap<6?3.5:7;
          x=carrier.x+gx/gl*standOff+carrier.vx*.12;z=carrier.z+gz/gl*standOff+carrier.vz*.12;
          speed=danger?(close?Math.min(6.8,carry+1.2):Math.min(7.4,7*pressure)):gap<6?Math.min(6.4,carry+.6):5.6;}
        else{x=close?b.x+carrier.vx*.08:carrier.x-s*1.7+carrier.vx*.15;
        z=close?b.z+carrier.vz*.08:carrier.z+carrier.vz*.15;speed=Math.min(8.6,8.2*pressure);}
      }else{
        const line=clamp(bx-11+attack*.4+(lineSetting==='high'?7:lineSetting==='low'?-7:0),-45,20);
        x=s*(p.index<=4?line:clamp(base[0]+(bx+15)*.5-7+attack*.5,-42,35));
        z=s*clamp(base[1]*.78+bz*.27,-26,26);
        const mark=this.marking?.get(p.id);
        if(mark){x=s*clamp(Math.min(mark.x*s-2.2,line+10),-48,32);z=clamp(mark.z*.82+b.z*.08,-27,27);}
        // Midfielders screen the route to goal instead of all chasing the carrier.
        if(['DM','CM','AM'].includes(p.role)&&!mark){x=s*clamp(line+9+(p.role==='AM'?7:0),-33,30);z=s*clamp(base[1]*.7+bz*.22,-22,22);}
        speed=tactic.pressure==='high'?8:tactic.pressure==='low'?6.6:7.4;
      }
    }
    if(!carrier&&this.crossUntil>this.time&&this.crossTeam===p.team&&this.receiver!==p.id&&['ST','AM','LW','RW'].includes(p.role)){x=s*clamp((this.crossPoint?.x??s*41)*s+(p.index%3-1)*2,30,47);z=clamp((this.crossPoint?.z??0)+(p.index%3-1)*6,-18,18);speed=8.5;}
    if(this.formations[p.team]==='custom'&&!(!carrier&&this.receiver>=0&&p.supportFlight&&this.controlTime-p.supportFlight.at<1.7)&&!(p.runUntil>this.time)&&!(own&&bx>19&&Math.abs(bz)>14&&['ST','AM','LW','RW'].includes(p.role))&&!(this.crossUntil>this.time&&this.crossTeam===p.team&&['ST','AM','LW','RW'].includes(p.role))&&primary?.id!==p.id&&p.id!==this.receiver&&!this.marking?.has(p.id)){const depth=own?clamp(bx*.48+12,-10,28):clamp(bx*.45+2,-14,20);x=s*clamp(base[0]*.65+depth+attack*.4,-43,44);z=s*clamp(base[1]*.85+bz*.18,-27,27);}
    if(own&&p.index>4&&!(p.runUntil>this.time)&&!(this.crossUntil>this.time)){
      if(build==='possession'&&['CM','DM','AM'].includes(p.role)){const side=Math.sign(base[1])||((p.index%2)?1:-1);x=carrier.x+s*(p.role==='DM'?-10:p.role==='AM'?9:-3);z=clamp(carrier.z+side*(p.role==='AM'?8:11),-25,25);speed=7.1;}
      if(build==='direct'&&['ST','LW','RW'].includes(p.role)){x=s*clamp(bx+15+(p.index%3)*3,0,47);z=clamp(z+(p.index%2?3:-3),-28,28);speed=8.5;}
      if(build==='counter'&&this.time-(this.possessionWonAt?.[p.team]??0)<7&&['ST','LW','RW','AM'].includes(p.role)){x=s*clamp(bx+18+(p.index%3)*3,0,48);speed=8.8;}
      if(width!=='balanced')z=clamp(z*(width==='wide'?1.2:.74),-29,29);
    }
    if(own&&this.attackPlans?.[p.team]){const planned=attackPosition(this,p,carrier,this.attackPlans[p.team],{x,z,speed});x=planned.x;z=planned.z;speed=planned.speed;}
    // A run the player asked for (Q / 1~4) beats the onside hold and shape logic: timing the pass is the player's job.
    if(this.calledRun?.id===p.id&&this.calledRun.until>this.time&&p.runUntil>this.time&&p.runTarget){
      // Until the pass is played he times the run on the offside line (Law 11), then bursts in behind.
      let rx=p.runTarget.x;if(carrier?.team===p.team){const line=Math.max(0,b.x*s,this.players.filter(o=>o.team!==p.team&&!o.sentOff).map(o=>o.x*s).sort((a,c)=>c-a)[1]??52.5);rx=s*Math.min(rx*s,line-.45);}
      return {x:clamp(rx,-50.3,50.3),z:clamp(p.runTarget.z,-32,32),speed:9.6};}
    if(own){const support=openSupport(this,p,carrier,{x,z,speed});x=support.x;z=support.z;speed=support.speed;}
    if(other){const cover=coverTarget(this,p,carrier,{x,z,speed});x=cover.x;z=cover.z;speed=cover.speed;}
    if(own){const backLine=this.players.filter(o=>o.team!==p.team&&!o.sentOff).map(o=>o.x*s).sort((a,b)=>b-a);x=s*Math.min(x*s,Math.max(bx,backLine[1]??50)-.65);}
    if(own)p.supportFlight={x,z,speed,at:this.controlTime};
    return adaptDefense(this,p,carrier,shapeTarget(this,p,carrier,primary,{x:clamp(x,-50.3,50.3),z:clamp(z,-32,32),speed}));
  }
  assignMarks(carrier,pressers){
    const previous=this.marking;this.marking=new Map();if(!carrier)return;
    const team=1-carrier.team,s=this.attackSign(team),used=new Set();
    const threats=this.players.filter(p=>!p.sentOff&&p.team===carrier.team&&p.index>0&&p.id!==carrier.id&&p.x*s<25)
      .sort((a,b)=>(a.x*s+Math.abs(a.z)*.22)-(b.x*s+Math.abs(b.z)*.22));
    for(const attacker of threats){
      let best=null,rank=Infinity;
      for(const defender of this.players){
        if(defender.sentOff||defender.team!==team||defender.index===0||defender.index>8||defender===pressers[team]||used.has(defender.id))continue;
        const cost=distance(defender,attacker)+(defender.index>4?7:0)-(previous?.get(defender.id)?.id===attacker.id?5:0)+(defender.role==='CB'&&Math.abs(attacker.z)>20?9:0);
        if(cost<rank&&Math.abs(defender.z-attacker.z)<16&&attacker.x*s<Math.max(-28,this.ball.x*s+14)&&Math.abs(attacker.z)<30){best=defender;rank=cost;}
      }
      if(best&&rank<26){this.marking.set(best.id,attacker);used.add(best.id);}
    }
  }
  keeperClearance(p){
    const b=this.ball,s=this.attackSign(p.team),pressure=this.nearest(1-p.team,p),side=p.z!==0?Math.sign(p.z):pressure?(p.z>=pressure.z?1:-1):1;
    const targets=this.players.filter(q=>q.team===p.team&&q.index>0&&!q.sentOff&&(q.x-p.x)*s>8&&distance(q,p)<48).sort((a,b)=>this.laneClearance(p,b,p.team)-this.laneClearance(p,a,p.team));
    const target=targets.find(q=>this.laneClearance(p,q,p.team)>2.5),point=target?{x:target.x+s*2,z:target.z}:{x:clamp(p.x+s*36,-40,40),z:side*26},d=distance(b,point),flight=clamp(d/27,.7,1.9),travel=(1-Math.exp(-.12*flight))/.12;
    Object.assign(b,{y:.34,vx:(point.x-b.x)/travel,vz:(point.z-b.z)/travel,vy:(.7-.34+(4.905*FIELD_GRAVITY)*flight*flight)/flight,shotFlight:null,flightDrag:null,curlX:0,curlZ:0,curveRemaining:0});
    this.owner=-1;this.lastTouch=p.id;this.lastKick={type:'clearance',team:p.team,isShot:false};this.noCatch=.28;this.receiver=target?.id??-1;this.receiveTarget=point;this.receiveAssist=target?flight+1.3:0;this.offside=null;this.directRestart=null;p.holdingBall=false;p.kickAnim=.28;p.decision=.6;p.keeperIntent='clear';this.recordEvent('clearance',p.team,p.id);if(target&&p.team===0&&this.mode==='player')this.selected=target.id;
  }
  updateKeepers(dt){for(const p of this.players)if(p.index===0&&!p.sentOff){
    if(this.owner<0&&!(this.noCatch>0&&this.lastTouch===p.id)&&!p.keeperAction&&p.recover<=0&&!this.lastKick?.isShot&&this.ball.y<1.15&&distance(p,this.ball)<1.6){
      const pressure=this.nearest(1-p.team,this.ball),urgent=pressure&&distance(pressure,this.ball)<4;
      if(!keeperCanHandle(this,p)||urgent){this.keeperClearance(p);continue;}
      this.owner=this.lastTouch=p.id;p.holdingBall=true;p.decision=.35;this.receiver=-1;this.receiveAssist=0;this.possessionTime=0;this.ball.shotFlight=null;this.ball.vx=this.ball.vy=this.ball.vz=0;if(p.team===0&&this.mode==='player')this.selected=p.id;
    }
    updateKeeper(this,p,dt);
  }}
  movePlayer(p,tx,tz,maxSpeed,dt,direct=false) {
    p.previousX=p.x;p.previousZ=p.z;
    const dx=tx-p.x,dz=tz-p.z,d=Math.hypot(dx,dz);
    let vx=0,vz=0;
    const pursuit=!direct&&this.owner<0&&this.ball.y<1.4&&(p.id===this.receiver||this.ballChasers?.includes(p.id)||p.id===this.selected&&this.mode==='player')&&distance(p,this.ball)>.75;
    if(d>.12){const speed=direct||pursuit?maxSpeed:Math.min(maxSpeed,d*2.8);vx=dx/d*speed;vz=dz/d*speed;}
    // Local avoidance preserves passing lanes and prevents teammates piling up.
    if(!direct)for(const other of this.players){
      if(other.sentOff||other.id===p.id)continue;const ox=p.x-other.x,oz=p.z-other.z,dist=Math.hypot(ox,oz);
      const radius=other.team===p.team?(pursuit?1.35:3.1):1.05;
      if(dist>0&&dist<radius){const push=(radius-dist)/radius*(other.team===p.team?3.4:1.1);vx+=ox/dist*push;vz+=oz/dist*push;}
    }
    const profile=p.profile;const physique=profile?clamp(1-(profile.weight-77)*.0014-(profile.height-180)*.0008,.93,1.05):1;vx*=physique;vz*=physique;
    const desired=Math.hypot(vx,vz);if(desired>maxSpeed){vx*=maxSpeed/desired;vz*=maxSpeed/desired;}
    const deltaX=vx-p.vx,deltaZ=vz-p.vz,delta=Math.hypot(deltaX,deltaZ),accel=direct?(desired>.1?48:65):25;
    const factor=delta>0?Math.min(1,accel*dt/delta):1;
    p.vx+=deltaX*factor;p.vz+=deltaZ*factor;
    p.x=clamp(p.x+p.vx*dt,-54,54);p.z=clamp(p.z+p.vz*dt,-35.5,35.5);
    const speed=Math.hypot(p.vx,p.vz);
    if(speed>.2)p.heading=turn(p.heading,Math.atan2(p.vx,p.vz),dt*(direct?23:12));
    p.stride+=speed*dt*1.65;p.targetX=tx;p.targetZ=tz;
  }
  moveCarrierAI(p,dt) {
    if(isHumanKeeper(this,p))return;
    const s=this.attackSign(p.team),pressure=this.nearest(1-p.team,p),gap=pressure?distance(p,pressure):20;
    if(p.keeperAction||p.recover>0)return;
    if(p.firstTouchRunUntil>this.time&&p.firstTouchTarget&&(p.firstTouchTarget.x-p.x)*s>1&&distance(p,p.firstTouchTarget)>1.3){this.movePlayer(p,p.firstTouchTarget.x,p.firstTouchTarget.z,8.9,dt);return;}
    if(p.decision<=0){
      const goalDistance=distance(p,{x:s*52.5,z:0});
      if(p.index===0){if(gap<5||!keeperCanHandle(this,p)){this.keeperClearance(p);return;}this.strike(p,'pass',.45);return;}
      const window=shootingWindow(this,p),shotLane=window.lane;
      const shoot=(goalDistance<18&&Math.abs(p.z)<10&&shotLane>.75)||(goalDistance<31&&Math.abs(p.z)<14&&shotLane>1.2)||(goalDistance<36&&Math.abs(p.z)<10&&gap>5&&shotLane>2)||(goalDistance<12&&gap<3&&Math.abs(p.z)<8&&shotLane>.4);
      if(shoot){const keeper=this.players[(1-p.team)*11],offLine=52.3-Math.abs(keeper.x),style=offLine>7&&goalDistance<23?'chip':goalDistance>25?(shotLane>2&&gap>4?'power':'finesse'):goalDistance>17?'finesse':'auto',power=style==='power'?.82:style==='chip'?.5:.48+(p.index%3)*.08;p.aiShotAimZ=window.z;this.strike(p,'shoot',power,null,null,style);return;}
      const plan=this.attackPlans?.[p.team];
      if(plan?.kind==='cutback'){
        const options=this.players.filter(q=>q.team===p.team&&!q.sentOff&&q.id!==p.id&&q.index>0&&q.x*s>28&&q.x*s<47&&Math.abs(q.z)<11&&passSafety(this,p,q)>-.05).sort((a,b)=>passSafety(this,p,b)-passSafety(this,p,a)-Math.abs(b.x*s-40)*.04+Math.abs(a.x*s-40)*.04);
        if(options[0]&&this.possessionTime>.3){this.strike(p,'pass',.38,null,options[0]);return;}
      }
      if(plan?.kind==='switch'&&plan.opposite!==undefined&&this.possessionTime>.5){const outlet=this.players[plan.opposite],last=this.lastDistribution?.[p.team];if(distance(p,outlet)>23&&(!last||last.from!==outlet.id||this.time-last.time>4)&&this.laneClearance(p,outlet,p.team)>1.3){this.strike(p,'loft',.65,null,outlet);return;}}
      const wall=this.wallPass?.[p.team];
      if(wall?.receiver===p.id&&wall.expires>this.time){const runner=this.players[wall.passer];if(!runner.sentOff&&(runner.x-p.x)*s>2&&passSafety(this,p,runner)>-.03&&this.laneClearance(p,runner,p.team)>1.8){this.wallPass[p.team]=null;this.strike(p,'through',.45,null,runner);return;}}
      if(Math.abs(p.z)>19&&p.x*s>22&&this.possessionTime>.55&&plan?.kind!=='cutback'){const target=this.crossTarget(p,.5);if(target&&passSafety(this,p,target)>-.3){this.strike(p,'cross',.5);return;}}
      const option=bestOutlet(this,p);
      if(option){
        const receiver=option.receiver;
        if(plan?.kind==='oneTwo'&&!this.wallPass[p.team]&&distance(p,receiver)<17){const side=p.z>=(pressure?.z??0)?1:-1;p.runTarget={x:clamp(p.x+s*10,-47,47),z:clamp(p.z+side*4,-27,27)};p.runUntil=this.time+2.3;this.wallPass[p.team]={passer:p.id,receiver:receiver.id,expires:this.time+2.5};}
        this.strike(p,option.type,option.power,null,receiver);return;
      }
      p.decision=.14;
    }
    if(!p.dribbleTarget||p.dribbleUntil<this.time||distance(p,p.dribbleTarget)<1.5){const point=dribbleTarget(this,p);if(gap<5&&point.side&&point.side!==p.dribbleSide)p.feint=.45;p.dribbleSide=point.side;p.dribbleTarget=point;p.dribbleUntil=this.time+.8;}
    p.feint=Math.max(0,(p.feint??0)-dt);const target=p.dribbleTarget,tempo=tacticValue(this.tactics[p.team],'tempo');
    const ahead=this.players.some(q=>q.team===p.team&&!q.sentOff&&q.id!==p.id&&(q.x-p.x)*s>3&&distance(q,p)<27),burst=gap>7&&(ahead||this.attackPlans?.[p.team]?.kind==='counter');
    const carrySpeed=tempo==='controlled'?5.8:tempo==='fast'?(burst?8.1:7.3):6.7;
    this.movePlayer(p,target.x,target.z,!ahead&&gap<4.5?Math.min(carrySpeed,6.1):carrySpeed,dt);
  }

  resolveContacts(dt) {
    for(let iteration=0;iteration<3;iteration++)for(let i=0;i<22;i++)for(let j=i+1;j<22;j++){
      const a=this.players[i],b=this.players[j];if(a.sentOff||b.sentOff)continue;const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz),min=a.wallUntil>this.controlTime&&b.wallUntil>this.controlTime?.62:1.05;
      if(d<min){
        if(iteration===0&&this.owner>=0){const victim=this.players[this.owner],offender=a.id===victim.id?b:b.id===victim.id?a:null;
          if(offender&&offender.team!==victim.team&&offender.index!==0&&this.possessionTime>.45){
            const behind=(offender.x-victim.x)*Math.sin(victim.heading)+(offender.z-victim.z)*Math.cos(victim.heading)<-.25;
            const impact=Math.hypot(offender.vx-victim.vx,offender.vz-victim.vz),speed=Math.hypot(offender.vx,offender.vz);
            if(behind&&speed>7&&impact>8&&distance(offender,this.ball)>1.45){this.foul(offender,victim,impact);return;}
          }
        }
        const nx=d>.001?dx/d:1,nz=d>.001?dz/d:0,amount=(min-d),massA=a.profile?.weight??77,massB=b.profile?.weight??77;
        if(iteration===0&&a.team!==b.team){const relative=(b.vx-a.vx)*nx+(b.vz-a.vz)*nz;if(relative<0){const impulse=Math.min(1.25,-relative*.22);a.vx-=nx*impulse*massB/(massA+massB);a.vz-=nz*impulse*massB/(massA+massB);b.vx+=nx*impulse*massA/(massA+massB);b.vz+=nz*impulse*massA/(massA+massB);}a.jostle=.45;b.jostle=-.45;}
        a.x-=nx*amount*massB/(massA+massB);a.z-=nz*amount*massB/(massA+massB);b.x+=nx*amount*massA/(massA+massB);b.z+=nz*amount*massA/(massA+massB);
      }
    }
    if(this.owner>=0&&this.ball.y<1.15){
      const attacker=this.players[this.owner],keeper=this.players[(1-attacker.team)*11];
      if(!keeper.sentOff&&!keeper.keeperAction&&keeper.x*this.attackSign(keeper.team)<-36&&Math.abs(this.ball.z)<19&&distance(keeper,this.ball)<1.45){
        const dx=this.ball.x-keeper.x,dz=this.ball.z-keeper.z;keeper.heading=Math.atan2(dx,dz);
        keeper.keeperAction={kind:'lowCatch',duration:.7,elapsed:0,side:dz>=0?1:-1,origin:{x:keeper.x,z:keeper.z},target:{...this.ball},contacted:true,catchable:true,contactAt:0};
        keeper.holdingBall=true;keeper.decision=.85;this.owner=keeper.id;this.lastTouch=keeper.id;this.receiver=-1;this.receiveAssist=0;this.offside=this.directRestart=null;this.possessionTime=0;this.ball.vx=this.ball.vz=this.ball.vy=0;
        if(keeper.team===0&&this.mode==='player')this.selected=keeper.id;return;
      }
    }
    if(this.owner>=0&&this.possessionTime>.45){
      const owner=this.players[this.owner];
      // A defender must approach from the ball side, not steal through the body.
      for(const p of this.players){
        if(p.sentOff||p.team===owner.team||p.index===0||p.decision>0||(p.fooledUntil??0)>this.controlTime||(owner.skillImmuneUntil??0)>this.controlTime)continue;
        const d=distance(p,this.ball),front=(p.x-owner.x)*Math.sin(owner.heading)+(p.z-owner.z)*Math.cos(owner.heading);
        // The human carrier only loses the ball to a clear front-on challenge, and not every time.
        if(this.mode==='player'&&owner.team===0&&owner.id===this.selected){if(this.possessionTime<.9||d>1||front<.15||(p.stealCooldown??0)>this.controlTime)continue;if((this.random??Math.random)()>.22){p.stealCooldown=this.controlTime+1;continue;}}
        if(d<1.3&&front>-.05){this.owner=p.id;this.offside=null;this.directRestart=null;this.lastTouch=p.id;this.possessionTime=0;p.decision=.38;this.receiver=-1;if(p.team===0&&this.mode==='player'){this.selected=p.id;this.manualSelection=false;}break;}
      }
    }
    for(const p of this.players){p.x=clamp(p.x,-54,54);p.z=clamp(p.z,-35.5,35.5);p.jostle=(p.jostle??0)*Math.exp(-dt*8);p.kickAnim=Math.max(0,p.kickAnim-dt);p.dive=Math.max(0,p.dive-dt);p.throwAnim=Math.max(0,(p.throwAnim??0)-dt);}
  }
  integrateBall(dt) {
    const b=this.ball;
    const before={x:b.x,z:b.z,y:b.y};
    if(this.owner>=0){
      const p=this.players[this.owner];
      if(p.skill&&!p.skill.released){const k=p.skill,o=k.ball,tx=p.x+k.s*o.f,tz=p.z-k.s*o.l,blend=Math.min(1,dt*22);b.x+=(tx-b.x)*blend;b.z+=(tz-b.z)*blend;b.y+=(.34+o.y-b.y)*blend;b.vx=p.vx;b.vz=p.vz;b.vy=0;this.checkBoundary(before);return;}
      if(p.index===0&&p.holdingBall){const hands=keeperContacts(p).hands,target={x:(hands[0].x+hands[1].x)/2,y:(hands[0].y+hands[1].y)/2,z:(hands[0].z+hands[1].z)/2};const d=Math.hypot(target.x-b.x,target.y-b.y,target.z-b.z),step=Math.min(1,12*dt/(d||1));b.x+=(target.x-b.x)*step;b.y+=(target.y-b.y)*step;b.z+=(target.z-b.z)*step;b.vx=b.vz=b.vy=0;return;}
      const speed=Math.hypot(p.vx,p.vz),lead=.78+(speed>8?.32:0);
      const tx=p.x+Math.sin(p.heading)*lead,tz=p.z+Math.cos(p.heading)*lead;
      const ease=1-Math.exp(-dt*30);
      const d=Math.hypot(tx-b.x,tz-b.z),blend=Math.min(ease,(speed+10)*dt/(d||1)),ground=.34+Math.abs(Math.sin(p.stride*2))*Math.min(.045,speed*.006);
      b.vx=p.vx;b.vz=p.vz;b.x+=(tx-b.x)*blend;b.z+=(tz-b.z)*blend;b.y+=clamp(ground-b.y,-6*dt,6*dt);b.vy=0;
      this.checkBoundary(before);return;
    }
    flightStep(b,dt);
    if(this.tryHeaders(before))return;
    for(const p of this.players)if(p.index===0&&!p.sentOff&&tryKeeperSave(this,p,before))return;
    if(this.checkBoundary(before))return;
    if(b.y>1.65)return;
    let candidate=null,closest=Infinity;
    for(const p of this.players){
      if(p.index===0&&(p.keeperAction||b.vx*this.attackSign(p.team)<-3&&this.lastTouch>=0&&this.players[this.lastTouch].team!==p.team))continue;
      if(this.receiver>=0&&this.receiveAssist>0&&p.id!==this.receiver&&p.team===this.players[this.receiver].team&&distance(this.players[this.receiver],b)<14)continue;
      if(p.sentOff||(p.controlCooldown??0)>0||b.y>1.5*(p.profile?.height??180)/180||this.noCatch>0&&p.id===this.lastTouch)continue;
      const start={x:before.x-(p.previousX??p.x),z:before.z-(p.previousZ??p.z)},end={x:b.x-p.x,z:b.z-p.z};
      const d=segmentDistance({x:0,z:0},start,end),reach=p.id===this.receiver?1.45:1.05;
      if(d<reach&&d<closest){candidate=p;closest=d;}
    }
    if(candidate){
      if(this.offside?.team===candidate.team&&this.offside.ids.has(candidate.id)){this.recordEvent('offside',candidate.team,candidate.id);this.setupRestart('indirect',1-candidate.team,candidate.x,candidate.z);this.event='오프사이드';this.announce('offside','오프사이드',this.playerLabel(candidate.id),5);return;}
      if(this.directRestart?.kicker===candidate.id){this.setupRestart('indirect',1-candidate.team,candidate.x,candidate.z);this.event='연속 터치';return;}
      const relative=Math.hypot(b.vx-candidate.vx*.45,b.vz-candidate.vz*.45),facing=-(b.vx*Math.sin(candidate.heading)+b.vz*Math.cos(candidate.heading))/(Math.hypot(b.vx,b.vz)||1),intended=this.receiver===candidate.id;
      const limit=29+(intended?6:0)+Math.max(0,facing)*2+candidate.stamina/100;
      const hard=relative>Math.min(intended?37:33,limit)||this.lastKick?.isShot&&relative>13;
      if(hard){const speed=Math.hypot(b.vx,b.vz)||1,nx=(b.x-candidate.x),nz=(b.z-candidate.z),side=(nx*b.vz-nz*b.vx)>=0?1:-1;
        const vx=b.vx*.48+candidate.vx*.2+(-b.vz/speed)*side*2.2,vz=b.vz*.48+candidate.vz*.2+(b.vx/speed)*side*2.2;
        Object.assign(b,{vx,vz,vy:.6+relative*.025,shotFlight:null,flightDrag:null,curlX:0,curlZ:0,curveRemaining:0});candidate.controlCooldown=.32;candidate.trap=.08;this.lastTouch=candidate.id;this.noCatch=.2;this.receiver=-1;this.receiveAssist=0;
        // Law 11: a deflection or block by an opponent does not reset offside; a deliberate (heavy) touch does,
        // and a touch by a teammate is a new moment the offside line is judged from.
        if(this.offside?.team===candidate.team)this.offsideSnapshot(candidate.team,candidate.id);else if(!this.lastKick?.isShot)this.offside=null;
        this.directRestart=null;this.recordEvent(this.lastKick?.isShot?'block':'heavyTouch',candidate.team,candidate.id,{speed:Math.round(relative)});if(this.lastKick?.isShot)this.lastKick={...this.lastKick,isShot:false,deflected:true};return;
      }
      const finishCross=intended&&this.lastKick?.type==='cross'&&candidate.x*this.attackSign(candidate.team)>28&&this.receiveAssist>0&&!this.charge;
      const throughRun=intended&&this.lastKick?.type==='through'?{...candidate.runTarget}:null;if(throughRun){candidate.firstTouchTarget=throughRun;candidate.firstTouchRunUntil=this.time+clamp(distance(candidate,throughRun)/9.2,.35,1.1);}
      if(this.receiver===candidate.id)this.recordEvent('received',candidate.team,candidate.id);else if(this.lastTouch>=0&&this.players[this.lastTouch].team!==candidate.team)this.recordEvent('interception',candidate.team,candidate.id);
      this.offside=null;this.directRestart=null;this.owner=candidate.id;const controlledOffset=.65;b.x=candidate.x+Math.sin(candidate.heading)*controlledOffset;b.z=candidate.z+Math.cos(candidate.heading)*controlledOffset;b.vx=candidate.vx;b.vz=candidate.vz;b.y=Math.min(b.y,.6);b.vy=0;b.curveRemaining=0;b.shotFlight=null;b.flightDrag=null;this.lastTouch=candidate.id;this.possessionTime=0;this.receiver=-1;candidate.decision=.18;candidate.trap=.18;candidate.heading=turn(candidate.heading,Math.hypot(candidate.vx,candidate.vz)>1?Math.atan2(candidate.vx,candidate.vz):candidate.heading,.35);
      if(candidate.team===0&&this.mode==='player'){this.selected=candidate.id;this.manualSelection=false;}
      if(finishCross&&b.vy<.6){candidate.kickAnim=.28;this.strike(candidate,'shoot',.32);}
    }
  }
  recoverStamina(dt,resting=false){
    for(const p of this.players){
      if(p.sentOff)continue;
      const speed=resting?0:Math.hypot(p.vx,p.vz),controlled=this.mode==='player'&&p.id===this.selected;
      const sprinting=!resting&&speed>.5&&(controlled?this.input.sprint&&Math.hypot(this.input.x,this.input.z)>.09&&p.stamina>2:speed>8.4);
      const rate=sprinting?-16:speed<.5?13:7;
      p.stamina=clamp(p.stamina+rate*dt,0,100);
    }
  }
  stepRestartPlayers(dt,takerId,context={}){
    const taker=this.players[takerId],elapsed=context.elapsed??0;
    for(const p of this.players){
      p.kickAnim=Math.max(0,p.kickAnim-dt);p.trap=Math.max(0,(p.trap??0)-dt);p.jostle=(p.jostle??0)*Math.exp(-dt*8);p.recover=Math.max(0,(p.recover??0)-dt);
      if(p.id!==takerId)p.throwAnim=Math.max(0,(p.throwAnim??0)-dt);
      if(p.sentOff)continue;if(p.id===takerId){p.vx=p.vz=0;continue;}
      const anchor=context.anchors?.[p.id]??{x:p.x,z:p.z};let x=anchor.x,z=anchor.z,speed=0;
      if(p.id===this.selected&&this.mode==='player'&&Math.hypot(this.input.x,this.input.z)>.09){x=p.x+this.input.x*8;z=p.z+this.input.z*8;speed=this.input.sprint?8.4:6.6;}
      else if(context.support?.includes(p.id)){const i=context.support.indexOf(p.id);x+=Math.sin(elapsed*1.1+i)*1.6;z+=Math.sin(elapsed*.8+i)*.8;speed=2.2;}
      if(context.type!=='throwDelivery'&&p.team!==taker.team){const radius=context.type==='throw'?2:9.15,dx=x-this.ball.x,dz=z-this.ball.z,d=Math.hypot(dx,dz);if(d<radius){x=this.ball.x+dx/(d||1)*radius;z=this.ball.z+dz/(d||1)*radius;}}
      this.movePlayer(p,clamp(x,-51.5,51.5),clamp(z,-33,33),speed,dt,p.id===this.selected);
    }
  }
  step(dt) {
    if(!this.running||this.paused||this.ended)return;
    this.controlTime+=dt;
    if(this.notice){this.notice.remaining-=dt;if(this.notice.remaining<=0)this.notice=null;}
    if(this.highlight){this.highlight.remaining-=dt;if(this.highlight.remaining<=0)this.highlight=null;}
    if(this.phase==='shootout'){this.shootout.step(this,dt);return;}
    if(this.phase==='play'&&this.goalWait<=0&&this.cardWait<=0&&!this.kickoffState){
      this.halfStarted=true;const lost=Boolean(this.restart||this.throwState);
      const due=advanceClock(this,dt*FIELD_SCALE,lost);
      if(this.penaltyInFlight){this.penaltyFlightElapsed+=dt;if(this.restart||this.goalWait>0||this.owner>=0||this.penaltyFlightElapsed>5||Math.abs(this.ball.vx)<2)this.penaltyInFlight=false;}
      if(due&&this.restart?.type!=='penalty'&&!this.penaltyInFlight){this.endHalf();return;}
    }
    if(this.cardWait>0){this.cardWait=Math.max(0,this.cardWait-dt);this.recoverStamina(dt,true);return;}
    if(this.phase==='halftime'){this.halftimeRemaining=Math.max(0,this.halftimeRemaining-dt);if(this.halftimeRemaining===0)this.continueHalf();return;}
    if(this.kickoffState){this.kickoffState.remaining-=dt;if(this.kickoffState.remaining<=0||this.kickoffState.remaining<1.45&&Math.hypot(this.input.x,this.input.z)>.09)this.releaseKickoff();else{this.stepRestartPlayers(dt,this.kickoffState.taker,{type:'kickoff'});return;}}
    if(this.phase!=='play')return;
    if(this.goalWait>0){
      this.goalWait-=dt;stepGoalBall(this,dt);this.recoverStamina(dt,true);
      const scorer=this.players[this.celebratingPlayer],elapsed=(this.celebrationDuration??7)-this.goalWait,group=this.celebrationGroup??[];
      if(scorer){
        const route=this.celebrationRoute,pose=celebrationStep(route,elapsed),groupReady=elapsed>=route.groupAt;
        Object.assign(scorer,{x:pose.x,z:pose.z,vx:pose.vx,vz:pose.vz,heading:pose.heading});scorer.stride+=Math.hypot(pose.vx,pose.vz)*dt*1.65;
        scorer.celebration=pose.poseTime;scorer.celebrationKind=elapsed>route.groupAt+.7?'embrace':this.celebrationKind;
        let hugs=0;
        for(const p of this.players){if(p.sentOff||p.id===scorer.id)continue;const rank=group.indexOf(p.id);p.celebrationLift=0;
          if(p.team===this.celebrationTeam&&rank>=0){const angle=rank/5*Math.PI*2+(this.celebrationVariant??0)*.45,target={x:clamp(scorer.x+Math.cos(angle)*(groupReady?1.45:4.5),-51,51),z:clamp(scorer.z+Math.sin(angle)*(groupReady?1.45:4.5),-32,32)};this.movePlayer(p,target.x,target.z,6.6,dt);const near=groupReady&&distance(p,scorer)<2.4;p.celebration=near?elapsed:0;const groups=[['embrace','embrace','clap','highFive','fistPump'],['embrace','highFive','clap','fistPump','jumpTurn'],['embrace','dance','highFive','embrace','clap']];p.celebrationKind=groups[this.celebrationVariant??0][rank%5];if(near){p.heading=Math.atan2(scorer.x-p.x,scorer.z-p.z);if(p.celebrationKind==='embrace')hugs++;}}
          else {const base=this.basePosition(p),s=this.attackSign(p.team);this.movePlayer(p,base[0]*s,base[1]*s,2.6,dt);p.celebration=0;}
        }
        scorer.celebrationLift=(this.celebrationVariant??0)===0&&hugs>=2&&elapsed>route.groupAt+.5?Math.sin(Math.min(1,(elapsed-route.groupAt-.5)/1.8)*Math.PI)*.5:0;
      }
      if(this.goalWait<=0){for(const p of this.players)p.celebration=0;this.kickoff(this.nextKickoff);this.event='';}return;
    }
    if(this.restart){
      const r=this.restart;r.elapsed=(r.elapsed??0)+dt;this.recoverStamina(dt,true);r.readyAfter=Math.max(0,r.readyAfter-dt);
      if(r.manual&&['throw','goalKick'].includes(r.type)&&r.elapsed>12){r.delayCountdown=Math.max(0,17-r.elapsed);if(r.delayCountdown<=0){this.recordEvent('foul',r.team,r.taker,{reason:'재개 지연'});this.setupRestart(r.type==='throw'?'throw':'corner',1-r.team,r.type==='throw'?r.x:-this.attackSign(r.team)*52.2,r.type==='throw'?r.z:(r.z>=0?33.7:-33.7));return;}}
      this.stepRestartPlayers(dt,r.taker,r);
      if(r.queuedKick&&r.readyAfter<=0){const kick=r.queuedKick;r.queuedKick=null;this.resumeRestart(kick.type,kick.power,kick.shotStyle);return;}
      if(r.manual&&this.selected===r.taker){if(r.type==='throw'){r.throwAngle=clamp((r.throwAngle??0)+this.input.x*1.6*dt,-1.25,1.25);r.aim={x:Math.sin(r.throwAngle),z:-Math.sign(r.z)*Math.cos(r.throwAngle)};this.players[r.taker].heading=Math.atan2(r.aim.x,r.aim.z);}else{const axis=this.input.z||this.input.x;if(axis)r.aimZ=clamp(r.aimZ+axis*3*dt,-5,5);if(Math.hypot(this.input.x,this.input.z)>.1)r.aim={x:this.input.x,z:this.input.z};}}
      if(!r.manual){r.wait-=dt;if(r.wait<=0)this.resumeRestart();}return;
    }
    if(this.throwState){const a=this.throwState,p=this.players[a.taker];a.elapsed+=dt;this.stepRestartPlayers(dt,a.taker,{type:'throwDelivery'});p.throwAnim=Math.max(.01,.65-a.elapsed);
      Object.assign(this.ball,{x:p.x+Math.sin(p.heading)*.15,z:p.z+Math.cos(p.heading)*.15,y:a.height,vx:0,vz:0,vy:0});
      if(a.elapsed>=.65){Object.assign(this.ball,a.velocity);p.throwAnim=.28;this.throwState=null;this.noCatch=.35;}return;
    }
    if(this.owner>=0){const team=this.players[this.owner].team;this.stats.possession[team]+=dt;if(team!==this.lastPossessionTeam){observeLoss(this,this.lastPossessionTeam);this.possessionWonAt[team]=this.time;this.lastPossessionTeam=team;}}
    if(this.input.x||this.input.z)this.lastAim={x:this.input.x,z:this.input.z,time:this.time};
    if(this.owner<0&&this.receiver>=0&&(this.receiveAssist<=0||this.lastTouch>=0&&this.players[this.lastTouch].team!==this.players[this.receiver].team)){this.receiver=-1;this.receiveTarget=null;this.receiveAssist=0;}
    this.updateAutoSelection();
    this.noCatch=Math.max(0,this.noCatch-dt);this.possessionTime+=dt;this.receiveAssist=Math.max(0,this.receiveAssist-dt);
    const carrier=this.owner>=0?this.players[this.owner]:null;if(carrier){observeCarry(this,carrier);const plan=this.attackPlans[carrier.team];if(!plan||plan.carrier!==carrier.id||this.time-plan.createdAt>.5)this.attackPlans[carrier.team]=attackPlan(this,carrier);const link=this.wallPass[carrier.team];if(link&&link.expires<this.time)this.wallPass[carrier.team]=null;}
    const assignments=[coordinateTeam(this,0,carrier),coordinateTeam(this,1,carrier)];
    const pressers=assignments.map(a=>this.players[a.primary]??null);this.ballChasers=pressers.filter(Boolean).map(p=>p.id);updateAutoRuns(this,carrier);
    for(const p of this.players){p.previousX=p.x;p.previousZ=p.z;}
    if(this.charge?.type==='through'&&this.charge.runner!==undefined&&this.owner===this.selected&&this.time-(this.charge.runUpdateAt??0)>.08){const runner=this.players[this.charge.runner];if(!runner.sentOff){const point=this.throughSpace(this.players[this.selected],runner,this.kickPower,this.input);runner.runTarget={x:point.x,z:point.z};runner.runUntil=this.time+.8;}this.charge.runUpdateAt=this.time;}
    this.assignMarks(carrier,pressers);for(const p of this.players)if(p.distribution)stepKeeperRelease(this,p,dt);this.updateKeepers(dt);this.updateAerials(dt);updateWallJumps(this,dt);
    this.tryUserKick();
    for(const p of this.players){
      if(p.sentOff)continue;
      p.decision=Math.max(0,p.decision-dt);p.reaction=Math.max(0,p.reaction-dt);p.tackleCooldown=Math.max(0,(p.tackleCooldown??0)-dt);p.tackleAnim=Math.max(0,(p.tackleAnim??0)-dt);
      if(p.slide){this.stepSlide(p,dt);continue;}
      if((p.keeperAction||p.distribution)&&p.index===0)continue;
      if(p.wallUntil>this.controlTime&&p.id!==this.selected){p.vx=p.vz=0;p.heading=Math.atan2(this.ball.x-p.x,this.ball.z-p.z);continue;}
      if(p.skill){this.stepSkill(p,dt);continue;}
      if(p.id===this.selected&&this.mode==='player'&&(p.index!==0||this.owner===p.id)){
        const input=this.input,strength=Math.hypot(input.x,input.z),sprint=input.sprint&&p.stamina>2;
        const speed=p.index===0&&p.holdingBall?(sprint?5.2:4):(sprint?10.2:7.2)*(this.owner===p.id?.96:1);
        const assisted=this.owner!==p.id&&this.receiver===p.id&&this.receiveAssist>0;
        const loose=this.owner<0&&this.ball.y<4.5,intercept=loose?this.interceptTarget(p):null;
        const toward=intercept?((intercept.x-p.x)*input.x+(intercept.z-p.z)*input.z)/(distance(p,intercept)||1):0;
        if(this.owner===p.id&&p.firstTouchRunUntil>this.time&&strength>.09&&(input.x*this.attackSign(p.team)<-.15||p.firstTouchTarget&&(p.firstTouchTarget.x-p.x)*input.x+(p.firstTouchTarget.z-p.z)*input.z<0)){p.firstTouchRunUntil=0;p.vx*=.3;p.vz*=.3;}
        const carry=this.owner===p.id&&p.firstTouchRunUntil>this.time&&p.firstTouchTarget&&(strength<.09||((p.firstTouchTarget.x-p.x)*input.x+(p.firstTouchTarget.z-p.z)*input.z)>0);
        if(carry)this.movePlayer(p,p.firstTouchTarget.x,p.firstTouchTarget.z,9.2,dt);
        else if(loose&&!assisted&&(distance(p,this.ball)<3.5||strength<.09||toward>.35)){this.movePlayer(p,intercept.x,intercept.z,distance(p,this.ball)<8?9.1:7.8,dt);}
        else if(strength>.09&&!assisted){this.movePlayer(p,p.x+input.x*10,p.z+input.z*10,speed*strength,dt,true);this.receiveAssist=0;}
        else if(assisted){const target=this.tacticalTarget(p,null,pressers);this.movePlayer(p,target.x,target.z,distance(p,this.ball)<8?9.1:8.2,dt);}
        else this.movePlayer(p,p.x,p.z,0,dt,true);
        if(p.index===0&&p.holdingBall){const sign=this.attackSign(p.team);p.x=sign*clamp(p.x*sign,-51,-36.2);p.z=clamp(p.z,-18.5,18.5);}
      }else if(p.id===this.owner)this.moveCarrierAI(p,dt);
      else {const target=this.tacticalTarget(p,carrier,pressers);this.movePlayer(p,target.x,target.z,target.speed,dt);if(p.index===0)p.heading=turn(p.heading,Math.atan2(this.ball.x-p.x,this.ball.z-p.z),dt*14);}
    }
    for(const q of this.players)if(q.fooledUntil>this.controlTime&&!q.skill){q.x-=q.vx*dt*.6;q.z-=q.vz*dt*.6;}
    this.recoverStamina(dt);this.resolveContacts(dt);if(this.restart)return;this.integrateBall(dt);this.updateAutoSelection();this.tryUserKick();
  }
}
