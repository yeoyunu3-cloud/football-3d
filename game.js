import {loadLearning,saveLearning} from './opponent-adaptation.js?v=20261112-20-release';
import {fillEventRow} from './event-format.js?v=20261112-20-release';
import {applyClub,defaultClub} from './roster.js?v=20261112-20-release';
import {applyKeeperRig,applyCelebrationRig,applyDistributionRig} from './player-presentation.js?v=20261112-20-release';
import {VISUAL_SCALE,ballRenderY,followHeading} from './visual-scale.js?v=20261112-20-release';
import {loadRealPlayerAssets,buildRealAthlete,applyRealAppearance,updateRealPlayer} from './real-player-model.js?v=20261113-fc2';
import {locomotionPose,dampJoint} from './player-motion.js?v=20261112-20-release';
import {paintKit} from './kit-art.js?v=20261112-20-release';
import {KIT_PRESETS,resolveKitClash} from './kits.js?v=20261112-20-release';
import {TACTIC_OPTIONS,TACTIC_LABELS} from './tactics.js?v=20261112-20-release';
import {netOffset} from './goal-effects.js?v=20261112-20-release';
import {CONTROL_PRESETS,DEFAULT_PRESET,DOUBLE_TAP_MS,validPreset,keyLabel,actionFor,runAngleFor,movement,isCancelCombo,kickStyleFor,shotModKeys,shotStyleFor,SHOT_LABELS,KICK_LABELS} from './controls.js?v=20261113-angles';
import * as THREE from './vendor/three.module.min.js';
import { Match, FORMATION, NAMES, ROLES, NUMBERS } from './match.js?v=20261113-zonal';
import {unlockBallSound,playTouch,playTrap,playKick} from './ball-sound.js?v=20261113-1';
import { initHome,eventText,EVENT_LABELS,IMPORTANT_EVENTS } from './home.js?v=20261112-20-release';
import { saveMatch } from './squads.js?v=20261112-20-release';
import { notify,textNode } from './ui.js?v=20261112-20-release';
import {DRAWABLE_RESTARTS,kickPreview} from './setpieces.js?v=20261112-20-release';
import {officialStep,celebrationPose} from './presentation.js?v=20261112-20-release';
import { keeperPose } from './keeper.js?v=20261112-20-release';
const match = new Match();

const $ = id => document.getElementById(id);
const message = text => { $('message').textContent = text; };
for(const [key,options] of Object.entries(TACTIC_OPTIONS))for(const [host,prefix] of [[$('manager-setup'),'setup-'],[$('tactics-panel'),'']]){const label=document.createElement('label'),select=document.createElement('select');label.append(TACTIC_LABELS[key]);select.id=prefix+key;for(const [value,name] of options){const option=document.createElement('option');option.value=value;option.textContent=name;select.append(option);}select.value='balanced';label.append(select);host.append(label);if(!prefix)select.onchange=()=>match.setTactic(key,select.value);}

$('tactics-panel').append(document.querySelector('.match-stats'));
let controlPreset=DEFAULT_PRESET;try{controlPreset=validPreset(localStorage.getItem('soccer-controls'));}catch{}
const controls=()=>CONTROL_PRESETS[controlPreset];
function showControls(){const c=controls();const entries=[[c.move,'이동'],[keyLabel(c.sprint),'달리기'],[keyLabel(c.switch),'선수 전환'],[keyLabel(c.pass),'패스'],[keyLabel(c.through),'스루패스'],[keyLabel(c.cross),'크로스'],[keyLabel(c.shoot),'슛·헤딩'],['Esc','경기 메뉴']];for(const host of [$('player-setup'),document.querySelector('.controls-hint')]){host.replaceChildren(...entries.map(([key,label])=>{const span=document.createElement('span'),kbd=document.createElement('kbd');kbd.textContent=key;span.append(kbd,` ${label}`);return span;}));{const extra=document.createElement('small');extra.className='shot-controls';extra.textContent=c.shotMods.map(([key,style])=>`${keyLabel(key)} + ${keyLabel(c.shoot)} ${SHOT_LABELS[style]}`).join(' · ')+(c.runCall?` · ${keyLabel(c.runCall)} 침투 · ${Object.entries(c.runAngles).map(([key,deg])=>`${key} ${deg}°`).join(' / ')} 침투 각도`:'')+(c.defendSwitch?` · 수비: ${keyLabel(c.defendSwitch)} 선수 변경 · ${keyLabel(c.tackle)} 태클 · ${keyLabel(c.slideTackle)} 슬라이딩 · 공격: ${keyLabel(c.cross)}${keyLabel(c.cross)} 땅볼 크로스 · Z + ${keyLabel(c.cross)} 감아 크로스 · Z + ${keyLabel(c.pass)} 감아 패스 · ${keyLabel(c.shoot)}${keyLabel(c.shoot)} 깔아차기 · ${keyLabel(c.sprint)}${keyLabel(c.sprint)} / ${keyLabel(c.knockOn)} 치고 달리기 · ${c.cancel.map(keyLabel).join(' + ')} 취소 · GK ${keyLabel(c.keeperDrop)} 공 놓기`:'');host.append(extra);}}}
$('control-preset').value=controlPreset;$('control-preset').onchange=()=>{releaseInputs();controlPreset=validPreset($('control-preset').value);try{localStorage.setItem('soccer-controls',controlPreset);}catch{notify('설정 저장 실패','이번 실행에는 적용되지만 다시 열면 초기화될 수 있습니다.');}showControls();};showControls();

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch {
  message('3D 화면을 열 수 없어요. WebGL을 지원하는 브라우저에서 다시 열어주세요.');
  $('launch-match').disabled = true;
  throw new Error('WebGL unavailable');
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
$('scene').appendChild(renderer.domElement);
const goalNets=[];
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101d2b);
scene.fog = new THREE.FogExp2(0x101d2b, 0.0028);
const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, .1, 400);
const hemi = new THREE.HemisphereLight(0xe5f4ff, 0x394f58, 1.7);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xf3f5ff, 2.6);
sun.position.set(-35, 70, 15);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left:-75, right:75, top:60, bottom:-60, near:1, far:150 });
sun.shadow.bias = -.0005;
scene.add(sun);
const material = color => new THREE.MeshStandardMaterial({color, roughness:.85});
const turfCanvas=document.createElement('canvas');turfCanvas.width=turfCanvas.height=128;
const turfContext=turfCanvas.getContext('2d'),turfPixels=turfContext.createImageData(128,128);
let grainSeed=247;
for(let i=0;i<turfPixels.data.length;i+=4){grainSeed=(grainSeed*1664525+1013904223)>>>0;const value=210+(grainSeed%45);turfPixels.data[i]=value;turfPixels.data[i+1]=value;turfPixels.data[i+2]=value;turfPixels.data[i+3]=255;}
turfContext.putImageData(turfPixels,0,0);
const turfTexture=new THREE.CanvasTexture(turfCanvas);turfTexture.wrapS=turfTexture.wrapT=THREE.RepeatWrapping;turfTexture.repeat.set(3,20);turfTexture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
const mats = {grass:material(0x31764d), white:material(0xe3e9dc), stand:material(0x263a43), dark:material(0x101f28), metal:material(0xb4c5c8)};
function box(w,h,d,mat,x=0,y=0,z=0,parent=scene) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  mesh.position.set(x,y,z); mesh.receiveShadow=true; parent.add(mesh); return mesh;
}
box(300,1,260,material(0x10252e),0,-1,0);
box(123,.5,86,material(0x305144),0,-.3,0);
for(let i=0;i<14;i++){const turf=material(i%2?0x34774f:0x2b6a47);turf.map=turfTexture;turf.bumpMap=turfTexture;turf.bumpScale=.025;box(105/14,.1,68,turf,-52.5+(i+.5)*105/14,0,0);}
function line(points,color=0xdce8d4,height=.075) {
  const geo = new THREE.BufferGeometry().setFromPoints(points.map(([x,z])=>new THREE.Vector3(x,height,z)));
  const mesh = new THREE.Line(geo,new THREE.LineBasicMaterial({color}));scene.add(mesh);return mesh;
}
function rect(x,z,w,h){line([[x-w/2,z-h/2],[x+w/2,z-h/2],[x+w/2,z+h/2],[x-w/2,z+h/2],[x-w/2,z-h/2]]);}
function circle(x,z,r,start=0,end=Math.PI*2){const p=[];for(let i=0;i<=96;i++){const a=start+(end-start)*i/96;p.push([x+Math.cos(a)*r,z+Math.sin(a)*r]);}line(p);}
rect(0,0,105,68);line([[0,-34],[0,34]]);circle(0,0,9.15);
for(const sign of [-1,1]) {
  rect(sign*(52.5-8.25),0,16.5,40.32);rect(sign*(52.5-2.75),0,5.5,18.32);
  circle(sign*41.5,0,.2);
  // Penalty arcs extend beyond each penalty area.
  const a=Math.acos(5.5/9.15);
  circle(sign*41.5,0,9.15,sign<0?-a:Math.PI-a,sign<0?a:Math.PI+a);
  for(const z of [-34,34]){box(.09,2,.09,mats.white,sign*52.5,1,z);box(.8,.55,.035,material(0xffd279),sign*52.5+.4,1.7,z);}
  const goal = new THREE.Group(); scene.add(goal);goal.position.x=sign*52.8;
  for(const [a,b] of [[[0,0,-3.66],[0,2.5,-3.66]],[[0,0,3.66],[0,2.5,3.66]],[[0,2.5,-3.66],[0,2.5,3.66]]]){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),direction=end.clone().sub(start),post=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,direction.length(),12),mats.white);post.position.copy(start.add(end).multiplyScalar(.5));post.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());post.castShadow=true;goal.add(post);}
  box(.12,2.5,.12,mats.metal,sign*2,1.25,-3.66,goal);box(.12,2.5,.12,mats.metal,sign*2,1.25,3.66,goal);
  const vertices=[];
  for(let z=-3.66;z<=3.67;z+=.37) vertices.push(sign*2,0,z,sign*2,2.5,z, 0,2.5,z,sign*2,2.5,z);
  for(let y=0;y<=2.51;y+=.31){vertices.push(sign*2,y,-3.66,sign*2,y,3.66);for(const z of [-3.66,3.66])vertices.push(0,y,z,sign*2,y,z);}
  const grid=[];for(let i=0;i<vertices.length;i+=6){const a=vertices.slice(i,i+3),b=vertices.slice(i+3,i+6),parts=Math.max(1,Math.ceil(Math.hypot(...a.map((v,j)=>v-b[j]))/.18));for(let n=0;n<parts;n++)for(const t of [n/parts,(n+1)/parts])grid.push(...a.map((v,j)=>v+(b[j]-v)*t));}
  const net = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(grid,3)),new THREE.LineBasicMaterial({color:0xc0d0d2,transparent:true,opacity:.4}));goal.add(net);goalNets.push({net,sign,base:Float32Array.from(grid)});
}
circle(0,0,.22);
// Four terraces and repeated seats make the stadium without external models.
for(const sign of [-1,1]) {
  for(let tier=0;tier<6;tier++){
    box(133,1.5,3.1,mats.stand,0,tier*1.5,sign*(47+tier*3));
    box(3.1,1.5,88,mats.stand,sign*(64+tier*3),tier*1.5,0);
  }
  box(137,.45,14,mats.dark,0,12,sign*58);
  box(14,.45,90,mats.dark,sign*76,12,0);
  box(116,1.4,.35,material(0x10232f),0,.8,sign*40);for(let i=0;i<12;i++){const led=new THREE.MeshStandardMaterial({color:i%3?0x427994:0x91b8c5,emissive:i%3?0x26465c:0x527780,emissiveIntensity:.5,roughness:.4});box(8.8,.42,.04,led,-50+i*9.1,.9,sign*39.79);}
  box(137,.12,.18,new THREE.MeshBasicMaterial({color:0x6498b1}),0,11.73,sign*52);
}
const seats = new THREE.InstancedMesh(new THREE.BoxGeometry(1,.38,.75), material(0x466a7d), 2200);
const dummy=new THREE.Object3D();let seatIndex=0;
for(const sign of [-1,1])for(let tier=0;tier<6;tier++){
  for(let i=0;i<102;i++){dummy.position.set(-64+i*1.27,tier*1.5+.95,sign*(47+tier*3));dummy.updateMatrix();seats.setMatrixAt(seatIndex++,dummy.matrix);}
  for(let i=0;i<72;i++){dummy.position.set(sign*(64+tier*3),tier*1.5+.95,-44+i*1.23);dummy.updateMatrix();seats.setMatrixAt(seatIndex++,dummy.matrix);}
}
seats.count=seatIndex;scene.add(seats);
for(const x of [-61,61])for(const z of [-43,43]) {
  box(.5,21,.5,mats.metal,x,10,z);
  box(7,1,.7,mats.dark,x,20.5,z);
  box(6,.65,.15,new THREE.MeshBasicMaterial({color:0xd8f5ff}),x,20.5,z+(z<0?.4:-.4));
}
for(const x of [-57,57])for(const z of [-38,38]){const light=new THREE.PointLight(0xdaecff,400,110,2);light.position.set(x,20,z);scene.add(light);}
const contactCanvas=document.createElement('canvas');contactCanvas.width=contactCanvas.height=128;const contactCtx=contactCanvas.getContext('2d'),contactGradient=contactCtx.createRadialGradient(64,64,9,64,64,64);contactGradient.addColorStop(0,'#000000b0');contactGradient.addColorStop(.5,'#00000055');contactGradient.addColorStop(1,'#00000000');contactCtx.fillStyle=contactGradient;contactCtx.fillRect(0,0,128,128);const contactTexture=new THREE.CanvasTexture(contactCanvas);
const formation=FORMATION, names=NAMES, roles=ROLES, numbers=NUMBERS;
const players=[];
$('save-status').textContent='선수 로딩';
await loadRealPlayerAssets();
$('save-status').textContent='저장됨';
function createPlayer(team,index,parent=scene){
  const visual=buildRealAthlete(team,index),{group}=visual;
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.65,24),new THREE.MeshBasicMaterial({color:0x06170d,map:contactTexture,transparent:true,opacity:.34,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.065;parent.add(shadow);
  const home=formation[index];group.position.set(team===0?home[0]:-home[0],.12,team===0?home[1]:-home[1]);group.rotation.y=team===0?Math.PI/2:-Math.PI/2;parent.add(group);shadow.position.set(group.position.x,.065,group.position.z);
  return {...visual,shadow,home:group.position.clone(),stamina:100,phase:index*.7};
}
for(let team=0;team<2;team++)for(let i=0;i<11;i++)players.push(createPlayer(team,i));
function applyAppearance(visual,profile,uniform=null){
  if(!profile)return;
  if(visual.realistic){applyRealAppearance(visual,profile,uniform);return;}
  const height=profile.height??180,weight=profile.weight??77,width=THREE.MathUtils.clamp(Math.sqrt(weight/(height/100)**2/24),.8,1.3);
  visual.group.scale.set(width,height/180,width);visual.head.scale.set(.96/Math.pow(width,.6),.94,.96/Math.pow(width,.6));
  if(uniform){
    const signature=JSON.stringify([uniform,profile.role==='GK']);
    if(visual.uniformSignature!==signature){
      visual.uniformSignature=signature;visual.kit.color.set(profile.role==='GK'?uniform.keeper:uniform.shirt);visual.sleeveMaterial.color.set(profile.role==='GK'?uniform.keeper:uniform.shirt);visual.shorts.color.set(uniform.shorts);visual.sockMaterial.color.set(uniform.socks);
      const pattern=profile.role==='GK'?'plain':uniform.pattern;
      if(visual.kit.map){visual.kit.map.dispose();visual.kit.map=null;}
      const c=document.createElement('canvas');c.width=c.height=512;paintKit(c.getContext('2d'),uniform,{keeper:profile.role==='GK'});const base=profile.role==='GK'?uniform.keeper:uniform.shirt;
      visual.kit.map=new THREE.CanvasTexture(c);visual.kit.map.colorSpace=THREE.SRGBColorSpace;visual.kit.map.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);visual.kit.color.set(0xffffff);visual.trim.color.set(uniform.accent??'#e4c986');visual.kit.roughness=.78;visual.skin.roughness=.63;const light=new THREE.Color(base).getHSL({h:0,s:0,l:0}).l;visual.labels.forEach(label=>label.material.color.set(light>.65?0x183044:0xffffff));
      visual.kit.needsUpdate=true;
    }
  }
  visual.skin.color.set(profile.skin??'#e4b18f');visual.skinDetail.color.copy(visual.skin.color).multiplyScalar(.76);visual.handMaterials.forEach(mat=>mat.color.set(profile.role==='GK'?0xdde3dc:visual.skin.color));visual.hairMaterial.color.set(profile.hair??'#292329');visual.hairFade.color.copy(visual.skin.color).lerp(visual.hairMaterial.color,.66);
  if(visual.jersey!==profile.number){visual.jersey=profile.number;const c=visual.numberCanvas,ctx=c.getContext('2d');ctx.clearRect(0,0,64,64);ctx.font='bold 46px sans-serif';ctx.fillStyle='white';ctx.textAlign='center';ctx.fillText(profile.number??10,32,49);visual.numberTexture.needsUpdate=true;}
}
const previewScene=new THREE.Scene();
const previewCamera=new THREE.PerspectiveCamera(27,1,.1,30);previewCamera.position.set(2.7,1.9,4.2);previewCamera.lookAt(0,1.07,0);
previewScene.add(new THREE.HemisphereLight(0xe8f4ff,0x39444b,1.8));
const previewLight=new THREE.DirectionalLight(0xffedce,3);previewLight.position.set(-3,6,5);previewLight.castShadow=true;previewLight.shadow.mapSize.set(1024,1024);Object.assign(previewLight.shadow.camera,{left:-2.5,right:2.5,top:3,bottom:-1,near:.1,far:14});previewLight.shadow.bias=-.0002;previewScene.add(previewLight);const previewRim=new THREE.DirectionalLight(0x9bc7ff,1.6);previewRim.position.set(3,3,-4);previewScene.add(previewRim);
const previewFloor=new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.25,.12,48),material(0x223d46));previewFloor.position.y=-.08;previewFloor.receiveShadow=true;previewScene.add(previewFloor);
let previewPlayer=createPlayer(0,9,previewScene);const previewModels=new Map([[9,previewPlayer]]);previewPlayer.group.position.set(0,.01,0);previewPlayer.shadow.position.set(0,.065,0);previewPlayer.group.rotation.y=.12;
let previewRenderer=null,previewYaw=.12,previewDrag=null;
try{previewRenderer=new THREE.WebGLRenderer({antialias:true,alpha:true});previewRenderer.setPixelRatio(Math.min(devicePixelRatio,1.5));previewRenderer.toneMapping=THREE.ACESFilmicToneMapping;previewRenderer.toneMappingExposure=1.1;previewRenderer.shadowMap.enabled=true;previewRenderer.shadowMap.type=THREE.PCFSoftShadowMap;$('player-preview').appendChild(previewRenderer.domElement);}catch{$('player-preview').textContent='3D 미리보기를 열 수 없습니다.';}
let homeOpen=true,clubHome;
document.body.classList.add('home-open');
function applyRosterAppearance(){for(let i=0;i<11;i++)applyAppearance(players[i],match.players[i].profile,match.kit);const away=resolveKitClash(match.kit,match.awayKit??KIT_PRESETS.find(kit=>kit.id===(match.kit?.id==='psg-home'?'madrid-home':'psg-home')));for(let i=11;i<22;i++)applyAppearance(players[i],match.players[i].profile??{...match.players[i],height:i===11?190:180,weight:77,skin:['#e4b18f','#c18e69','#935b41'][i%3],hair:'#292329'},away);renderSelected=-2;}
function showHome(){
  archiveCurrent(match.ended?'finished':'abandoned');releaseInputs();match.reset();homeOpen=true;document.body.classList.add('home-open');$('home').hidden=false;$('result').classList.add('hidden');$('halftime').classList.add('hidden');clubHome.show();
}
const ring=new THREE.Mesh(new THREE.RingGeometry(.87,.99,48),new THREE.MeshBasicMaterial({color:0xc5f773,side:THREE.DoubleSide,transparent:true,opacity:.95}));ring.rotation.x=-Math.PI/2;scene.add(ring);
const receiverRing=new THREE.Mesh(new THREE.RingGeometry(.85,.94,40),new THREE.MeshBasicMaterial({color:0x91eaff,side:THREE.DoubleSide,transparent:true,opacity:.7}));receiverRing.rotation.x=-Math.PI/2;scene.add(receiverRing);
const arrow=new THREE.Mesh(new THREE.ConeGeometry(.25,.43,3),new THREE.MeshBasicMaterial({color:0xc5f773}));arrow.rotation.z=Math.PI;scene.add(arrow);
// Run arrow: shows where the Q / 1~4 runner is heading, drawn flat on the turf from the runner to the target.
const runArrowMaterial=new THREE.MeshBasicMaterial({color:0xc5f773,transparent:true,opacity:.85,depthWrite:false,side:THREE.DoubleSide});
const runArrow=new THREE.Group(),runShaft=new THREE.Mesh(new THREE.PlaneGeometry(.42,1),runArrowMaterial),runHeadShape=new THREE.Shape();
runHeadShape.moveTo(-.75,0);runHeadShape.lineTo(.75,0);runHeadShape.lineTo(0,-1.3);runHeadShape.closePath();
const runHead=new THREE.Mesh(new THREE.ShapeGeometry(runHeadShape),runArrowMaterial);runShaft.rotation.x=runHead.rotation.x=-Math.PI/2;runArrow.add(runShaft,runHead);runArrow.visible=false;scene.add(runArrow);
// A short copy at the passer's feet, so the run direction is visible even when the runner is off screen.
const runCue=runArrow.clone();runCue.scale.setScalar(.8);runCue.children[0].scale.y=2.2;runCue.children[0].position.z=1.1;runCue.children[1].position.z=2.2;scene.add(runCue);
function updateRunArrow(){
  const run=match.calledRun,r=run&&run.until>match.time?match.players[run.id]:null,t=r?.runUntil>match.time?r.runTarget:null;
  const dx=t?t.x-r.x:0,dz=t?t.z-r.z:0,len=Math.hypot(dx,dz),carrier=match.owner>=0?match.players[match.owner]:null;
  runArrow.visible=Boolean(t)&&len>1.4&&!homeOpen;runCue.visible=runArrow.visible&&carrier?.team===0&&carrier.id!==r.id;
  if(runCue.visible){runCue.position.set(carrier.x+Math.sin(runArrow.rotation.y=Math.atan2(dx,dz))*1.1,.11,carrier.z+Math.cos(runArrow.rotation.y)*1.1);runCue.rotation.y=runArrow.rotation.y;}
  if(!runArrow.visible)return;
  runArrow.position.set(r.x,.1,r.z);runArrow.rotation.y=Math.atan2(dx,dz);
  const shaft=Math.max(.1,len-1.3);runShaft.scale.y=shaft;runShaft.position.z=shaft/2;runHead.position.z=shaft;
  runArrowMaterial.opacity=.85*Math.min(1,(r.runUntil-match.time)/.4);
}
const ballTexture=document.createElement('canvas');ballTexture.width=512;ballTexture.height=256;
const bc=ballTexture.getContext('2d');bc.fillStyle='#f3f4e9';bc.fillRect(0,0,512,256);
for(let row=0;row<5;row++)for(let col=0;col<10;col++){const x=col*56+(row%2)*28,y=row*57;bc.beginPath();for(let i=0;i<6;i++){const a=i*Math.PI/3;const px=x+Math.cos(a)*18,py=y+Math.sin(a)*18;i?bc.lineTo(px,py):bc.moveTo(px,py);}bc.closePath();bc.fillStyle=(row+col)%3===0?'#182831':'#e3e6dc';bc.fill();bc.strokeStyle='#9aa59c';bc.lineWidth=1.5;bc.stroke();}
// Drawn larger and slightly self-lit than its real 22 cm so it reads from the broadcast camera.
const BALL_VISUAL_SCALE=1.75,ballLift=VISUAL_SCALE.ballRadius*(BALL_VISUAL_SCALE-1);
const ball=new THREE.Mesh(new THREE.SphereGeometry(VISUAL_SCALE.ballRadius,24,16),new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(ballTexture),roughness:.55,emissive:0xffffff,emissiveIntensity:.22}));ball.scale.setScalar(BALL_VISUAL_SCALE);ball.castShadow=true;scene.add(ball);
const ballMarker=new THREE.Mesh(new THREE.RingGeometry(.34,.46,40),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.6,depthWrite:false}));ballMarker.rotation.x=-Math.PI/2;scene.add(ballMarker);
const ballShadow=new THREE.Mesh(new THREE.CircleGeometry(.15,24),new THREE.MeshBasicMaterial({color:0x092315,transparent:true,opacity:.35,depthWrite:false}));ballShadow.rotation.x=-Math.PI/2;scene.add(ballShadow);
for(const id of ['player-preview','home-player-preview']){const host=$(id);host.onpointerdown=e=>{if(e.button!==0)return;previewDrag={id:e.pointerId,x:e.clientX};host.setPointerCapture(e.pointerId);};host.onpointermove=e=>{if(previewDrag?.id!==e.pointerId)return;previewYaw+=(e.clientX-previewDrag.x)*.012;previewDrag.x=e.clientX;};for(const event of ['pointerup','pointercancel','lostpointercapture'])host.addEventListener(event,()=>previewDrag=null);}
$('preview-reset').onclick=()=>previewYaw=.12;
const keys=new Set(),joy={x:0,y:0};let touchSprint=false,touchShotStyle='auto',renderSelected=-1,lastEvent='',lastClock='',lastScore='',accumulator=0;
const exitDialog=$('exit-dialog');let exitPaused=false;
function updateCard(){const id=match.mode==='manager'?match.owner:match.selected,p=match.players[id],card=document.querySelector('.player-card');card.hidden=match.owner<0||!p;if(!p){renderSelected=-1;return;}$('number').textContent=p.number??numbers[p.index];$('player-name').textContent=p.name??names[p.index];$('position').textContent=match.mode==='manager'?`${p.team===0?'홈':'원정'} · ${p.role}`:p.role;renderSelected=id;card.classList.toggle('away-possession',match.mode==='manager'&&p.team===1);}
function start(){if(homeOpen||match.running)return;match.start();}
function switchPlayer(){start();if(match.paused||match.ended)return;match.switchPlayer();updateCard();}
function reset(){const wasRunning=match.running;match.reset();if(wasRunning)match.start();$('result').classList.add('hidden');$('halftime').classList.add('hidden');releaseInputs();message('');syncHUD();}
function beginAction(type){start();if(!exitDialog.open){sampleInput();match.beginKick(type,type==='shoot'?shotStyleFor(keys,touchShotStyle,controlPreset):kickStyleFor(type,keys));}}
function endAction(type){sampleInput();match.releaseKick(type);}
function bindChargedAction(id,type){
  const button=$(id);
  button.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();button.setPointerCapture(e.pointerId);beginAction(type);};
  button.onpointerup=e=>{e.preventDefault();endAction(type);};
  button.onpointercancel=()=>{match.charge=null;};
  button.onlostpointercapture=()=>{if(match.charge?.type===type)match.charge=null;};
  button.onclick=e=>{if(e.detail===0){start();match.kick(type,.2);}};
}
function bindAction(id,action){const button=$(id);button.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();action();};button.onclick=e=>{if(e.detail===0)action();};}
bindAction('shot-style',()=>{const styles=Object.keys(SHOT_LABELS);touchShotStyle=styles[(styles.indexOf(touchShotStyle)+1)%styles.length];$('shot-style').textContent=SHOT_LABELS[touchShotStyle];});
$('result-home').onclick=showHome;
$('replay').onclick=reset;bindChargedAction('shoot','shoot');bindChargedAction('pass','pass');bindChargedAction('through','through');bindChargedAction('cross','cross');bindAction('switch',switchPlayer);
function openExitMenu(){if(homeOpen)return;exitPaused=match.paused;match.setPaused(true);releaseInputs();$('exit-online-note').hidden=match.canPause;exitDialog.showModal();syncHUD();}
function closeExitMenu(){exitDialog.close();match.setPaused(exitPaused);releaseInputs();syncHUD();}
$('match-menu').onclick=openExitMenu;$('resume-match').onclick=closeExitMenu;
$('quit-match').onclick=async()=>{if(match.running&&!match.ended&&!await notify('경기 종료','진행 중인 경기를 종료할까요? 중도 종료 기록으로 저장하고 홈으로 돌아갑니다.',{confirm:true,confirmText:'경기 종료'}))return;exitDialog.close();showHome();};
exitDialog.addEventListener('cancel',e=>{e.preventDefault();closeExitMenu();});
let matchSpeed=1;
function configureMode(mode,settings={}){
  releaseInputs();match.setMode(mode);renderSelected=-2;const manager=match.mode==='manager';document.querySelector('.player-card').setAttribute('aria-label',manager?'볼 소유 선수':'조작 중인 선수');document.body.classList.toggle('manager-mode',manager);
  $('tactics-panel').hidden=true;$('tactics-toggle').hidden=!manager;$('tactics-toggle').setAttribute('aria-expanded','false');
  matchSpeed=1;$('match-speed').value='1';
  const mentality=manager?settings.mentality??'balanced':'balanced',pressure=manager?settings.pressure??'balanced':'balanced';
  match.setTactic('mentality',mentality);match.setTactic('pressure',pressure);$('mentality').value=mentality;$('pressure').value=pressure;
  syncHUD();
}
$('tactics-toggle').onclick=()=>{const hidden=!$('tactics-panel').hidden;$('tactics-panel').hidden=hidden;$('tactics-toggle').setAttribute('aria-expanded',String(!hidden));};
$('mentality').onchange=()=>match.setTactic('mentality',$('mentality').value);
$('pressure').onchange=()=>match.setTactic('pressure',$('pressure').value);
$('match-speed').onchange=()=>{matchSpeed=Number($('match-speed').value);};
bindAction('keeper-drop',()=>match.dropKeeperBall());
$('cancel-kick').onclick=()=>match.cancelKick();renderer.domElement.addEventListener('contextmenu',e=>{e.preventDefault();match.cancelKick();});

// Ball sound cues come from state changes: a new kick, a new owner, a loose touch, and dribble strides.
for(const type of ['keydown','pointerdown'])window.addEventListener(type,unlockBallSound,{capture:true});
const soundState={owner:-1,kick:null,lastTouch:-1,carry:0};
function updateBallSound(dt){
  const s=soundState,owner=match.owner,b=match.ball;
  if(homeOpen||match.paused||!match.running){s.carry=0;s.owner=owner;s.kick=match.lastKick;s.lastTouch=match.lastTouch;return;}
  if(match.lastKick&&match.lastKick!==s.kick)playKick(Math.min(1,Math.hypot(b.vx,b.vz,b.vy)/40));
  else if(owner>=0&&owner!==s.owner){playTrap(Math.min(1,.3+Math.hypot(b.vx,b.vz)/20));s.carry=0;}
  else if(owner<0&&s.owner>=0&&match.lastTouch===s.owner)playTouch(.8);
  else if(owner<0&&s.owner<0&&match.lastTouch!==s.lastTouch)playTouch(.7);
  if(owner>=0){const p=match.players[owner],speed=Math.hypot(p.vx,p.vz),stride=speed>8.5?2.6:1.8;
    if(p.holdingBall)s.carry=0;else{s.carry+=speed*dt;if(speed>1&&s.carry>=stride){s.carry-=stride;playTouch(owner===match.selected?Math.min(1,.25+speed/14):.12);}}}
  s.owner=owner;s.kick=match.lastKick;s.lastTouch=match.lastTouch;
}
const physicalKeys={KeyW:'w',KeyA:'a',KeyS:'s',KeyD:'d',KeyQ:'q',KeyE:'e',KeyR:'r',KeyX:'x',KeyZ:'z',KeyC:'c',KeyF:'f',Digit1:'1',Digit2:'2',Digit3:'3',Digit4:'4',Space:' ',ShiftLeft:'shift',ShiftRight:'shift',ControlLeft:'control',ControlRight:'control'};
// Double-tap state: a released cross/shot waits DOUBLE_TAP_MS for a second tap (땅볼 크로스 / 깔아차기).
let tapRelease=null,lastTap={};const suppressKeyup=new Set();
function clearTapRelease(){if(tapRelease)clearTimeout(tapRelease.timer);tapRelease=null;}
const inputKey=e=>physicalKeys[e.code]??e.key.toLowerCase();
const actionContext=()=>({throwing:match.restart?.type==='throw'&&match.selected===match.restart.taker,defending:!match.restart&&match.owner>=0&&match.players[match.owner]?.team===1,attacking:!match.restart&&match.owner>=0&&match.owner===match.selected});
window.addEventListener('keydown',e=>{
  if(homeOpen)return;
  if(e.key==='Escape'){e.preventDefault();if(!e.repeat){if(exitDialog.open)closeExitMenu();else openExitMenu();}return;}
  if(exitDialog.open||['SELECT','INPUT','TEXTAREA'].includes(e.target.tagName))return;
  const key=inputKey(e);
  if(match.mode==='manager')return;
  if(key==='r'&&!e.repeat&&(match.charge||match.pending||match.restart?.queuedKick)){match.cancelKick();e.preventDefault();return;}
  if(key==='f'&&match.dropKeeperBall()){e.preventDefault();return;}
  if(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d','shift','q',' ','e','r','x','z','c','f','control','1','2','3','4'].includes(key)){
    e.preventDefault();keys.add(key);
    if(!e.repeat&&isCancelCombo(keys,controlPreset)&&(match.charge||match.pending||match.restart?.queuedKick)){match.cancelKick();return;}
    if(!e.repeat&&key===controls().keeperDrop&&match.dropKeeperBall())return;
    if(!e.repeat&&tapRelease?.key===key){const {type}=tapRelease;clearTapRelease();match.modifyKickStyle(controls().doubleTap[type]);sampleInput();endAction(type);suppressKeyup.add(key);return;}
    const now=performance.now(),doubleTapped=!e.repeat&&now-(lastTap[key]??-1e9)<280;if(!e.repeat)lastTap[key]=now;
    if(!e.repeat&&controls().knockOn&&(key===controls().knockOn||key===controls().sprint&&doubleTapped)){sampleInput();if(match.knockOn()){lastTap[key]=-1e9;return;}}
    if(key==='z'&&['pass','cross'].includes(match.charge?.type)){match.modifyKickStyle('curl');sampleInput();return;}
    if(shotModKeys(controlPreset).includes(key)&&match.charge?.type==='shoot'){match.modifyShotStyle(shotStyleFor(keys,'auto',controlPreset));sampleInput();return;}
    // Read directional input before a same-frame pass or shot.
    sampleInput();
    if(!e.repeat){const action=actionFor(key,controlPreset,actionContext());if(action==='switch')switchPlayer();else if(action==='tackle'){start();match.standTackle();}else if(action==='slide'){start();sampleInput();match.slideTackle();}else if(action==='run'){start();match.callRun(runAngleFor(key,controlPreset));}else if(action)beginAction(action);else start();}
  }
});
window.addEventListener('keyup',e=>{const key=inputKey(e),action=actionFor(key,controlPreset,{...actionContext(),defending:false,attacking:false});keys.delete(key);if(suppressKeyup.delete(key))return;
  if(controls().doubleTap?.[action]&&match.charge?.type===action&&match.freezeKickPower(action)){clearTapRelease();tapRelease={key,type:action,timer:setTimeout(()=>{if(tapRelease?.key!==key)return;tapRelease=null;sampleInput();endAction(action);},DOUBLE_TAP_MS)};return;}
  if(action&&action!=='switch')endAction(action);});
function releaseInputs(){drawing=null;match.charge=null;keys.clear();clearTapRelease();suppressKeyup.clear();joy.x=joy.y=0;touchSprint=false;match.setInput(0,0,false);$('stick').style.transform='';$('sprint').classList.remove('pressed');}
window.addEventListener('blur',releaseInputs);
document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseInputs();});
const joystick=$('joystick');let pointer=null;
function moveJoystick(e){const r=joystick.getBoundingClientRect();let x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2;const max=r.width*.32,len=Math.hypot(x,y);if(len>max){x*=max/len;y*=max/len;}joy.x=x/max;joy.y=y/max;$('stick').style.transform=`translate(${x}px,${y}px)`;}
joystick.addEventListener('pointerdown',e=>{if(pointer!==null)return;pointer=e.pointerId;joystick.setPointerCapture(pointer);start();moveJoystick(e);});
joystick.addEventListener('pointermove',e=>{if(e.pointerId===pointer)moveJoystick(e);});
for(const event of ['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(event,e=>{if(e.pointerId!==pointer)return;pointer=null;joy.x=joy.y=0;$('stick').style.transform='';});
$('sprint').addEventListener('pointerdown',e=>{start();touchSprint=true;$('sprint').setPointerCapture(e.pointerId);$('sprint').classList.add('pressed');});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('sprint').addEventListener(event,()=>{touchSprint=false;$('sprint').classList.remove('pressed');});
function sampleInput(){
  if(homeOpen||match.mode==='manager'){match.setInput(0,0);return;}
  const input=movement(keys,controlPreset,match.restart?.type==='throw'&&match.selected===match.restart.taker);
  match.setInput(input.x+joy.x,input.z+joy.y,input.sprint||touchSprint);
}
const focus=new THREE.Vector3(),cameraTarget=new THREE.Vector3(),cameraPosition=new THREE.Vector3();
function cameraUpdate(dt,immediate=false){
  if(drawing&&!immediate)return;
  const p=match.players[match.goalWait>0?match.celebratingPlayer:match.selected],b=match.goalWait>0&&match.goalNet?.elapsed>.9?p:match.ball;
  if(match.phase==='shootout'){camera.position.lerp(camera.aspect<.8?new THREE.Vector3(23,20,0):new THREE.Vector3(29,15,0),immediate?1:1-Math.exp(-dt*6));camera.lookAt(49,1,0);return;}
  // Parallel touchline camera: screen right is always attacking right.
  const r=match.restart,s=match.attackSign(r?.team??0);
  const x=r?THREE.MathUtils.clamp(r.type==='corner'?r.x-s*8:r.type==='goalKick'?r.x+s*7:r.x+s*6,-47,47):THREE.MathUtils.clamp(match.mode==='manager'?b.x:p.x*.42+b.x*.58,match.goalWait>0?-49:-39,match.goalWait>0?49:39);
  const z=match.goalWait>0?THREE.MathUtils.clamp(b.z,-29,29):THREE.MathUtils.clamp(17+(r?r.z:match.mode==='manager'?b.z:p.z*.4+b.z*.6)*.04,15.5,18.5);
  const ideal=new THREE.Vector3(x,0,z);
  focus.lerp(ideal,immediate?1:1-Math.exp(-dt*(r?7:4.5)));
  cameraTarget.copy(focus);
  const narrow=camera.aspect<.8;
  const direct=match.mode==='player'&&!r;
  cameraPosition.set(focus.x,narrow?52:direct?32:35,focus.z+(narrow?49:direct?36:38));
  if(match.goalWait>0)cameraPosition.set(focus.x,22,focus.z+22);
  camera.position.lerp(cameraPosition,immediate?1:1-Math.exp(-dt*6));camera.lookAt(cameraTarget);
}
const map=$('map').getContext('2d');
function drawMap(){
  map.clearRect(0,0,252,164);map.strokeStyle='#678985';map.lineWidth=1;map.strokeRect(6,6,240,152);map.beginPath();map.moveTo(126,6);map.lineTo(126,158);map.stroke();map.beginPath();map.ellipse(126,82,21,21,0,0,Math.PI*2);map.stroke();map.strokeRect(6,37,37,90);map.strokeRect(209,37,37,90);
  for(const p of match.players){if(p.sentOff)continue;map.beginPath();map.arc(6+(p.x+52.5)/105*240,6+(p.z+34)/68*152,p.id===match.selected?4.5:3,0,Math.PI*2);map.fillStyle=p.id===match.selected?'#c5f773':p.team===0?'#82a7ff':'#ed9879';map.fill();}
  map.beginPath();map.arc(6+(match.ball.x+52.5)/105*240,6+(match.ball.z+34)/68*152,2.4,0,Math.PI*2);map.fillStyle='white';map.fill();
}
let keeperGuide=false;
function syncHUD(){
  const controlled=match.players[match.selected],holdingKeeper=match.mode==='player'&&match.owner===controlled.id&&controlled.index===0&&controlled.holdingBall;
  if(holdingKeeper!==keeperGuide){keeperGuide=holdingKeeper;showControls();$('keeper-drop').hidden=!holdingKeeper;$('pass').textContent=holdingKeeper?'던지기':'패스';$('cross').textContent=holdingKeeper?'사이드발리':'크로스';if(holdingKeeper){const hint=document.querySelector('.controls-hint .shot-controls');hint.textContent=`${controls().keeperDrop?keyLabel(controls().keeperDrop)+' / ':''}F 공 놓기 · ${keyLabel(controls().pass)} 던지기 · ${keyLabel(controls().cross)} / ${keyLabel(controls().shoot)} 사이드발리`;}}
  $('cancel-kick').hidden=!match.charge;
  $('power').hidden=!match.charge;$('power-fill').style.width=`${match.kickPower*100}%`;$('power-label').textContent=match.charge?.type==='shoot'?(SHOT_LABELS[match.charge.shotStyle??'auto']??'슛'):(KICK_LABELS[match.charge?.type]?.[match.charge?.shotStyle]??KICK_LABELS[match.charge?.type]?.auto??'');
  if(match.mode==='manager'){
    $('active-formation').textContent=match.formations[0]==='custom'?'자유 배치':match.formations[0];
    $('shot-stats').textContent=match.stats.shots.join(' : ');$('save-stats').textContent=match.stats.saves.join(' : ');$('pass-stats').textContent=match.stats.passes.join(' : ');
    const total=match.stats.possession[0]+match.stats.possession[1],home=total?Math.round(match.stats.possession[0]/total*100):50;
    $('possession-stats').textContent=`${home} : ${100-home}`;
  }
  if(renderSelected!==(match.mode==='manager'?match.owner:match.selected)||document.querySelector('.player-card').hidden!==(match.owner<0))updateCard();
  updateMatchPanels();
  if(match.ended)archiveCurrent('finished');
  const clock=match.regulationDisplayTime+(match.paused?' · 정지':'');const added=match.addedTimeInfo;$('added-time').hidden=!added||match.phase==='shootout'||match.ended;if(added)$('added-time').textContent=`+${added.minutes}분 · 진행 ${added.elapsed}`;document.body.classList.toggle('has-added-time',Boolean(added));$('penalties-score').hidden=!match.shootout;if(match.shootout)$('penalties-score').textContent=`PK ${match.shootout.score.join(' : ')}`;
  const clubs=document.querySelectorAll('.matchbar .club span');clubs[0].textContent=match.squadName??'홈 팀';clubs[1].textContent=match.awaySquadName??'원정 팀';
  $('period').textContent=match.ended?'경기 종료':match.phase==='halftime'?'하프타임':match.phase==='shootout'?'승부차기':match.half===1?'전반':'후반';
  document.body.classList.toggle('shootout-mode',match.phase==='shootout');$('attack-direction').textContent=match.phase==='shootout'?`승부차기 · ${match.shootout.turn===0?'우리 팀 킥':'우리 팀 수비'}`:match.attackSign(0)>0?'홈 팀 → 오른쪽 골대':'홈 팀 ← 왼쪽 골대';
  if(match.phase==='halftime'){
    if($('halftime').classList.contains('hidden')){releaseInputs();$('halftime').classList.remove('hidden');}
    $('halftime-score').textContent=`홈 ${match.score[0]} : ${match.score[1]} 원정`;
    $('halftime-countdown').textContent=`${Math.ceil(match.halftimeRemaining)}초 후 후반 시작`;
  }else $('halftime').classList.add('hidden');
  document.body.classList.toggle('super-save',match.highlight?.kind==='save');document.body.classList.toggle('goal-moment',match.highlight?.kind==='goal');
  if(clock!==lastClock){$('clock').textContent=clock;lastClock=clock;}
  const score=match.score.join(':');if(score!==lastScore){$('home-score').textContent=match.score[0];$('away-score').textContent=match.score[1];lastScore=score;}
  if(lastEvent!==match.event){message(match.phase==='shootout'||match.restart||match.notice||['경기 종료','하프타임'].includes(match.event)?'':match.event);lastEvent=match.event;}
  if(match.ended&&$('result').classList.contains('hidden')){
    $('result').classList.remove('hidden');const winner=match.winner??(match.score[0]>match.score[1]?0:1);
    $('result-title').textContent=match.forfeit!==null?(match.forfeit===0?'패배 · 몰수':'승리 · 몰수'):`${winner===0?'승리':'패배'}${match.shootout?' · 승부차기':''}`;
    $('result-score').textContent=`홈 ${match.score[0]} : ${match.score[1]} 원정${match.shootout?`\n승부차기\n${match.shootout.score.join(' : ')}`:''}`;releaseInputs();
  }
  $('stamina').style.width=`${match.players[match.mode==='manager'&&match.owner>=0?match.owner:match.selected].stamina}%`;
}
const archived=new Set();let panelSignature='',sideView='players',shownRestart=null,rosterBeforeRestart=true;
function archiveCurrent(status){
  if(!clubHome||!match.running||archived.has(match.id))return;
  if(status==='abandoned')match.recordEvent('abandoned',-1);
  archived.add(match.id);const record=match.matchRecord(status);
  saveLearning(clubHome.storage,match.learning);if(!saveMatch(clubHome.storage,record))notify('경기 기록 저장 실패','저장 공간이 부족하거나 브라우저 저장소를 사용할 수 없습니다. 이전에 저장한 기록은 유지됩니다.');
}
$('match-sidebar').hidden=true;$('roster-toggle').setAttribute('aria-expanded','false');
$('roster-toggle').onclick=()=>{const hidden=!$('match-sidebar').hidden;$('match-sidebar').hidden=hidden;$('roster-toggle').setAttribute('aria-expanded',String(!hidden));};
$('side-players').onclick=()=>{sideView='players';panelSignature='';};$('side-events').onclick=()=>{sideView='events';panelSignature='';};$('roster-team').onchange=()=>{panelSignature='';};
function updateMatchPanels(){
  const setPiece=match.restart?.manual?match.restart:match.phase==='shootout'?match.shootout:null;
  if(setPiece&&shownRestart!==setPiece){if(!shownRestart)rosterBeforeRestart=$('match-sidebar').hidden;shownRestart=setPiece;$('match-sidebar').hidden=true;$('roster-toggle').setAttribute('aria-expanded','false');}else if(!setPiece&&shownRestart){shownRestart=null;$('match-sidebar').hidden=rosterBeforeRestart;$('roster-toggle').setAttribute('aria-expanded',String(!rosterBeforeRestart));}
  const drawingRestart=match.restart?.manual&&DRAWABLE_RESTARTS.has(match.restart.type);$('draw-actions').hidden=!drawingRestart;$('take-drawn-kick').disabled=!match.restart?.plan||match.restart.readyAfter>0;
  const shootout=match.phase==='shootout'?match.shootout:null;$('shootout-tally').hidden=!shootout;for(const id of ['pass','through','cross','switch','sprint','shot-style'])$(id).hidden=Boolean(shootout);$('shoot').textContent=shootout&&shootout.turn===1?'다이빙':'슛·헤딩';
  const notice=match.notice;$('match-announcement').hidden=!notice;
  $('match-announcement').dataset.team=String(notice?.team??'');
  if(notice){$('match-announcement').dataset.type=notice.type;$('announcement-title').textContent=notice.title;$('announcement-detail').textContent=notice.message;}
  const r=match.restart;
  if(r){$('match-announcement').hidden=false;$('match-announcement').dataset.type='restart';
    $('announcement-title').textContent=`${r.team===0?'홈':'원정'} ${({throw:'스로인',corner:'코너킥',goalKick:'골킥',freeKick:'프리킥',indirect:'간접 프리킥',penalty:'페널티킥'}[r.type])}`;
    const hint=r.manual?(r.readyAfter>0?`준비 ${Math.ceil(r.readyAfter)}초`:(r.type==='throw'?`A / D 방향 · ${keyLabel(controls().pass)} 누른 뒤 놓기`:r.type==='penalty'?`방향키 · ${keyLabel(controls().shoot)} 누른 뒤 놓기`:(r.plan?'궤적 확인 후 차기 · 다시 그리기':r.pathError||`공에서 목표까지 드래그 · ${keyLabel(controls().pass)} 패스 / ${keyLabel(controls().cross)} 크로스 / ${keyLabel(controls().shoot)} 슛`))):`${Math.ceil(r.wait)}초 후 재개`;
    $('announcement-detail').textContent=`${match.players[r.taker].number} ${match.players[r.taker].name} · ${r.delayCountdown!==undefined?`${Math.ceil(r.delayCountdown)}초 안에 재개 · `:''}${hint}${r.manual&&r.type!=='penalty'?' · Q 선수 전환':''}`;
    if(notice&&['yellow','red'].includes(notice.type)){ $('match-announcement').dataset.type=notice.type;$('announcement-title').textContent=notice.title;$('announcement-detail').textContent=notice.message; }
  }
  if(shootout){
    $('match-announcement').hidden=false;$('match-announcement').dataset.type='shootout';
    if(shootout.stage!=='result'){
      $('announcement-title').textContent=`승부차기 · ${Math.min(...shootout.attempts)+1}차`;
      const p=match.players[shootout.kicker],ready=shootout.stage==='prepare'?`준비 ${Math.max(1,Math.ceil(shootout.wait))}초 · `:'';
      $('announcement-detail').textContent=match.mode==='manager'?`${ready}${p.number}번 ${p.name}`:shootout.turn===0?(shootout.stage==='flight'?'슛 진행':`${ready}← → 조준 · ${keyLabel(controls().shoot)} 누른 뒤 놓기`):`${ready}${shootout.committed?`${shootout.keeperChoice<0?'왼쪽':shootout.keeperChoice>0?'오른쪽':'중앙'} 다이빙 준비`:`← → 방향 선택 · ${keyLabel(controls().shoot)} 다이빙`}`;
    }
    const tally=$('shootout-tally');tally.replaceChildren();
    for(const team of [0,1]){const row=document.createElement('div');row.className='penalty-tally-row';row.dataset.team=String(team);row.append(textNode('b',`${team===0?'우리 팀':'상대'} ${shootout.score[team]}`));const kicks=shootout.kicks.filter(k=>k.team===team),count=Math.max(5,kicks.length+(shootout.winner===null&&shootout.turn===team?1:0));for(let i=0;i<count;i++){const kick=kicks[i],dot=textNode('span',kick?(kick.scored?'●':'×'):'○',kick?(kick.scored?'penalty-scored':'penalty-missed'):'penalty-pending');dot.setAttribute('aria-label',`${i+1}차 ${kick?kick.scored?'성공':'실패':'대기'}`);row.append(dot);}tally.append(row);}
  }
  const signature=[match.id,sideView,$('roster-team').value,match.events.length,...match.players.map(p=>`${p.name}/${p.number}/${p.sentOff}/${p.yellow}/${p.shootoutExcluded}`)].join('|');
  if(signature===panelSignature)return;panelSignature=signature;
  $('side-players').setAttribute('aria-pressed',String(sideView==='players'));$('side-events').setAttribute('aria-pressed',String(sideView==='events'));$('sidebar-roster').hidden=sideView!=='players';$('live-events').hidden=sideView!=='events';
  const team=Number($('roster-team').value),host=$('roster-content');host.replaceChildren();
  function section(title,list,kind){host.append(textNode('h3',title));for(const p of list){const row=document.createElement('div');row.className=`match-roster-row ${kind}`;row.dataset.role=p.role;const identity=document.createElement('span');identity.className='roster-identity';identity.append(textNode('b',p.name),textNode('small',p.shootoutGoalkeeper?'GK':p.role));row.append(textNode('span',p.number??numbers[p.index],'roster-number'),identity);if(p.sentOff||p.yellow||p.shootoutExcluded)row.append(textNode('span',p.sentOff?'퇴장':p.shootoutExcluded?'대상 제외':'경고','roster-status'));else {const ready=textNode('span','●','roster-ready');ready.setAttribute('aria-hidden','true');row.append(ready);} if(p.shootoutExcluded)row.classList.add('excluded-player');host.append(row);}if(!list.length)host.append(textNode('p','없음','no-players'));}
  section('선발',match.players.filter(p=>p.team===team&&!p.sentOff),'active');section('퇴장',match.players.filter(p=>p.team===team&&p.sentOff),'dismissed');
  $('live-events').replaceChildren();if(!match.events.some(e=>IMPORTANT_EVENTS.has(e.type)))$('live-events').append(textNode('li','아직 기록 없음','event-empty'));for(const e of match.events.filter(e=>IMPORTANT_EVENTS.has(e.type)).reverse())$('live-events').append(fillEventRow(textNode('li','',`event-${e.type}${e.team===1&&['goal','penaltyGoal'].includes(e.type)?' away-goal':''}`),e,EVENT_LABELS[e.type]??e.type));
}
const setPieceAim=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineDashedMaterial({color:0x91efff,dashSize:.65,gapSize:.3,transparent:true,opacity:1,depthTest:false}));scene.add(setPieceAim);setPieceAim.renderOrder=10;const drawnTarget=new THREE.Mesh(new THREE.RingGeometry(.65,.86,36),new THREE.MeshBasicMaterial({color:0x91efff,side:THREE.DoubleSide,transparent:true,opacity:.95,depthTest:false}));drawnTarget.rotation.x=-Math.PI/2;drawnTarget.renderOrder=11;scene.add(drawnTarget);
function updateSetPieceAim(){
  const r=match.restart,pk=match.phase==='shootout'?match.shootout:null;if(pk){drawnTarget.visible=false;setPieceAim.visible=pk.turn===0&&match.mode==='player'&&['prepare','aim'].includes(pk.stage);if(setPieceAim.visible){const points=[new THREE.Vector3(41.5,.18,0),new THREE.Vector3(52.5,.18,pk.aim)];if(setPieceAim.geometry.getAttribute('position').count!==2){setPieceAim.geometry.dispose();setPieceAim.geometry=new THREE.BufferGeometry().setFromPoints(points);}else setPieceAim.geometry.setFromPoints(points);setPieceAim.computeLineDistances();}return;}setPieceAim.visible=Boolean(r?.manual);drawnTarget.visible=Boolean(r?.manual&&r.plan);if(r?.plan)drawnTarget.position.set(r.plan.end.x,.13,r.plan.end.z);if(!r?.manual)return;
  let points;if(r.plan)points=kickPreview(r,r.plan).map(p=>new THREE.Vector3(p.x,p.y,p.z));
  else {const end=['penalty','freeKick','indirect'].includes(r.type)?{x:match.attackSign(r.team)*52.5,z:r.aimZ}:{x:r.x+r.aim.x*18,z:r.z+r.aim.z*18};points=[new THREE.Vector3(r.x,.18,r.z),new THREE.Vector3(end.x,.18,end.z)];}
  if(setPieceAim.geometry.getAttribute('position').count!==points.length){setPieceAim.geometry.dispose();setPieceAim.geometry=new THREE.BufferGeometry().setFromPoints(points);}else setPieceAim.geometry.setFromPoints(points);setPieceAim.computeLineDistances();
}
const kickRay=new THREE.Raycaster(),kickPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);let drawing=null;
function pitchPointer(e){const rect=renderer.domElement.getBoundingClientRect(),point=new THREE.Vector3();kickRay.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);return kickRay.ray.intersectPlane(kickPlane,point)?{x:point.x,z:point.z}:null;}
renderer.domElement.addEventListener('pointerdown',e=>{const r=match.restart;if(e.button!==0||homeOpen||!r?.manual||!DRAWABLE_RESTARTS.has(r.type)||match.paused||match.cardWait>0)return;const point=pitchPointer(e);if(!point)return;e.preventDefault();renderer.domElement.setPointerCapture(e.pointerId);drawing={id:e.pointerId,restart:r,points:[{x:r.x,z:r.z},point]};match.setRestartPath(drawing.points);});
renderer.domElement.addEventListener('pointermove',e=>{if(drawing?.id!==e.pointerId)return;if(match.restart!==drawing.restart){drawing=null;return;}const p=pitchPointer(e);if(p){drawing.points.push(p);if(drawing.points.length>150)drawing.points.splice(1,1);match.setRestartPath(drawing.points);}});
renderer.domElement.addEventListener('pointerup',e=>{if(drawing?.id===e.pointerId){const p=pitchPointer(e);if(p)drawing.points.push(p);match.setRestartPath(drawing.points);drawing=null;}});
renderer.domElement.addEventListener('pointercancel',()=>{drawing=null;match.clearRestartPath();});
$('take-drawn-kick').onclick=()=>{match.releaseDrawnRestart();syncHUD();};$('clear-drawn-kick').onclick=()=>{drawing=null;match.clearRestartPath();syncHUD();};
// Match officials are independent of the 22 physical players.
const referee=createPlayer(0,6);referee.kit.color.set(0xf4e850);referee.sleeveMaterial.color.set(0xf4e850);referee.shorts.color.set(0x17232a);referee.sockMaterial.color.set(0x17232a);applyRealAppearance(referee,{height:180,weight:77,skin:'#d7a782',role:'CM',number:null},{shirt:'#e6d74d',shorts:'#17232a',socks:'#17232a',keeper:'#e6d74d',pattern:'plain'});referee.labels.forEach(l=>l.visible=false);referee.group.position.set(-8,.12,7);
const refereeCard=box(.22,.32,.035,material(0xf3d447),0,-.75,0,referee.arms[1]);refereeCard.visible=false;
const assistants=[-1,1].map((side,i)=>{const visual=createPlayer(0,6);visual.kit.color.set(0xf4e850);visual.sleeveMaterial.color.set(0xf4e850);visual.shorts.color.set(0x17232a);visual.sockMaterial.color.set(0x17232a);applyRealAppearance(visual,{height:180,weight:77,skin:'#d7a782',role:'CM',number:null},{shirt:'#e6d74d',shorts:'#17232a',socks:'#17232a',keeper:'#e6d74d',pattern:'plain'});visual.labels.forEach(l=>l.visible=false);visual.group.position.set(0,.12,side*35.7);const flagMat=material(i?0xffa343:0xf1dc59);box(.04,.8,.04,mats.dark,0,-.9,0,visual.arms[1]);box(.4,.3,.02,flagMat,.18,-1.08,0,visual.arms[1]);return {side,visual};});
const crowdPositions=[];
for(const side of [-1,1])for(let tier=0;tier<6;tier++){for(let i=0;i<102;i++)if((i+tier)%7!==0)crowdPositions.push([-64+i*1.27,tier*1.5+.75,side*(47+tier*3)]);for(let i=0;i<72;i++)if((i+tier)%7!==0)crowdPositions.push([side*(64+tier*3),tier*1.5+.75,-44+i*1.23]);}
const crowdBodies=new THREE.InstancedMesh(new THREE.CapsuleGeometry(.2,.28,4,8),material(0xffffff),crowdPositions.length),crowdHeads=new THREE.InstancedMesh(new THREE.SphereGeometry(.16,8,6),material(0xffffff),crowdPositions.length);
const crowdColors=[0x718ba8,0xcdb47b,0x658c75,0xb96659,0xc8d7dd,0x435566];crowdPositions.forEach(([x,y,z],i)=>{dummy.position.set(x,y+.48,z);dummy.updateMatrix();crowdBodies.setMatrixAt(i,dummy.matrix);crowdBodies.setColorAt(i,new THREE.Color(crowdColors[i%crowdColors.length]));dummy.position.y=y+.98;dummy.updateMatrix();crowdHeads.setMatrixAt(i,dummy.matrix);crowdHeads.setColorAt(i,new THREE.Color([0xe4b18f,0xc18e69,0x935b41][i%3]));});scene.add(crowdBodies,crowdHeads);
function updateOfficialsAndCrowd(dt){
  const b=match.ball,target=new THREE.Vector3(THREE.MathUtils.clamp(b.x-5,-46,46),.12,THREE.MathUtils.clamp(b.z+7,-27,27)),g=referee.group;const next=officialStep(g.position,target,dt);g.position.x=next.x;g.position.z=next.z;referee.shadow.position.set(g.position.x,.065,g.position.z);g.rotation.y=Math.atan2(b.x-g.position.x,b.z-g.position.z);const wave=Math.sin(match.controlTime*7)*Math.min(.4,next.distance/Math.max(dt,.001)*.085);
  referee.legs.forEach((l,i)=>l.rotation.x=match.paused?0:wave*(i?1:-1));const card=['yellow','red'].includes(match.notice?.type);refereeCard.visible=card;refereeCard.material.color.set(card&&match.notice.type==='red'?0xee4b43:0xf3d447);referee.arms[1].rotation.z=card?-2.9:0;updateRealPlayer(referee,{vx:next.distance/Math.max(dt,.001),vz:0,official:true},match.paused?0:dt,true);
  for(const {side,visual} of assistants){const team=side<0?1:0,s=match.attackSign(1-team),backs=match.players.filter(p=>p.team===team&&!p.sentOff).map(p=>p.x*s).sort((a,b)=>b-a),x=THREE.MathUtils.clamp((backs[1]??0)*s,-50,50);const next=officialStep(visual.group.position,{x,z:side*35.7},dt,5.2);visual.group.position.set(next.x,.12,next.z);visual.shadow.position.set(next.x,.065,next.z);visual.group.rotation.y=Math.atan2(b.x-visual.group.position.x,b.z-visual.group.position.z);visual.arms[1].rotation.z=match.notice?.type==='offside'?-2.5:0;visual.legs.forEach((l,i)=>l.rotation.x=match.paused?0:wave*(i?1:-1));updateRealPlayer(visual,{vx:next.distance/Math.max(dt,.001),vz:0,official:true},match.paused?0:dt,true);}
  if(match.goalWait>0){for(let i=0;i<crowdPositions.length;i+=5){const [x,y,z]=crowdPositions[i],jump=Math.abs(Math.sin(match.controlTime*10+i))*.2;dummy.position.set(x,y+.48+jump,z);dummy.updateMatrix();crowdBodies.setMatrixAt(i,dummy.matrix);dummy.position.y=y+.98+jump;dummy.updateMatrix();crowdHeads.setMatrixAt(i,dummy.matrix);}crowdBodies.instanceMatrix.needsUpdate=true;crowdHeads.instanceMatrix.needsUpdate=true;}
}
let last=performance.now(),learningSavedAt=0;
function frame(now){
  const dt=Math.min((now-last)/1000,.1);last=now;
  const active=match.running&&!match.paused&&!match.ended&&(!exitDialog.open||!match.canPause)&&match.goalWait<=0&&!match.restart&&!match.kickoffState&&(match.phase==='play'||match.phase==='shootout'&&match.shootout.stage==='flight');
  sampleInput();
  if((!exitDialog.open||!match.canPause)&&!homeOpen){accumulator=Math.min(accumulator+dt*(match.mode==='manager'&&match.phase==='play'&&!match.restart&&!match.goalWait&&!match.cardWait?matchSpeed:1),.24);while(accumulator>=1/120){match.step(1/120);accumulator-=1/120;}}else accumulator=0;
  updateBallSound(dt);updateRunArrow();
  for(const p of match.players){
    const visual=players[p.id],g=visual.group;g.visible=!p.sentOff&&!p.shootoutExcluded;if(p.shootoutGoalkeeper&&p.index!==0){if(!visual.shootoutAppearance){visual.shootoutAppearance={profile:{...visual.profile},uniform:visual.uniform};applyRealAppearance(visual,{...visual.profile,role:'GK'},{...visual.uniform,keeper:'#f6ca55'});}}else if(visual.shootoutAppearance){applyRealAppearance(visual,visual.shootoutAppearance.profile,visual.shootoutAppearance.uniform);visual.shootoutAppearance=null;}const speed=Math.hypot(p.vx,p.vz);
    const relocated=visual.lastX===undefined||Math.hypot(p.x-visual.lastX,p.z-visual.lastZ)>4;visual.renderHeading=relocated?p.heading:followHeading(visual.renderHeading,p.heading,match.paused?0:dt);visual.lastX=p.x;visual.lastZ=p.z;
    g.position.set(p.x,VISUAL_SCALE.turfY,p.z);g.rotation.set(0,visual.renderHeading,0);visual.body.rotation.set(0,0,0);visual.shadow.visible=g.visible;visual.shadow.position.set(p.x,.065,p.z);visual.shadow.material.opacity=.18/(1+(p.jump??0)+(p.keeperAction?keeperPose(p).rootY:0));visual.elbows.forEach(elbow=>elbow.rotation.x=0);visual.knees.forEach(knee=>knee.rotation.x=0);
    if(p.distribution){applyDistributionRig(visual,p);
    }else if(p.keeperAction){applyKeeperRig(visual,p);
    }else{
      g.position.y+=(p.jump??0);visual.legs.forEach(leg=>leg.rotation.z=0);
      const pose=locomotionPose({stride:p.stride,speed:active||match.goalWait>0?speed:0,sprint:speed>8,kick:p.kickAnim,style:p.kickStyle,charge:match.charge?.player===p.id?match.kickPower:0,trap:p.trap});
      if(!visual.realistic)g.position.y+=pose.bob;g.rotation.x=visual.realistic?Math.min(.07,speed*.007):pose.lean;g.rotation.z=pose.roll+(p.jostle??0)*.12+Math.sin((p.feint??0)*20)*Math.min(.18,p.feint??0);visual.body.rotation.y=pose.twist;
      visual.legs.forEach((leg,i)=>{leg.rotation.x=dampJoint(leg.rotation.x,pose.hips[i],dt);visual.knees[i].rotation.x=pose.knees[i];visual.elbows[i].rotation.x=pose.elbows[i];});
      const swing=Math.sin(p.stride)*Math.min(.65,speed*.08);
      if(p.aerial){const phase=p.aerial.elapsed/p.aerial.duration;g.rotation.x=-Math.sin(phase*Math.PI)*.28;}
      visual.arms.forEach((arm,j)=>{arm.rotation.x=dampJoint(arm.rotation.x,pose.arms[j],dt);arm.rotation.z=(j===0?1:-1)*(p.throwAnim>0?2.8:p.aerial?.75:.08);});
      if(p.throwAnim>0){const phase=match.throwState?.taker===p.id?match.throwState.elapsed/.65:1;visual.arms.forEach(arm=>arm.rotation.x=-.35-phase*.55);}
      if(p.index===0&&speed<1.1&&match.owner!==p.id){const breathe=Math.sin(match.controlTime*2.3+p.id)*.025;g.position.y+=breathe;visual.knees.forEach(knee=>knee.rotation.x=.22);visual.legs.forEach(leg=>leg.rotation.x=-.1);visual.arms.forEach((arm,i)=>{arm.rotation.x=-.32+breathe;arm.rotation.z=i?.32:-.32;});}
      if(p.celebration>0)applyCelebrationRig(visual,p);
    }
    const chargePlayer=match.restart?.manual?match.restart.taker:match.charge?.player;
    const canWindUp=match.owner===p.id||match.restart?.taker===p.id||match.phase==='shootout'||match.owner<0&&Math.hypot(match.ball.x-p.x,match.ball.z-p.z)<1.6&&match.ball.y<1.6;
    updateRealPlayer(visual,{...p,ownsBall:match.owner===p.id,chargeType:match.charge?.type,wall:p.wallUntil>match.controlTime},match.paused?0:dt,active,!p.holdingBall&&!p.distribution&&canWindUp&&chargePlayer===p.id?match.kickPower:0);
  }
  const b=match.ball,p=match.players[match.mode==='manager'&&match.owner>=0?match.owner:match.selected];
  for(const {net,sign,base} of goalNets){const positions=net.geometry.attributes.position;for(let i=0;i<base.length;i+=3){positions.array[i]=base[i]+netOffset(base[i],base[i+1],base[i+2],sign,match.goalNet);positions.array[i+1]=base[i+1];positions.array[i+2]=base[i+2];}positions.needsUpdate=true;}
  ball.position.set(b.x,ballRenderY(b.y)+ballLift,b.z);if(active||match.goalWait>0&&!match.paused){ball.rotation.x+=b.vz*dt/VISUAL_SCALE.ballRadius;ball.rotation.z-=b.vx*dt/VISUAL_SCALE.ballRadius;}
  ballShadow.position.set(b.x,.085,b.z);ballShadow.material.opacity=.36/(1+(b.y-.34)*.8);ballShadow.scale.setScalar(BALL_VISUAL_SCALE*(1+(b.y-.34)*.22));
  ballMarker.position.set(b.x,.09,b.z);ballMarker.scale.setScalar(1+(b.y-.34)*.12);ballMarker.material.opacity=.6/(1+(b.y-.34)*.35);
  updateOfficialsAndCrowd(match.paused?0:dt);updateSetPieceAim();
  ring.position.set(p.x,.14,p.z);arrow.position.set(p.x,(p.profile?.height??180)/100+.48,p.z);ring.visible=arrow.visible=match.mode==='player'||match.mode==='manager'&&match.owner>=0;ring.material.color.set(match.mode==='manager'?(p.team===0?0x83c6ff:0xff777d):0xc5f773);arrow.material.color.copy(ring.material.color);
  const receiver=match.mode==='player'&&match.owner===match.selected?(match.charge?.type==='cross'?match.crossTarget(p,match.kickPower,match.input):match.charge?.type==='through'?match.throughTarget(p,match.kickPower,match.input):match.passTarget(undefined,match.charge?match.kickPower:.2)):null;receiverRing.visible=!!receiver&&match.running&&!match.ended;
  if(receiver)receiverRing.position.set(receiver.x,.14,receiver.z);
  syncHUD();
  if(now-learningSavedAt>=15000&&clubHome){saveLearning(clubHome.storage,match.learning);learningSavedAt=now;}
  if(homeOpen&&previewRenderer){
    const hero=!$('play-room').hidden&&!$('mode-hub').hidden,host=hero?$('home-player-preview'):$('player-preview'),w=host.clientWidth,h=host.clientHeight;if(previewRenderer.domElement.parentElement!==host)host.appendChild(previewRenderer.domElement);previewPlayer.group.rotation.y=previewYaw+(hero?-.15:0);previewPlayer.body.rotation.z=Math.sin(now*.0015)*.012;previewPlayer.arms.forEach((arm,i)=>{arm.rotation.x=-.045+Math.sin(now*.0017+i)*.018;arm.rotation.z=i?-.045:.045;});previewPlayer.elbows.forEach(elbow=>elbow.rotation.x=-.16);previewPlayer.knees.forEach(knee=>knee.rotation.x=.045);
    updateRealPlayer(previewPlayer,null,dt,false);if(w&&h){const current=previewRenderer.getSize(new THREE.Vector2());if(current.x!==w||current.y!==h){previewRenderer.setSize(w,h,false);previewCamera.aspect=w/h;previewCamera.updateProjectionMatrix();}previewRenderer.render(previewScene,previewCamera);}
  }else{cameraUpdate(dt);drawMap();renderer.render(scene,camera);}
  requestAnimationFrame(frame);
}
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();releaseInputs();match.setPaused(true);message('3D 연결이 끊겼어요. 페이지를 새로고침해주세요.');});
clubHome=initHome({match,preview(profile,index,kit){if(previewPlayer.index!==index){previewPlayer.group.visible=false;previewPlayer.shadow.visible=false;if(!previewModels.has(index)){const next=createPlayer(0,index,previewScene);next.group.position.set(0,.01,0);next.shadow.position.set(0,.065,0);previewModels.set(index,next);}previewPlayer=previewModels.get(index);previewPlayer.group.visible=true;previewPlayer.shadow.visible=true;}applyAppearance(previewPlayer,profile,kit);const scale=previewPlayer.group.scale.y,zoom=Math.max(1,scale*1.02);previewCamera.position.set(2.7*zoom,1.9*zoom,4.2*zoom);previewCamera.lookAt(0,1.07*scale,0);},onApply:applyRosterAppearance,onShow(){syncHUD();},onStart(mode,settings){$('match-sidebar').hidden=true;$('roster-toggle').setAttribute('aria-expanded','false');shownRestart=null;rosterBeforeRestart=true;for(const key of Object.keys(TACTIC_OPTIONS)){const value=mode==='manager'?settings[key]:'balanced';match.setTactic(key,value);$(key).value=value;}
  homeOpen=false;$('home').hidden=true;document.body.classList.remove('home-open');match.reset();const opponent=settings.opponent??{...defaultClub(),name:'상대 팀',kit:KIT_PRESETS.find(k=>k.id!==(match.kit?.id??'psg-home'))};applyClub(match,opponent,1);applyRosterAppearance();configureMode(mode,settings);start();syncHUD();cameraUpdate(0,true);
}});
match.learning=loadLearning(clubHome.storage);syncHUD();cameraUpdate(0,true);requestAnimationFrame(frame);
window.addEventListener('pagehide',()=>saveLearning(clubHome.storage,match.learning));
