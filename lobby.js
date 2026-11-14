// Room list without a game server. One browser at a time holds a well-known PeerJS id and acts as the
// directory: hosts announce their rooms to it, and everyone with the online screen open gets the list.
// If the directory browser leaves, the others race to claim the id and the hosts announce again, so the
// list rebuilds within a few seconds. Room passwords are never sent here; only a "locked" flag is.
const LOBBY_ID='football3d-lobby-v1',ANNOUNCE_MS=4000,EXPIRE_MS=13000,MAX_ROOMS=60;
const clean=(value,max)=>String(value??'').replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,max);
function sanitizeRoom(raw){
  const name=clean(raw?.name,20);if(!/^[a-zA-Z0-9가-힣_-]{2,20}$/.test(name))return null;
  return {name,locked:Boolean(raw.locked),status:raw.status==='playing'?'playing':'waiting',team:clean(raw.team,30)};
}

export function createLobby({onRooms,onState,Peer=()=>window.Peer}={}){
  const s={peer:null,link:null,directory:false,rooms:new Map(),subs:new Set(),mine:new Map(),timers:[],retry:null,started:false,stopped:false};
  const list=()=>[...s.rooms.values()].sort((a,b)=>(a.status===b.status?0:a.status==='waiting'?-1:1)||a.name.localeCompare(b.name)).map(({name,locked,status,team})=>({name,locked,status,team}));
  const publish=()=>onRooms?.(list());
  const state=text=>onState?.(text);
  // ---- Directory side ----
  function upsert(raw,owner){const room=sanitizeRoom(raw);if(!room)return;if(!s.rooms.has(room.name)&&s.rooms.size>=MAX_ROOMS)return;const prev=s.rooms.get(room.name);if(prev&&prev.owner!==owner&&Date.now()-prev.at<EXPIRE_MS)return;s.rooms.set(room.name,{...room,owner,at:Date.now()});}
  function broadcast(){const rooms=list();for(const c of s.subs)if(c.open)c.send({t:'rooms',rooms});publish();}
  function sweep(){let changed=false;for(const [name,r] of s.rooms)if(Date.now()-r.at>EXPIRE_MS){s.rooms.delete(name);changed=true;}if(changed)broadcast();}
  function becomeDirectory(){
    s.directory=true;s.rooms.clear();for(const room of s.mine.values())upsert(room,'self');state('directory');broadcast();
    s.peer.on('connection',c=>{
      s.subs.add(c);
      c.on('open',()=>c.send({t:'rooms',rooms:list()}));
      c.on('data',m=>{if(m?.t==='announce'){upsert(m.room,c.peer);broadcast();}else if(m?.t==='remove'){const r=s.rooms.get(clean(m.name,20));if(r&&r.owner===c.peer){s.rooms.delete(r.name);broadcast();}}else if(m?.t==='list')c.send({t:'rooms',rooms:list()});});
      c.on('close',()=>{s.subs.delete(c);let changed=false;for(const [name,r] of s.rooms)if(r.owner===c.peer){s.rooms.delete(name);changed=true;}if(changed)broadcast();});
    });
  }
  // ---- Client side ----
  function becomeClient(){
    const PeerClass=Peer();const peer=new PeerClass();s.peer=peer;s.directory=false;
    peer.on('open',()=>{
      const link=peer.connect(LOBBY_ID,{reliable:true});s.link=link;
      link.on('open',()=>{state('client');link.send({t:'list'});for(const room of s.mine.values())link.send({t:'announce',room});});
      link.on('data',m=>{if(m?.t==='rooms'&&Array.isArray(m.rooms)){s.rooms=new Map(m.rooms.map(sanitizeRoom).filter(Boolean).slice(0,MAX_ROOMS).map(r=>[r.name,r]));publish();}});
      link.on('close',()=>restart(400+Math.random()*1200));
    });
    // The id is taken but nobody answers (the old directory just left): try to take it over.
    peer.on('error',e=>{if(e?.type==='peer-unavailable'||e?.type==='network'||e?.type==='server-error'||e?.type==='socket-error')restart(1500+Math.random()*1500);});
  }
  function claim(){
    if(s.stopped)return;const PeerClass=Peer();if(!PeerClass){state('unavailable');return;}
    const peer=new PeerClass(LOBBY_ID);s.peer=peer;
    peer.on('open',()=>becomeDirectory());
    peer.on('error',e=>{if(s.peer!==peer)return;if(e?.type==='unavailable-id'){try{peer.destroy();}catch{}becomeClient();}else restart(3000);});
  }
  function teardown(){try{s.link?.close();}catch{}try{s.peer?.destroy();}catch{}s.peer=null;s.link=null;s.directory=false;s.subs.clear();}
  function restart(delay){if(s.stopped)return;clearTimeout(s.retry);teardown();state('reconnecting');s.retry=setTimeout(claim,delay);}
  function send(m){if(s.directory){if(m.t==='announce')upsert(m.room,'self');else if(m.t==='remove')s.rooms.delete(m.name);broadcast();}else if(s.link?.open)s.link.send(m);}
  return {
    start(){if(s.started)return;s.started=true;s.stopped=false;claim();
      s.timers.push(setInterval(()=>{for(const room of s.mine.values())send({t:'announce',room});if(s.directory)sweep();},ANNOUNCE_MS));
      addEventListener('pagehide',()=>this.stop());},
    stop(){s.stopped=true;s.started=false;clearTimeout(s.retry);s.timers.forEach(clearInterval);s.timers=[];for(const name of s.mine.keys())send({t:'remove',name});teardown();},
    announce(room){const r=sanitizeRoom(room);if(!r)return;s.mine.set(r.name,r);send({t:'announce',room:r});},
    withdraw(name){if(!s.mine.delete(name))return;send({t:'remove',name});},
    refresh(){if(s.link?.open)s.link.send({t:'list'});else publish();},
    get rooms(){return list();},get isDirectory(){return s.directory;},
  };
}
