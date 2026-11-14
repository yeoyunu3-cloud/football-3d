import {loadLearning,saveLearning} from './opponent-adaptation.js?v=20261114-acro';
import {fillEventRow} from './event-format.js?v=20261114-acro';
import {createOnline,validRoomName} from './online.js?v=20261114-acro';
import {applyClub,defaultClub,sanitizeClub} from './roster.js?v=20261114-acro';
import {ARCHETYPES,archetypeOf,traits,SPECIAL_TRAITS,specialsOf} from './player-traits.js?v=20261114-acro';
import {applyKeeperRig,applyCelebrationRig,applyDistributionRig} from './player-presentation.js?v=20261114-acro';
import {VISUAL_SCALE,FIELD_SCALE,ballRenderY,followHeading} from './visual-scale.js?v=20261114-acro';
import {loadRealPlayerAssets,buildRealAthlete,applyRealAppearance,updateRealPlayer} from './real-player-model.js?v=20261114-acro';
import {locomotionPose,dampJoint} from './player-motion.js?v=20261114-acro';
import {paintKit} from './kit-art.js?v=20261114-acro';
import {KIT_PRESETS,resolveKitClash} from './kits.js?v=20261114-acro';
import {TACTIC_OPTIONS,TACTIC_LABELS} from './tactics.js?v=20261114-acro';
import {netOffset} from './goal-effects.js?v=20261114-acro';
import {CONTROL_PRESETS,DEFAULT_PRESET,DOUBLE_TAP_MS,SKILL_COMMANDS,SKILL_HOLDS,skillArrow,pickSkill,validPreset,keyLabel,actionFor,runAngleFor,movement,isCancelCombo,kickStyleFor,shotModKeys,shotStyleFor,SHOT_LABELS,KICK_LABELS} from './controls.js?v=20261114-acro';
import * as THREE from './vendor/three.module.min.js';
import { Match, FORMATION, NAMES, ROLES, NUMBERS } from './match.js?v=20261114-acro';
import {unlockBallSound,playTouch,playTrap,playKick} from './ball-sound.js?v=20261114-acro';
import { initHome,eventText,EVENT_LABELS,IMPORTANT_EVENTS } from './home.js?v=20261114-acro';
import { saveMatch } from './squads.js?v=20261114-acro';
import { notify,textNode } from './ui.js?v=20261114-acro';
import {DRAWABLE_RESTARTS,kickPreview} from './setpieces.js?v=20261114-acro';
import {officialStep,celebrationPose} from './presentation.js?v=20261114-acro';
import { keeperPose } from './keeper.js?v=20261114-acro';
const match = new Match();

const $ = id => document.getElementById(id);
const message = text => { $('message').textContent = text; };
for(const [key,options] of Object.entries(TACTIC_OPTIONS))for(const [host,prefix] of [[$('manager-setup'),'setup-'],[$('tactics-panel'),'']]){const label=document.createElement('label'),select=document.createElement('select');label.append(TACTIC_LABELS[key]);select.id=prefix+key;for(const [value,name] of options){const option=document.createElement('option');option.value=value;option.textContent=name;select.append(option);}select.value='balanced';label.append(select);host.append(label);if(!prefix)select.onchange=()=>match.setTactic(key,select.value);}

$('tactics-panel').append(document.querySelector('.match-stats'));
let controlPreset=DEFAULT_PRESET;try{controlPreset=validPreset(localStorage.getItem('soccer-controls'));}catch{}
const controls=()=>CONTROL_PRESETS[controlPreset];
function showControls(){const c=controls();const entries=[[c.move,'이동'],[keyLabel(c.sprint),'달리기'],[keyLabel(c.switch),'선수 전환'],[keyLabel(c.pass),'패스'],[keyLabel(c.through),'스루패스'],[keyLabel(c.cross),'크로스'],[keyLabel(c.shoot),'슛·헤딩'],['Esc','경기 메뉴']];for(const host of [$('player-setup'),document.querySelector('.controls-hint')]){host.replaceChildren(...entries.map(([key,label])=>{const span=document.createElement('span'),kbd=document.createElement('kbd');kbd.textContent=key;span.append(kbd,` ${label}`);return span;}));{const extra=document.createElement('small');extra.className='shot-controls';extra.textContent=c.shotMods.map(([key,style])=>`${keyLabel(key)} + ${keyLabel(c.shoot)} ${SHOT_LABELS[style]}`).join(' · ')+(c.defendSwitch?` · ${keyLabel(c.shoot)}${keyLabel(c.shoot)} 깔아차기 · 수비: ${keyLabel(c.tackle)} 스탠딩 태클 · ${keyLabel(c.slideTackle)} 슬라이딩 · ${keyLabel(c.defendSwitch)} 선수 변경 · ${keyLabel(c.helpDefend)} 수비 도움 요청 · Shift + 방향키 선수 바꾸기 · 패스: Q + ${keyLabel(c.pass)} 침투 패스 · C + ${keyLabel(c.pass)} 플레어 패스 · Z + ${keyLabel(c.pass)} 드라이브 땅볼 · Q + ${keyLabel(c.through)} 로빙 스루 · Z + ${keyLabel(c.through)} 침투 스루 · 크로스: Q + ${keyLabel(c.cross)} 얼리 · ${keyLabel(c.cross)}${keyLabel(c.cross)} 땅볼 · ${keyLabel(c.cross)}${keyLabel(c.cross)}${keyLabel(c.cross)} 낮은 · Z + ${keyLabel(c.cross)} 바운싱 로빙 · 침투: ${keyLabel(c.feint)} 누르면 4갈래 표시 → 1~4 선택 · 개인기: Shift + 방향키 조합 · Z + ↓ 드래그 백 · ${keyLabel(c.shoot)} 후 ${keyLabel(c.fakeWith)} 슛 페이크 · ${keyLabel(c.cross)} 후 ${keyLabel(c.fakeWith)} 패스 페이크 · ${keyLabel(c.knockOn)} 퍼스트 터치 · ${Object.keys(c.runAngles).join('~').replace(/~.*~/,'~')} 각도 침투 · ${c.cancel.map(keyLabel).join(' + ')} 취소 · GK ${keyLabel(c.keeperDrop)} 공 놓기`:'');host.append(extra);}}}
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
scene.fog = new THREE.FogExp2(0x101d2b, 0.0028/FIELD_SCALE);
// Stretch the ground plane: simulation x/z map to FIELD_SCALE metres; people and the ball are counter-scaled.
scene.scale.set(FIELD_SCALE,1,FIELD_SCALE);
const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, .1, 400);
const hemi = new THREE.HemisphereLight(0xe5f4ff, 0x394f58, 1.7);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xf3f5ff, 2.6);
sun.position.set(-35, 70, 15);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left:-75*FIELD_SCALE, right:75*FIELD_SCALE, top:60*FIELD_SCALE, bottom:-60*FIELD_SCALE, near:1, far:180 });
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
const dummy=new THREE.Object3D();dummy.scale.set(1/FIELD_SCALE,1,1/FIELD_SCALE);let seatIndex=0;
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
  if(parent===scene){visual.fieldScale=FIELD_SCALE;group.scale.set(1/FIELD_SCALE,1,1/FIELD_SCALE);shadow.scale.set(1/FIELD_SCALE,1/FIELD_SCALE,1);}
  const home=formation[index];group.position.set(team===0?home[0]:-home[0],.12,team===0?home[1]:-home[1]);group.rotation.y=team===0?Math.PI/2:-Math.PI/2;parent.add(group);shadow.position.set(group.position.x,.065,group.position.z);
  return {...visual,shadow,home:group.position.clone(),stamina:100,phase:index*.7};
}
for(let team=0;team<2;team++)for(let i=0;i<11;i++)players.push(createPlayer(team,i));
function applyAppearance(visual,profile,uniform=null){
  if(!profile)return;
  if(visual.realistic){applyRealAppearance(visual,profile,uniform);return;}
  const height=profile.height??180,weight=profile.weight??77,width=THREE.MathUtils.clamp(Math.sqrt(weight/(height/100)**2/24),.8,1.3);
  visual.group.scale.set(width/(visual.fieldScale??1),height/180,width/(visual.fieldScale??1));visual.head.scale.set(.96/Math.pow(width,.6),.94,.96/Math.pow(width,.6));
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
const arrow=new THREE.Mesh(new THREE.ConeGeometry(.25,.43,3),new THREE.MeshBasicMaterial({color:0xc5f773}));arrow.rotation.z=Math.PI;arrow.scale.set(1/FIELD_SCALE,1,1/FIELD_SCALE);scene.add(arrow);
// Run arrow: shows where the Q / 1~4 runner is heading, drawn flat on the turf from the runner to the target.
const runArrowMaterial=new THREE.MeshBasicMaterial({color:0xc5f773,transparent:true,opacity:.85,depthWrite:false,side:THREE.DoubleSide});
const runArrow=new THREE.Group(),runShaft=new THREE.Mesh(new THREE.PlaneGeometry(.42,1),runArrowMaterial),runHeadShape=new THREE.Shape();
runHeadShape.moveTo(-.75,0);runHeadShape.lineTo(.75,0);runHeadShape.lineTo(0,-1.3);runHeadShape.closePath();
const runHead=new THREE.Mesh(new THREE.ShapeGeometry(runHeadShape),runArrowMaterial);runShaft.rotation.x=runHead.rotation.x=-Math.PI/2;runArrow.add(runShaft,runHead);runArrow.visible=false;scene.add(runArrow);
// A short copy at the passer's feet, so the run direction is visible even when the runner is off screen.
const runCue=runArrow.clone();runCue.scale.setScalar(.8);runCue.children[0].scale.y=2.2;runCue.children[0].position.z=1.1;runCue.children[1].position.z=2.2;scene.add(runCue);
// Q run menu: four numbered branches fanning out from the runner (1~4 = 45° · 80° · 135° · 170°).
const runMenuMaterial=new THREE.MeshBasicMaterial({color:0xffe27a,transparent:true,opacity:.9,depthWrite:false,side:THREE.DoubleSide});
const runMenu=new THREE.Group();runMenu.visible=false;scene.add(runMenu);
const runBranches=Object.entries(CONTROL_PRESETS.motive.runAngles).map(([label,angle])=>{
  const arrow=runArrow.clone();arrow.visible=true;arrow.traverse(o=>{if(o.isMesh)o.material=runMenuMaterial;});const shaft=6.2;arrow.children[0].scale.y=shaft;arrow.children[0].position.z=shaft/2;arrow.children[1].position.z=shaft;
  const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');g.fillStyle='#16202b';g.beginPath();g.arc(64,64,54,0,Math.PI*2);g.fill();g.lineWidth=8;g.strokeStyle='#ffe27a';g.stroke();g.fillStyle='#ffe27a';g.font='bold 78px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(label,64,70);
  const tag=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),depthTest:false,transparent:true}));tag.scale.set(2.3,2.3,1);tag.renderOrder=20;
  runMenu.add(arrow,tag);return {angle,arrow,tag};});
// Replay badge (top centre) and the S-skip hint during the celebration and the replay.
const replayBadge=document.createElement('div');replayBadge.className='replay-badge';replayBadge.hidden=true;document.body.append(replayBadge);
{const style=document.createElement('style');style.textContent='.replay-badge{position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:30;display:flex;gap:10px;align-items:center;padding:8px 16px;border-radius:999px;background:rgba(14,20,28,.82);color:#f4f6f8;font:600 14px/1 system-ui,sans-serif;letter-spacing:.04em;pointer-events:none}.replay-badge[hidden]{display:none}.replay-badge b{color:#ff5a4d}.replay-badge kbd{padding:2px 7px;border-radius:5px;background:#f4f6f8;color:#111;font:700 12px/1.3 system-ui,sans-serif}';document.head.append(style);}
let replayBadgeState='';
function updateReplayBadge(){
  const sp=match.restart?.view&&match.mode==='player'?match.restart:null,shootKey=keyLabel(controls().shoot);
  const cross=keyLabel(controls().cross),pass=keyLabel(controls().pass);
  const spText=!sp?'':sp.view==='spectate'?`<b>${({corner:'코너킥',freeKick:'프리킥',penalty:'페널티킥'})[sp.type]??'세트피스'}</b><span>${sp.team===0?'홈 팀':'원정 팀'} · 자동 진행</span>`:sp.type==='corner'?(sp.view==='attack'?`<b>코너킥</b><kbd>←</kbd><kbd>→</kbd><span>조준</span><kbd>${cross}</kbd><span>크로스 · 누른 만큼 멀리</span><kbd>${pass}</kbd><span>짧은 패스</span>`:`<b>코너킥 수비</b><kbd>←</kbd><kbd>→</kbd><span>키퍼 이동 · ${Math.ceil(sp.wait)}초</span>`):sp.view==='attack'?(sp.type==='penalty'?`<b>페널티킥</b><kbd>←</kbd><kbd>→</kbd><span>조준</span><kbd>${shootKey}</kbd><span>누른 만큼 세게</span>`:`<b>프리킥</b><kbd>←</kbd><kbd>→</kbd><span>조준</span><kbd>${shootKey}</kbd><span>슛 · 누른 만큼 세게</span>`):sp.type==='penalty'?`<b>페널티킥 수비</b><kbd>←</kbd><kbd>→</kbd><span>다이빙 방향: ${sp.keeperChoice?(sp.keeperChoice*match.attackSign(0)>0?'왼쪽':'오른쪽'):'가운데'} · ${Math.ceil(sp.wait)}초</span>`:`<b>프리킥 수비</b><kbd>←</kbd><kbd>→</kbd><span>키퍼 이동</span><kbd>${shootKey}</kbd><span>벽 점프 · ${Math.ceil(sp.wait)}초</span>`;
  const state=homeOpen||!match.running||match.ended?'':match.phase==='replay'?'replay':match.phase==='play'&&match.goalWait>0?'celebration':spText;
  if(state===replayBadgeState)return;replayBadgeState=state;replayBadge.hidden=!state;if(spText&&state===spText){replayBadge.innerHTML=spText;return;}
  replayBadge.innerHTML=state==='replay'?'<b>● REPLAY</b><span>골 다시보기</span><kbd>S</kbd><span>건너뛰기</span>':state==='celebration'?'<kbd>S</kbd><span>세리머니 건너뛰기</span>':'';
}
function updateRunMenu(){
  const menu=match.runMenu,r=menu&&menu.until>match.controlTime&&match.owner>=0&&match.players[match.owner].team===0&&!match.charge?match.players[menu.id]:null;
  runMenu.visible=Boolean(r)&&!homeOpen&&match.mode==='player';if(!runMenu.visible)return;
  const s=match.attackSign(0);runMenu.position.set(r.x,.12,r.z);runMenuMaterial.opacity=.9*Math.min(1,(menu.until-match.controlTime)/.4);
  for(const b of runBranches){const a=b.angle*Math.PI/180,dx=s*Math.sin(a),dz=-s*Math.cos(a);b.arrow.rotation.y=Math.atan2(dx,dz);b.tag.position.set(dx*9.2,1.4,dz*9.2);b.tag.material.opacity=runMenuMaterial.opacity/.9;}
}
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
const ball=new THREE.Mesh(new THREE.SphereGeometry(VISUAL_SCALE.ballRadius,24,16),new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(ballTexture),roughness:.55,emissive:0xffffff,emissiveIntensity:.22}));ball.scale.set(BALL_VISUAL_SCALE/FIELD_SCALE,BALL_VISUAL_SCALE,BALL_VISUAL_SCALE/FIELD_SCALE);ball.castShadow=true;scene.add(ball);
const ballMarker=new THREE.Mesh(new THREE.RingGeometry(.34,.46,40),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.6,depthWrite:false}));ballMarker.rotation.x=-Math.PI/2;scene.add(ballMarker);
const ballShadow=new THREE.Mesh(new THREE.CircleGeometry(.15,24),new THREE.MeshBasicMaterial({color:0x092315,transparent:true,opacity:.35,depthWrite:false}));ballShadow.rotation.x=-Math.PI/2;scene.add(ballShadow);
for(const id of ['player-preview','home-player-preview']){const host=$(id);host.onpointerdown=e=>{if(e.button!==0)return;previewDrag={id:e.pointerId,x:e.clientX};host.setPointerCapture(e.pointerId);};host.onpointermove=e=>{if(previewDrag?.id!==e.pointerId)return;previewYaw+=(e.clientX-previewDrag.x)*.012;previewDrag.x=e.clientX;};for(const event of ['pointerup','pointercancel','lostpointercapture'])host.addEventListener(event,()=>previewDrag=null);}
$('preview-reset').onclick=()=>previewYaw=.12;
const keys=new Set(),joy={x:0,y:0};let touchSprint=false,touchShotStyle='auto',renderSelected=-1,lastEvent='',lastClock='',lastScore='',accumulator=0;
const exitDialog=$('exit-dialog');let exitPaused=false;
function updateCard(){const id=match.mode==='manager'?match.owner:match.selected,p=match.players[id],card=document.querySelector('.player-card');card.hidden=match.owner<0||!p;if(!p){renderSelected=-1;return;}$('number').textContent=p.number??numbers[p.index];$('player-name').textContent=p.name??names[p.index];const specials=specialsOf(p).map(id=>SPECIAL_TRAITS[id]?.label).filter(Boolean).join(' · '),type=(p.index===0?'':` · ${ARCHETYPES[archetypeOf(p)].label}`)+(specials?` · ${specials}`:'');$('position').textContent=(match.mode==='manager'?`${p.team===0?'홈':'원정'} · ${p.role}`:p.role)+type;renderSelected=id;card.classList.toggle('away-possession',match.mode==='manager'&&p.team===1);}
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
  // One touch sound per dribble touch from the engine (see Match.integrateBall).
  if(owner>=0){const p=match.players[owner],speed=Math.hypot(p.vx,p.vz);if(!p.holdingBall&&(p.touches??0)!==s.touches&&s.owner===owner)playTouch(owner===match.selected?Math.min(1,.25+speed/14):.12);s.touches=p.touches??0;}
  s.owner=owner;s.kick=match.lastKick;s.lastTouch=match.lastTouch;
}
const physicalKeys={KeyW:'w',KeyA:'a',KeyS:'s',KeyD:'d',KeyQ:'q',KeyE:'e',KeyR:'r',KeyX:'x',KeyZ:'z',KeyC:'c',KeyF:'f',Digit1:'1',Digit2:'2',Digit3:'3',Digit4:'4',Space:' ',ShiftLeft:'shift',ShiftRight:'shift',ControlLeft:'control',ControlRight:'control',Backquote:'`'};
// Double-tap state: a released cross/shot waits DOUBLE_TAP_MS for a second tap (땅볼 크로스 / 깔아차기).
let tapRelease=null,lastTap={};const suppressKeyup=new Set();
function clearTapRelease(){if(tapRelease)clearTimeout(tapRelease.timer);tapRelease=null;}
// Skill input (keyboard skill guide): arrows are read as written in the guide (↑ forward, ← left), buffered while
// Shift (or Z) is held and matched shortly after the last tap; Shift + one arrow held still gives the hold moves.
// The move that comes out depends on the player's skill stars. Shift + arrow on defence switches player.
let skillBuffer=[],skillTimer=null,skillHold=null;
const skillStars=()=>traits(match.players[match.selected]).stars??3;
function fireSkill(options,fallbackSide){const hit=pickSkill(options,skillStars());if(!hit)return false;start();return match.startSkill(hit[1],hit[2]??fallbackSide);}
function skillInput(key){
  const c=controls();if(!c.skill)return false;const ctx=actionContext(),dir=skillArrow(key);if(!dir)return false;
  if(keys.has(c.skill)&&!ctx.attacking){const v={arrowright:[1,0],arrowleft:[-1,0],arrowup:[0,-1],arrowdown:[0,1]}[key];return match.switchToward(v[0],v[1]);}
  if(!ctx.attacking||match.charge)return false;
  const table=keys.has(c.skill)?(keys.has('z')?'shiftZ':keys.has('q')?'shiftQ':'shift'):keys.has('z')?'z':null;if(!table)return false;
  skillBuffer.push(dir);skillHold=table==='shift'?{dir,at:performance.now(),fired:false}:null;clearTimeout(skillTimer);
  skillTimer=setTimeout(()=>{const seq=skillBuffer.join(',');skillBuffer=[];if(skillHold?.fired)return;const commands=SKILL_COMMANDS[table],options=commands[seq]??commands[seq.split(',').at(-1)];
    // A single arrow still held may become a hold move: decide on release, or after 350 ms of holding.
    if(skillHold&&!seq.includes(',')&&keys.has(key)){const hold=skillHold;hold.pendingTap=options;setTimeout(()=>{if(hold!==skillHold||hold.fired)return;hold.fired=true;if(keys.has(key)&&keys.has(c.skill))fireSkill(SKILL_HOLDS[hold.dir]);else fireSkill(hold.pendingTap);},Math.max(0,350-(performance.now()-hold.at)));return;}
    if(fireSkill(options))skillHold&&(skillHold.fired=true);},170);
  return table==='z';
}
function updateSkillHold(){
  const c=controls();if(!skillHold||skillHold.fired||!c.skill||!keys.has(c.skill)){if(skillHold&&!keys.has(c.skill??''))skillHold=null;return;}
  const held=['arrowup','arrowdown','arrowleft','arrowright'].filter(k=>keys.has(k));
  if(held.length!==1||skillArrow(held[0])!==skillHold.dir||performance.now()-skillHold.at<350)return;
  skillHold.fired=true;clearTimeout(skillTimer);skillBuffer=[];if(actionContext().attacking)fireSkill(SKILL_HOLDS[skillHold.dir]);
}
// Non-Shift guide moves: C + Z 볼 저글링, Q + Z 풋 페이크, ` 개구리 점프.
function extraSkill(key){
  if(!actionContext().attacking||match.charge)return false;
  if(key==='z'&&keys.has('c'))return fireSkill([[1,'juggle',1]]);
  if(key==='z'&&keys.has('q'))return fireSkill([[1,'footFake',Math.sign(-match.input.z*match.attackSign(0))||1]]);
  if(key==='`')return fireSkill([[4,'frogJump',1]]);
  return false;
}
// 헛스윙(A·D 후 S), 페이크 패스(E + A 후 S), 힐투힐 / 펜시 드래그 백(C + ↑ + A 후 S), 라보나 페이크(C + ↓ + A 후 S).
function fakeVariant(){const stars=skillStars();if(keys.has('c')&&keys.has('arrowup'))return stars>=5?'fancyDragBack':'heelToHeel';if(keys.has('c')&&keys.has('arrowdown')&&stars>=5)return 'rabonaFake';if(keys.has(controls().sprint)&&stars>=4)return 'fakePass';return null;}
const inputKey=e=>physicalKeys[e.code]??e.key.toLowerCase();
const actionContext=()=>({throwing:match.restart?.type==='throw'&&match.selected===match.restart.taker,defending:!match.restart&&match.owner>=0&&match.players[match.owner]?.team===(online?.isGuest?0:1),attacking:!match.restart&&match.owner>=0&&match.owner===match.selected});
window.addEventListener('keydown',e=>{
  if(homeOpen)return;
  if(e.key==='Escape'){e.preventDefault();if(!e.repeat){if(exitDialog.open)closeExitMenu();else openExitMenu();}return;}
  if(exitDialog.open||['SELECT','INPUT','TEXTAREA'].includes(e.target.tagName))return;
  const key=inputKey(e);
  if(key==='h'&&!e.repeat){toggleControls();e.preventDefault();return;}
  if(key==='s'&&!e.repeat&&match.skipCelebration()){e.preventDefault();return;}
  if(key===controls().shoot&&!e.repeat&&match.wallJump()){e.preventDefault();return;}
  if(match.mode==='manager')return;
  if(key==='r'&&!e.repeat&&(match.charge||match.pending||match.restart?.queuedKick)){match.cancelKick();e.preventDefault();return;}
  if(key==='f'&&match.dropKeeperBall()){e.preventDefault();return;}
  if(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d','shift','q',' ','e','r','x','z','c','f','control','1','2','3','4','`'].includes(key)){
    e.preventDefault();keys.add(key);
    if(!e.repeat&&isCancelCombo(keys,controlPreset)&&(match.charge||match.pending||match.restart?.queuedKick)){match.cancelKick();return;}
    if(!e.repeat&&key===controls().keeperDrop&&match.dropKeeperBall())return;
    if(!e.repeat&&tapRelease?.key===key){const {type,taps=1}=tapRelease,triple=controls().tripleTap?.[type];clearTapRelease();suppressKeyup.add(key);
      // Second tap sets the double-tap style; if a triple-tap style exists, wait once more for a third tap.
      if(taps===1){match.modifyKickStyle(controls().doubleTap[type]);if(triple){tapRelease={key,type,taps:2,timer:setTimeout(()=>{if(tapRelease?.key!==key)return;tapRelease=null;sampleInput();endAction(type);},DOUBLE_TAP_MS)};return;}}
      else match.modifyKickStyle(triple);
      sampleInput();endAction(type);return;}
    const now=performance.now(),doubleTapped=!e.repeat&&now-(lastTap[key]??-1e9)<280;if(!e.repeat)lastTap[key]=now;
    if(!e.repeat&&controls().knockOn&&key===controls().knockOn){sampleInput();if(match.knockOn())return;}
    // D 후 S / A 후 S: a charging shot or cross turned into a fake.
    if(!e.repeat&&key===controls().fakeWith&&['shoot','cross'].includes(match.charge?.type)){clearTapRelease();sampleInput();if(match.fakeKick(fakeVariant()))return;}
    if(!e.repeat&&extraSkill(key))return;
    if(!e.repeat&&key.startsWith('arrow')&&skillInput(key))return;
    if(['q','c','z'].includes(key)&&['pass','through','cross'].includes(match.charge?.type)){const style=kickStyleFor(match.charge.type,keys);if(style!=='auto')match.modifyKickStyle(style);sampleInput();return;}
    if(shotModKeys(controlPreset).includes(key)&&match.charge?.type==='shoot'){match.modifyShotStyle(shotStyleFor(keys,'auto',controlPreset));sampleInput();return;}
    // Read directional input before a same-frame pass or shot.
    sampleInput();
    if(!e.repeat){const action=actionFor(key,controlPreset,actionContext());if(action==='feint'){start();if(!keys.has(controls().skill))match.openRunMenu();}else if(action==='help'){start();match.callDefensiveHelp();}else if(action==='switch')switchPlayer();else if(action==='tackle'){start();match.standTackle();}else if(action==='slide'){start();sampleInput();match.slideTackle();}else if(action==='run'){start();match.callRun(runAngleFor(key,controlPreset));}else if(action)beginAction(action);else start();}
  }
});
window.addEventListener('keyup',e=>{const key=inputKey(e),action=actionFor(key,controlPreset,{...actionContext(),defending:false,attacking:false});keys.delete(key);if(skillHold?.pendingTap&&!skillHold.fired&&skillArrow(key)===skillHold.dir){skillHold.fired=true;fireSkill(skillHold.pendingTap);}if(suppressKeyup.delete(key))return;
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
let setPieceView=null,frameDistance=40;
const clamp01=v=>Math.max(0,Math.min(1,v)),smooth01=v=>{v=clamp01(v);return v*v*(3-2*v);};
function cameraUpdate(dt,immediate=false){
  if(drawing&&!immediate)return;
  const replay=match.phase==='replay',p=replay?match.ball:match.players[match.goalWait>0?match.celebratingPlayer:match.selected],b=match.goalWait>0&&match.goalNet?.elapsed>.9?p:match.ball;
  if(match.phase==='shootout'){camera.position.lerp(camera.aspect<.8?new THREE.Vector3(23*FIELD_SCALE,20,0):new THREE.Vector3(29*FIELD_SCALE,15,0),immediate?1:1-Math.exp(-dt*6));camera.lookAt(49*FIELD_SCALE,1,0);return;}
  // Penalties and close free kicks: a view from behind the ball toward the goal, for the kicker and for the defending side alike.
  const sp=match.restart??(setPieceView&&performance.now()<setPieceView.until&&match.goalWait<=0?setPieceView.restart:null);
  if(sp?.view&&match.mode==='player'){
    if(match.restart)setPieceView={restart:sp,until:performance.now()+1500};
    const K=FIELD_SCALE,f=match.restartForward(sp),corner=sp.type==='corner',back=corner?10.5:sp.type==='penalty'?8.5:10,height=corner?7.5:sp.view==='attack'?3.6:4.6;
    camera.position.lerp(new THREE.Vector3((sp.x-f.x*back)*K,height,(sp.z-f.z*back)*K),immediate?1:1-Math.exp(-dt*5));camera.lookAt(f.tx*K,corner?.6:1.3,f.tz*K);
    return;
  }
  // Parallel touchline camera: screen right is always attacking right.
  const r=match.restart,s=match.attackSign(r?.team??0);
  const x=r?THREE.MathUtils.clamp(r.type==='corner'?r.x-s*8:r.type==='goalKick'?r.x+s*7:r.x+s*6,-47,47):THREE.MathUtils.clamp(match.mode==='manager'?b.x:p.x*.42+b.x*.58,match.goalWait>0?-49:-39,match.goalWait>0?49:39);
  // Player mode follows the play across the pitch so the close broadcast camera keeps players large.
  const z=match.goalWait>0?THREE.MathUtils.clamp(b.z,-29,29):(match.mode==='player'||replay)&&!r?THREE.MathUtils.clamp((p.z*.4+b.z*.6)*.75,-22,22):THREE.MathUtils.clamp(17+(r?r.z:match.mode==='manager'?b.z:p.z*.4+b.z*.6)*.04,15.5,18.5);
  const ideal=new THREE.Vector3(x*FIELD_SCALE,0,z*FIELD_SCALE);
  focus.lerp(ideal,immediate?1:1-Math.exp(-dt*(r?7:4.5)));
  cameraTarget.copy(focus);if(match.mode==='player'&&!r&&match.goalWait<=0)cameraTarget.y=1;
  const narrow=camera.aspect<.8;
  const direct=(match.mode==='player'||replay)&&!r;
  // Broadcast view that frames the play: it zooms out until the players around the ball (the ten nearest,
  // both teams) fit on screen with a margin, and eases back in when the play is tight. ~35° down.
  if(direct){
    const near=match.players.filter(q=>!q.sentOff&&q.index>0).sort((a,c)=>Math.hypot(a.x-b.x,a.z-b.z)-Math.hypot(c.x-b.x,c.z-b.z)).slice(0,10);
    const halfWidth=Math.max(...near.map(q=>Math.abs(q.x*FIELD_SCALE-focus.x)))+6,depth=Math.max(...near.map(q=>Math.abs(q.z*FIELD_SCALE-focus.z)))+5;
    const hFov=2*Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect),want=Math.max(halfWidth/Math.tan(hFov/2),depth*1.9);
    frameDistance+=(THREE.MathUtils.clamp(want,narrow?46:38,narrow?70:60)-frameDistance)*(immediate?1:1-Math.exp(-dt*1.4));
  }
  const fd=frameDistance,sinA=.57,cosA=.82;
  cameraPosition.set(focus.x,narrow?36:direct?fd*sinA:43,focus.z+(narrow?38:direct?fd*cosA:25));
  // Replay: a lower, closer angle that tracks the ball.
  if(replay)cameraPosition.set(focus.x,narrow?24:13,focus.z+(narrow?30:22));
  if(match.goalWait>0)cameraPosition.set(focus.x,28,focus.z+20);
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
  if(lastEvent!==match.event){message('');lastEvent=match.event;}
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
  const notice=match.notice;$('match-announcement').hidden=true;
  $('match-announcement').dataset.team=String(notice?.team??'');
  if(notice){$('match-announcement').dataset.type=notice.type;$('announcement-title').textContent=notice.title;$('announcement-detail').textContent=notice.message;}
  const r=match.restart;
  if(r){$('match-announcement').hidden=true;$('match-announcement').dataset.type='restart';
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
// Target ring on the goal mouth for the behind-the-ball free kick / penalty view.
const aimTarget=new THREE.Mesh(new THREE.RingGeometry(.3,.46,28),new THREE.MeshBasicMaterial({color:0xffe27a,transparent:true,opacity:.95,depthTest:false,side:THREE.DoubleSide}));aimTarget.rotation.y=Math.PI/2;aimTarget.renderOrder=25;aimTarget.visible=false;scene.add(aimTarget);
function updateSetPieceAim(){
  {const v=match.restart;aimTarget.visible=Boolean(v?.manual&&v.view==='attack'&&v.type!=='corner'&&match.mode==='player');if(aimTarget.visible)aimTarget.position.set(match.attackSign(v.team)*52.4,1.15,v.aimZ);}
  const r=match.restart,pk=match.phase==='shootout'?match.shootout:null;if(pk){drawnTarget.visible=false;setPieceAim.visible=pk.turn===0&&match.mode==='player'&&['prepare','aim'].includes(pk.stage);if(setPieceAim.visible){const points=[new THREE.Vector3(41.5,.18,0),new THREE.Vector3(52.5,.18,pk.aim)];if(setPieceAim.geometry.getAttribute('position').count!==2){setPieceAim.geometry.dispose();setPieceAim.geometry=new THREE.BufferGeometry().setFromPoints(points);}else setPieceAim.geometry.setFromPoints(points);setPieceAim.computeLineDistances();}return;}setPieceAim.visible=Boolean(r?.manual);drawnTarget.visible=Boolean(r?.manual&&r.plan);if(r?.plan)drawnTarget.position.set(r.plan.end.x,.13,r.plan.end.z);if(!r?.manual)return;
  let points;if(r.plan)points=kickPreview(r,r.plan).map(p=>new THREE.Vector3(p.x,p.y,p.z));
  else {const end=['penalty','freeKick','indirect'].includes(r.type)?{x:match.attackSign(r.team)*52.5,z:r.aimZ}:{x:r.x+r.aim.x*18,z:r.z+r.aim.z*18};points=[new THREE.Vector3(r.x,.18,r.z),new THREE.Vector3(end.x,.18,end.z)];}
  if(setPieceAim.geometry.getAttribute('position').count!==points.length){setPieceAim.geometry.dispose();setPieceAim.geometry=new THREE.BufferGeometry().setFromPoints(points);}else setPieceAim.geometry.setFromPoints(points);setPieceAim.computeLineDistances();
}
const kickRay=new THREE.Raycaster(),kickPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);let drawing=null;
function pitchPointer(e){const rect=renderer.domElement.getBoundingClientRect(),point=new THREE.Vector3();kickRay.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);return kickRay.ray.intersectPlane(kickPlane,point)?{x:point.x/FIELD_SCALE,z:point.z/FIELD_SCALE}:null;}
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
  if((!exitDialog.open||!match.canPause)&&!homeOpen){accumulator=Math.min(accumulator+dt/FIELD_SCALE*(match.mode==='manager'&&match.phase==='play'&&!match.restart&&!match.goalWait&&!match.cardWait?matchSpeed:1),.24);while(accumulator>=1/120){match.step(1/120);accumulator-=1/120;}}else accumulator=0;
  updateBallSound(dt);updateRunArrow();updateRunMenu();updateReplayBadge();updateSkillHold();
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
      if(p.aerial){const phase=clamp01(p.aerial.elapsed/p.aerial.duration),arc=Math.sin(phase*Math.PI),style=p.aerial.style??'header';
        // Acrobatic finishes in phases timed in seconds so the strike lands when the ball arrives (~0.28 s after
        // the jump starts): set → take-off → strike → fall → land on the back/side → get up. Every curve starts
        // and ends at rest, so the move blends in and out of the run cycle without snapping.
        const T=p.aerial.elapsed,ss=(a,b)=>smooth01((T-a)/(b-a)),bell=(a,m,b)=>T<m?ss(a,m):1-ss(m,b);
        if(style==='bicycle'){
          const crouch=bell(0,.06,.14),tilt=ss(.05,.26)*(1-ss(.85,1.2)),kick=bell(.12,.28,.44),swap=ss(.12,.28),lie=bell(.4,.62,1.2);
          g.rotation.y=visual.renderHeading+Math.PI*ss(0,.14);g.rotation.x=-1.45*tilt;g.position.y+=-.16*crouch+.25*bell(.1,.3,.5)-.5*lie*tilt;
          visual.legs[0].rotation.x=-.3*crouch-2.1*kick+.4*swap*(1-kick)*(1-lie);visual.legs[1].rotation.x=.25*crouch-.9*bell(.06,.18,.3)+.5*swap*lie;
          visual.knees[0].rotation.x=.7*crouch+.2*kick;visual.knees[1].rotation.x=.7*crouch+1.2*bell(.06,.18,.34);
          visual.arms.forEach((arm,i)=>{arm.rotation.x=-.4*crouch+(-1.1+.4*i)*tilt;arm.rotation.z=(i?-1:1)*(.3+1.1*tilt);});
        }else if(style==='scissor'){
          const crouch=bell(0,.06,.14),side=ss(.05,.24)*(1-ss(.75,1.05)),kick=bell(.12,.28,.44),lie=bell(.38,.58,1.05);
          g.rotation.z=1.3*side;g.rotation.x=-.25*side;g.position.y+=-.14*crouch+.18*bell(.1,.28,.48)-.38*lie*side;
          visual.legs[0].rotation.x=-.25*crouch-1.7*kick;visual.legs[1].rotation.x=.2*crouch+.6*kick-.5*bell(.04,.16,.28);visual.knees[0].rotation.x=.6*crouch+.15*kick;visual.knees[1].rotation.x=.6*crouch+.9*kick;
          visual.arms.forEach((arm,i)=>{arm.rotation.x=-.3*crouch-.6*side;arm.rotation.z=(i?-1:1)*(.3+.9*side);});
        }else if(style==='volley'){
          const plant=bell(0,.12,.26),kick=bell(.12,.28,.46),follow=bell(.28,.42,.62);
          g.rotation.x=.12*plant+.22*kick;g.rotation.z=.18*kick;g.position.y+=-.08*plant;
          visual.legs[0].rotation.x=.45*plant-1.35*kick-.3*follow;visual.knees[0].rotation.x=.9*plant+.2*(1-kick);visual.legs[1].rotation.x=-.15*kick;visual.knees[1].rotation.x=.35*plant;
          visual.arms.forEach((arm,i)=>{arm.rotation.z=(i?-1:1)*(.25+.9*kick);});
        }else g.rotation.x=-arc*.28;}
      if(!p.aerial||(p.aerial.style??'header')==='header')visual.arms.forEach((arm,j)=>{arm.rotation.x=dampJoint(arm.rotation.x,pose.arms[j],dt);arm.rotation.z=(j===0?1:-1)*(p.throwAnim>0?2.8:p.aerial?.75:.08);});
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
  ballShadow.position.set(b.x,.085,b.z);ballShadow.material.opacity=.36/(1+(b.y-.34)*.8);{const r=BALL_VISUAL_SCALE*(1+(b.y-.34)*.22);ballShadow.scale.set(r/FIELD_SCALE,r/FIELD_SCALE,r);}
  ballMarker.position.set(b.x,.09,b.z);{const r=1+(b.y-.34)*.12;ballMarker.scale.set(r/FIELD_SCALE,r/FIELD_SCALE,r);}ballMarker.material.opacity=.6/(1+(b.y-.34)*.35);
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
// ---- Online 1 vs 1: room dialog (create with a name + optional password, or join by name) ----
const onlineDialog=document.createElement('dialog');onlineDialog.className='online-dialog';
onlineDialog.innerHTML=`<form method="dialog" class="online-form"><h2>온라인 1vs1</h2><p class="online-note">방을 만든 사람이 홈 팀, 들어온 사람이 원정 팀입니다. 서로의 브라우저가 직접 연결됩니다.</p>
<section class="room-list-box"><div class="room-list-head"><b>방 목록</b><span id="lobby-state">연결 중…</span><button type="button" id="lobby-refresh" class="ghost small" aria-label="방 목록 새로고침">새로고침</button></div><ul id="room-list" class="room-list" aria-live="polite"></ul></section>
<label>방 이름<input id="online-room" maxlength="20" autocomplete="off" placeholder="예: myroom12" required></label>
<label>비밀번호 <small>(선택 — 넣으면 비밀번호를 아는 사람만 입장)</small><input id="online-password" type="password" maxlength="30" autocomplete="off" placeholder="비워 두면 공개 방"></label>
<p id="online-status" class="online-status" role="status"></p>
<div class="online-actions"><button type="button" id="online-create">방 만들기</button><button type="button" id="online-join">방 참가</button><button type="button" id="online-cancel" class="ghost">닫기</button></div></form>`;
document.body.append(onlineDialog);
{const style=document.createElement('style');style.textContent='.online-dialog{border:1px solid #2c3948;border-radius:16px;background:#131b25;color:#eef2f6;padding:0;width:min(440px,92vw)}.online-dialog::backdrop{background:rgba(5,8,12,.72)}.online-form{display:grid;gap:14px;padding:24px}.online-form h2{margin:0;font-size:20px}.online-note{margin:0;color:#9fb0c3;font-size:13px;line-height:1.5}.online-form label{display:grid;gap:6px;font-size:13px;color:#c9d4e0}.online-form label small{color:#8395a8}.online-form input{padding:10px 12px;border-radius:9px;border:1px solid #33435a;background:#0d131b;color:#eef2f6;font-size:15px}.online-status{margin:0;min-height:20px;font-size:13px;color:#c5f773}.online-status[data-kind=error]{color:#ff8a7a}.online-status[data-kind=wait]{color:#ffe27a}.online-actions{display:flex;gap:8px;flex-wrap:wrap}.online-actions button{flex:1;padding:11px 12px;border-radius:9px;border:0;background:#c5f773;color:#10200a;font-weight:700;font-size:14px;cursor:pointer}.online-actions button.ghost{background:#263242;color:#dbe4ee;flex:0 0 auto}.online-actions button:disabled{opacity:.5;cursor:default}.room-list-box{display:grid;gap:8px;padding:12px;border-radius:12px;background:#0d131b;border:1px solid #233142}.room-list-head{display:flex;align-items:center;gap:8px;font-size:13px}.room-list-head span{flex:1;color:#8395a8;font-size:12px}.room-list-head .small{padding:5px 10px;border-radius:7px;border:0;background:#263242;color:#dbe4ee;font-size:12px;cursor:pointer}.room-list{list-style:none;margin:0;padding:0;display:grid;gap:6px;max-height:210px;overflow:auto}.room-list li button{width:100%;display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:9px;border:1px solid #2a384a;background:#16202c;color:#eef2f6;font-size:14px;text-align:left;cursor:pointer}.room-list li button:hover:not(:disabled){border-color:#c5f773}.room-list li button:disabled{opacity:.55;cursor:default}.room-list .room-name{flex:1;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.room-list .room-team{color:#8fa1b5;font-size:12px;font-weight:400}.room-list .room-tag{font-size:11px;padding:3px 7px;border-radius:999px;background:#24331a;color:#c5f773;white-space:nowrap}.room-list .room-tag.playing{background:#3a2a1a;color:#ffc27a}.room-list .room-empty{padding:14px;text-align:center;color:#8395a8;font-size:13px}';document.head.append(style);}
const onlineStatus=(text,kind='info')=>{$('online-status').textContent=text;$('online-status').dataset.kind=kind;};
function renderRooms(rooms){
  const host=$('room-list');host.replaceChildren();
  if(!rooms.length){const li=document.createElement('li');li.className='room-empty';li.textContent='열린 방이 없습니다. 방을 만들어 보세요.';host.append(li);return;}
  for(const room of rooms){const li=document.createElement('li'),b=document.createElement('button');b.type='button';b.disabled=room.status==='playing';
    const name=document.createElement('span');name.className='room-name';name.textContent=(room.locked?'🔒 ':'')+room.name;if(room.team){const t=document.createElement('span');t.className='room-team';t.textContent=` · ${room.team}`;name.append(t);}
    const tag=document.createElement('span');tag.className='room-tag'+(room.status==='playing'?' playing':'');tag.textContent=room.status==='playing'?'경기 중':room.locked?'비밀번호':'참가 가능';
    b.append(name,tag);b.onclick=()=>{$('online-room').value=room.name;if(room.locked){$('online-password').value='';$('online-password').focus();onlineStatus('비밀번호를 입력하고 방 참가를 누르세요.','wait');}else onlineAction('join');};
    li.append(b);host.append(li);}
}
function toggleControls(force){const on=force??!document.body.classList.contains('show-controls');document.body.classList.toggle('show-controls',on);$('controls-toggle').setAttribute('aria-expanded',String(on));}
$('controls-toggle').onclick=()=>toggleControls();
var online=createOnline({match,onRooms:renderRooms,onLobbyState:state=>{$('lobby-state').textContent={directory:'연결됨',client:'연결됨',reconnecting:'다시 연결 중…',unavailable:'방 목록을 불러올 수 없습니다'}[state]??'';},getClub:()=>sanitizeClub({...clubHome.club,name:clubHome.squadName??clubHome.club.name}),
  launch(role,homeClub,awayClub){onlineDialog.close();applyClub(match,sanitizeClub(homeClub),0);clubHome.start('player',{opponent:sanitizeClub(awayClub)});},
  onStatus:onlineStatus,
  onClosed(reason,role){if(role==='guest'){alert(reason);location.reload();}else if(role==='host'){match.announce?.('info','온라인',reason,4);onlineStatus(reason,'error');}}});
function onlineBusy(busy){for(const id of ['online-create','online-join'])$(id).disabled=busy;}
async function onlineAction(kind){
  const room=$('online-room').value.trim(),password=$('online-password').value;
  if(!validRoomName(room)){onlineStatus('방 이름은 2~20자의 영문·숫자·한글·-·_ 만 쓸 수 있습니다.','error');return;}
  onlineBusy(true);onlineStatus(kind==='create'?'방을 만드는 중…':'방에 접속하는 중…','wait');
  try{if(kind==='create')await online.createRoom(room,password);else await online.joinRoom(room,password);}catch(error){onlineStatus(error.message,'error');onlineBusy(false);}
}
$('online-mode').onclick=()=>{onlineStatus('');onlineBusy(false);onlineDialog.showModal();online.openLobby();};
$('lobby-refresh').onclick=()=>online.refreshLobby();renderRooms([]);
$('online-create').onclick=()=>onlineAction('create');$('online-join').onclick=()=>onlineAction('join');
$('online-cancel').onclick=()=>{if(online.role&&!online.active)online.close();onlineDialog.close();};
match.learning=loadLearning(clubHome.storage);syncHUD();cameraUpdate(0,true);requestAnimationFrame(frame);
window.addEventListener('pagehide',()=>saveLearning(clubHome.storage,match.learning));
