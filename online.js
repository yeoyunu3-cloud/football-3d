// Online 1 vs 1 over WebRTC (PeerJS). No game server: the two browsers connect directly.
//  - The host creates a room (name + optional password) and runs the whole match as the home team.
//  - The guest joins by room name, plays the away team, sends inputs and draws the host's snapshots.
// The PeerJS cloud is used only to introduce the two browsers to each other (the room name is sent to it).
const PEER_SRC='https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',PREFIX='football3d-room-',SNAPSHOT_MS=50,INPUT_MS=90,SILENCE_MS=8000;
const roomId=name=>PREFIX+String(name).trim().toLowerCase().replace(/[^a-z0-9가-힣_-]/g,'').replace(/[가-힣]/g,c=>c.charCodeAt(0).toString(36));
export const validRoomName=name=>/^[a-zA-Z0-9가-힣_-]{2,20}$/.test(String(name).trim());
// Same-computer test path: a room whose name starts with "local-" links two tabs of one browser through a
// BroadcastChannel instead of WebRTC. It behaves like a PeerJS connection (send / on('data') / on('close')).
const isLocalRoom=name=>String(name).trim().toLowerCase().startsWith('local-');
function localConn(name,side){
  const channel=new BroadcastChannel(roomId(name)),handlers={data:[],close:[],open:[]},conn={open:true,local:true,send(m){channel.postMessage({from:side,m});},on(event,fn){handlers[event]?.push(fn);},close(){if(!conn.open)return;conn.open=false;channel.postMessage({from:side,bye:true});channel.close();handlers.close.forEach(fn=>fn());}};
  channel.onmessage=e=>{if(e.data?.from===side)return;if(e.data.bye){handlers.close.forEach(fn=>fn());return;}handlers.data.forEach(fn=>fn(e.data.m));};
  addEventListener('pagehide',()=>conn.close());
  return conn;
}
let peerScript=null;
function loadPeer(){
  if(window.Peer)return Promise.resolve();
  peerScript??=new Promise((resolve,reject)=>{const tag=document.createElement('script');tag.src=PEER_SRC;tag.onload=()=>resolve();tag.onerror=()=>{peerScript=null;reject(new Error('연결 모듈을 불러오지 못했습니다. 인터넷 연결을 확인하세요.'));};document.head.append(tag);});
  return peerScript;
}

import {createLobby} from './lobby.js?v=20261114-fix3';
export function createOnline({match,getClub,launch,onStatus,onClosed,onRooms,onLobbyState}){
  const lobby=createLobby({onRooms,onState:onLobbyState});
  const listed=()=>state.room&&!isLocalRoom(state.room);
  const announce=status=>{if(listed())lobby.announce({name:state.room,locked:Boolean(state.password),status,team:getClub()?.name});};
  const state={role:null,peer:null,conn:null,room:'',password:'',timer:null,lastInput:0,sentInput:'',lastSeen:0};
  const status=(text,kind='info')=>onStatus?.(text,kind);
  const send=message=>{if(state.conn?.open)state.conn.send(message);};
  function close(reason=''){
    clearInterval(state.timer);state.timer=null;try{state.conn?.close();}catch{}try{state.peer?.destroy();}catch{}
    const role=state.role;if(role==='host'||role==='host-waiting')lobby.withdraw(state.room);state.role=null;state.conn=null;state.peer=null;
    if(role==='host')match.setRemote(false);
    if(reason)onClosed?.(reason,role);
  }
  // ---- Host ----
  async function createRoom(name,password=''){
    close();if(!isLocalRoom(name))await loadPeer();state.room=name.trim();state.password=password;
    return new Promise((resolve,reject)=>{
      const accept=conn=>{
        conn.on('data',message=>{
          if(message?.t==='hello'){
            if(state.conn&&state.conn!==conn){conn.send({t:'reject',reason:'방이 가득 찼습니다.'});if(!conn.local)setTimeout(()=>conn.close(),300);return;}
            if(state.password&&message.password!==state.password){conn.send({t:'reject',reason:'비밀번호가 틀렸습니다.'});if(!conn.local)setTimeout(()=>conn.close(),300);return;}
            state.conn=conn;state.role='host';conn.send({t:'welcome',club:getClub()});announce('playing');
            conn.on('close',()=>close('상대가 나갔습니다. 남은 경기는 AI가 상대합니다.'));
            match.setRemote(true);launch('host',getClub(),message.club);match.setRemote(true);
            state.lastSeen=performance.now();clearInterval(state.timer);state.timer=setInterval(()=>{
              // No word from the guest for a while (closed tab, lost network): hand the away team back to the AI.
              if(performance.now()-state.lastSeen>SILENCE_MS){close('상대와의 연결이 끊겼습니다. 남은 경기는 AI가 상대합니다.');return;}
              if(state.conn?.open&&(match.running||match.ended))send({t:'s',d:match.netSnapshot()});},SNAPSHOT_MS);
            status('상대가 들어왔습니다. 경기를 시작합니다.','ok');return;
          }
          if(conn!==state.conn||!match.remote)return;state.lastSeen=performance.now();
          // Guest inputs. Everything is clamped or looked up by the engine, never trusted as-is.
          if(message.t==='i'){const x=Math.max(-1,Math.min(1,Number(message.x)||0)),z=Math.max(-1,Math.min(1,Number(message.z)||0));match.remote.input={x,z,sprint:Boolean(message.s),shield:Boolean(message.h),dummy:Boolean(message.d)};}
          else if(message.t==='k')match.remoteKick(String(message.type),Number(message.power)||.4,message.aim&&{x:Number(message.aim.x)||0,z:Number(message.aim.z)||0},String(message.style??'auto'));
          else if(message.t==='tk')match.remoteTackle(Boolean(message.slide));
          else if(message.t==='sw')match.remoteSwitch();
          else if(message.t==='ru')match.keeperRush(1);
          else if(message.t==='sk')match.remoteSkill(String(message.name),Number(message.side)>=0?1:-1);
        });
      };
      if(isLocalRoom(name)){state.role='host-waiting';state.peer={destroy(){}};accept(localConn(name,'host'));status(`방 "${state.room}" 을 만들었습니다 (같은 컴퓨터 테스트용). 상대를 기다리는 중…`,'wait');resolve();return;}
      const peer=new window.Peer(roomId(name));state.peer=peer;state.role='host-waiting';
      peer.on('open',()=>{status(`방 "${state.room}" 을 만들었습니다. 상대를 기다리는 중…`,'wait');announce('waiting');resolve();});
      peer.on('error',error=>{const taken=error.type==='unavailable-id';close();reject(new Error(taken?'같은 이름의 방이 이미 있습니다. 다른 이름을 쓰세요.':`방을 만들지 못했습니다 (${error.type??'오류'}).`));});
      peer.on('connection',accept);
    });
  }
  // ---- Guest ----
  async function joinRoom(name,password=''){
    close();if(!isLocalRoom(name))await loadPeer();state.room=name.trim();
    return new Promise((resolve,reject)=>{
      state.role='guest-joining';let done=false;
      const fail=text=>{if(done)return;done=true;close();reject(new Error(text));};
      const timeout=setTimeout(()=>fail('방에 연결하지 못했습니다. 방 이름을 확인하세요. 이름이 맞다면 두 사람의 네트워크가 직접 연결을 막고 있을 수 있습니다.'),15000);
      const wire=conn=>{
        conn.on('data',message=>{
          if(message?.t==='reject'){clearTimeout(timeout);fail(message.reason??'입장이 거부되었습니다.');return;}
          if(message?.t==='welcome'){clearTimeout(timeout);done=true;state.role='guest';launch('guest',message.club,getClub());becomePuppet();status('방에 들어왔습니다. 원정 팀으로 플레이합니다.','ok');resolve();return;}
          if(message?.t==='s'&&state.role==='guest'){match.netState=message.d;state.lastSeen=performance.now();}
        });
        conn.on('close',()=>{if(state.role==='guest')close('방장과의 연결이 끊겼습니다.');else fail('연결이 끊겼습니다.');});
      };
      if(isLocalRoom(name)){const conn=localConn(name,'guest');state.conn=conn;state.peer={destroy(){}};wire(conn);conn.send({t:'hello',password,club:getClub()});return;}
      const peer=new window.Peer();state.peer=peer;
      peer.on('error',error=>fail(error.type==='peer-unavailable'?'그런 이름의 방이 없습니다.':`접속하지 못했습니다 (${error.type??'오류'}).`));
      peer.on('open',()=>{
        const conn=peer.connect(roomId(name),{reliable:true});state.conn=conn;
        conn.on('open',()=>conn.send({t:'hello',password,club:getClub()}));wire(conn);
      });
    });
  }
  // The guest's match never simulates. Its action methods become messages to the host; everything it
  // shows comes from snapshots (see Match.applyNet).
  function becomePuppet(){
    match.netGuest=true;match.netState=null;state.lastSeen=performance.now();
    // Keep-alive to the host, and give up if the host goes silent.
    clearInterval(state.timer);state.timer=setInterval(()=>{send({t:'p'});if(performance.now()-state.lastSeen>SILENCE_MS)close('방장과의 연결이 끊겼습니다.');},1000);
    match.setInput=(x,z,sprint=false,mods={})=>{const len=Math.hypot(x,z),nx=len>1?x/len:x,nz=len>1?z/len:z;match.input={x:nx,z:nz,sprint,shield:Boolean(mods.shield),dummy:Boolean(mods.dummy)};const key=`${nx.toFixed(2)},${nz.toFixed(2)},${sprint?1:0},${mods.shield?1:0},${mods.dummy?1:0}`,now=performance.now();if(key!==state.sentInput||now-state.lastInput>INPUT_MS*3){state.sentInput=key;state.lastInput=now;send({t:'i',x:nx,z:nz,s:sprint,h:Boolean(mods.shield),d:Boolean(mods.dummy)});}};
    match.kick=(type='shoot',power=.35,style='auto')=>{send({t:'k',type,power,style,aim:{x:match.input.x,z:match.input.z}});match.charge=null;return true;};
    match.startHeader=(player,kind='shoot')=>{send({t:'k',type:kind==='pass'?'pass':'shoot',power:.5,style:'auto',aim:{x:match.input.x,z:match.input.z}});return true;};
    match.standTackle=()=>{send({t:'tk',slide:false});return true;};
    match.slideTackle=()=>{send({t:'tk',slide:true});return true;};
    match.switchPlayer=()=>{send({t:'sw'});return true;};
    match.keeperRush=()=>{send({t:'ru'});return true;};
    match.switchToward=()=>{send({t:'sw'});return true;};
    match.startSkill=(name,side=1)=>{send({t:'sk',name,side});return true;};
    match.fakeKick=variant=>{if(!match.charge)return false;match.charge=null;send({t:'sk',name:variant??'fakeCut',side:-match.input.z*match.attackSign(1)>=0?1:-1});return true;};
    for(const name of ['callRun','openRunMenu','knockOn','callDefensiveHelp','wallJump','dropKeeperBall','skipCelebration','start','togglePause'])match[name]=()=>false;
  }
  return {createRoom,joinRoom,close,async openLobby(){try{await loadPeer();lobby.start();}catch(error){onLobbyState?.('unavailable');}},refreshLobby(){lobby.refresh();},get role(){return state.role;},get room(){return state.room;},get active(){return state.role==='host'||state.role==='guest';},get isGuest(){return state.role==='guest';}};
}
