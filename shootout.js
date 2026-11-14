import {FIELD_SCALE,FIELD_GRAVITY} from './visual-scale.js?v=20261114-acro';
import {stepGoalBall} from './goal-effects.js?v=20261114-acro';
import {chooseKeeperAction,updateKeeper,tryKeeperSave} from './keeper.js?v=20261114-acro';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class Shootout {
  constructor(players,{firstTeam=0,random=Math.random}={}){
    this.random=random;this.firstTeam=firstTeam;this.turn=firstTeam;this.score=[0,0];this.attempts=[0,0];this.kicks=[];this.winner=null;
    const eligible=[0,1].map(team=>players.filter(p=>p.team===team&&!p.sentOff));const count=Math.min(...eligible.map(t=>t.length));
    this.participants=eligible.map(team=>team.sort((a,b)=>{const rank=p=>p.index===0?-100:['ST','AM','LW','RW'].includes(p.role)?10:0;return rank(b)-rank(a)||a.index-b.index;}).filter((p,i,all)=>p.index===0||i<count-(all.some(q=>q.index===0)?1:0)).map(p=>p.id));
    this.excluded=eligible.map(team=>team.filter(p=>!this.participants[p.team].includes(p.id)).map(p=>p.id));
    this.keepers=this.participants.map(ids=>ids.find(id=>players[id].index===0)??ids.at(-1));
    this.cautions=Object.fromEntries(this.participants.flat().map(id=>[id,0]));this.stage='prepare';this.wait=3;this.aim=0;this.keeperChoice=0;this.committed=false;
  }
  get kicker(){return this.participants[this.turn][this.attempts[this.turn]%this.participants[this.turn].length];}
  record(scored,details={}){
    if(this.winner!==null)return null;const team=this.turn,entry={team,playerId:this.kicker,scored:Boolean(scored),round:this.attempts[team]+1,...details};this.kicks.push(entry);this.attempts[team]++;if(scored)this.score[team]++;
    const [a,b]=this.attempts,[x,y]=this.score;
    if(a<=5&&b<=5){if(x>y+Math.max(0,5-b))this.winner=0;else if(y>x+Math.max(0,5-a))this.winner=1;}
    if(a>=5&&b>=5&&a===b&&x!==y)this.winner=x>y?0:1;
    this.turn=1-team;return entry;
  }
  prepare(match){
    match.goalNet=null;this.stage='prepare';this.wait=3;this.aim=0;this.keeperChoice=0;this.committed=false;this.elapsed=0;this.saved=false;this.result=null;
    const keeper=match.players[this.keepers[1-this.turn]],kicker=match.players[this.kicker];
    for(const p of match.players){p.vx=p.vz=0;p.keeperAction=null;p.holdingBall=false;p.dive=p.jump=p.celebration=p.celebrationLift=0;p.aerial=null;p.shootoutGoalkeeper=p.id===keeper.id;p.shootoutExcluded=this.excluded[p.team].includes(p.id);p.x=-5+(p.index%4)*2.2;p.z=(p.team===0?-1:1)*(3.2+Math.floor(p.index/4)*1.5);p.heading=Math.PI/2;}
    const otherKeeper=match.players[this.keepers[this.turn]];if(otherKeeper.id!==kicker.id){otherKeeper.x=52.2;otherKeeper.z=21.5;}
    Object.assign(kicker,{x:40.4,z:0,heading:Math.PI/2});Object.assign(keeper,{x:52.25,z:0,heading:-Math.PI/2,decision:0,reaction:0,recover:0});
    Object.assign(match.ball,{x:41.5,z:0,y:.34,vx:0,vz:0,vy:0,shotFlight:null,flightDrag:null,curlX:0,curlZ:0,curveRemaining:0});
    match.owner=kicker.id;match.selected=this.turn===0?kicker.id:keeper.id;match.charge=match.pending=null;match.setInput(0,0);match.notice=null;match.event='승부차기';
  }
  dive(match){
    if(this.committed)return false;this.committed=true;if(this.stage!=='flight')return true;
    const p=match.players[this.keepers[1-this.turn]],side=this.keeperChoice===0?0:Math.sign(this.keeperChoice),targetZ=side*2.7;
    const sample={...match.ball,vz:(targetZ-match.ball.z)/Math.max(.12,(p.x-match.ball.x)/Math.max(1,match.ball.vx))};
    const a=chooseKeeperAction(p,sample,{incoming:true,pressure:1});
    if(a){a.catchable=false;if(side===0)a.kind='reflex';p.keeperAction=a;p.decision=0;p.reaction=0;}
    return true;
  }
  strike(match,power=.5){
    if(this.stage!=='aim')return false;
    const p=match.players[this.kicker],speed=27+clamp(power,.12,1)*10,target=this.aim,dx=53.5-match.ball.x,dz=target-match.ball.z,d=Math.hypot(dx,dz);
    Object.assign(match.ball,{vx:dx/d*speed,vz:dz/d*speed,vy:1.1+power*.6});p.kickAnim=.3;match.owner=-1;match.lastTouch=p.id;this.stage='flight';this.elapsed=0;
    const humanKeeper=this.turn===1&&match.mode==='player',choice=this.keeperChoice;
    if(!humanKeeper){const r=this.random();this.keeperChoice=r<.16?0:r<.58?-1:1;}
    const wasCommitted=this.committed;this.committed=false;if(!humanKeeper||wasCommitted){this.dive(match);}else this.keeperChoice=choice;
    return true;
  }
  finishKick(match,scored,reason){
    if(this.stage!=='flight')return;const team=this.turn,p=match.players[this.kicker],entry=this.record(scored,{reason,name:p.name,number:p.number});
    match.recordEvent(scored?'penaltyGoal':'penaltyMiss',team,p.id,{round:entry.round,reason,shootout:true});this.stage='result';this.wait=2.2;this.result=entry;match.charge=null;
    match.announce(scored?'goal':'info',scored?'승부차기 성공':'승부차기 실패',`${p.number}번 ${p.name}`,2.2);match.notice.team=team;if(scored){match.goalNet={side:1,elapsed:0,hitAt:null,strength:Math.min(1.4,Math.hypot(match.ball.vx,match.ball.vz)/25),impact:{y:match.ball.y,z:match.ball.z}};}else match.ball.vx=match.ball.vz=match.ball.vy=0;
  }
  step(match,dt){
    for(const p of match.players)p.kickAnim=Math.max(0,(p.kickAnim??0)-dt);
    const axis=match.input.x||match.input.z;
    if(this.stage==='prepare'||this.stage==='aim'){
      if(this.turn===0&&match.mode==='player')this.aim=clamp(this.aim+axis*3.2*dt,-4.6,4.6);
      if(this.turn===1&&match.mode==='player'&&!this.committed)this.keeperChoice=Math.abs(axis)>.1?Math.sign(axis):this.keeperChoice;
      if(this.stage==='prepare'){this.wait-=dt;if(this.wait<=0){this.stage='aim';this.wait=1.1;}}
      else if(this.turn===1||match.mode==='manager'){this.wait-=dt;if(this.wait<=0){const r=this.random();this.aim=(r-.5)*7.3;this.strike(match,.35+this.random()*.5);}}
      return;
    }
    if(this.stage==='result'){
      stepGoalBall(match,dt);this.wait-=dt;if(this.wait<=0){if(this.winner!==null){match.winner=this.winner;match.ended=true;match.phase='finished';match.event='승부차기 종료';match.recordEvent('shootoutEnd',this.winner,-1,{score:[...this.score]});}else this.prepare(match);}return;
    }
    this.elapsed+=dt;
    const p=match.players[this.keepers[1-this.turn]],b=match.ball,before={...b};
    if(this.turn===1&&match.mode==='player'&&!this.committed&&Math.abs(axis)>.1)this.keeperChoice=Math.sign(axis);
    // A late neutral reaction can block the body line but does not read the chosen corner.
    if(!this.committed&&this.elapsed>.13){this.keeperChoice=0;this.dive(match);}
    if(p.keeperAction)updateKeeper(match,p,dt);
    b.x+=b.vx*dt;b.z+=b.vz*dt;b.y+=b.vy*dt;b.vy-=(9.81*FIELD_GRAVITY)*dt;if(b.y<.34){b.y=.34;b.vy=Math.max(0,-b.vy*.25);}const drag=Math.exp(-.12*dt);b.vx*=drag;b.vz*=drag;
    if(p.keeperAction&&!this.saved){const adapter={ball:b,players:match.players,owner:-1,lastTouch:match.lastTouch,lastKick:{type:'shoot'},stats:{saves:[0,0]},attackSign:team=>team===this.turn?1:-1,noCatch:0,recordEvent(){}};
      if(tryKeeperSave(adapter,p,before)){this.saved=true;b.x=Math.min(b.x,52.5);p.holdingBall=false;}
    }
    if(b.x>52.84){const f=clamp((52.84-before.x)/(b.x-before.x||1),0,1),z=before.z+(b.z-before.z)*f,y=before.y+(b.y-before.y)*f;this.finishKick(match,Math.abs(z)<3.32&&y<2.16,Math.abs(z)>=3.32?'골문 밖':y>=2.16?'골문 위':'골');}
    else if(this.saved&&b.vx<0||b.x<40||Math.abs(b.z)>8||this.elapsed>3.5)this.finishKick(match,false,this.saved?'선방':'골문 밖');
  }
}
