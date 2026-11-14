import {sculptFootballGeometry,buildHairGeometry} from './athlete-sculpt.js?v=20261114-runs';
import {reshapeAthlete} from './athlete-proportions.js?v=20261114-runs';
import {VISUAL_SCALE,gaitFor,strideRate} from './visual-scale.js?v=20261114-runs';
import * as THREE from './vendor/three.module.min.js';
import {GLTFLoader} from './vendor/loaders/GLTFLoader.js';
import {clone as cloneRig} from './vendor/utils/SkeletonUtils.js';

// GameplayFootball/soccerviewer body + Microsoft Rocketbox textured head.
// Provenance, original licences and the reproducible head conversion are in
// assets/players/ and scripts/extract-licensed-head.mjs.
let template,faceGeometry,faceColour,faceNormal,clips;
let athleteScale=1,athleteFloor=0;
const textureCache=new Map(),axis=new THREE.Quaternion(),euler=new THREE.Euler();
let fabricBump;
function clothSurface(){
  if(fabricBump)return fabricBump;
  const size=512,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const waist=Math.exp(-(((y/size-.335)/.055)**2)),crease=Math.sin(x*.13+y*.43)*8*waist,weave=(x%3===0?-7:3)+(y%3===0?-4:2),value=Math.round(128+crease+weave),i=(y*size+x)*4;
    data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;
  }
  fabricBump=new THREE.DataTexture(data,size,size);fabricBump.flipY=false;fabricBump.needsUpdate=true;return fabricBump;
}
const names={idle:'movement/idle/000_idlelevel1',walk:'ballcontrol/walk/000',run:'movement/sprint/000_idlelevel1',dribble:'ballcontrol/sprint/000',pass:'pass/idle/000',shot:'shot/idle/020',cross:'highpass/idle/000_long',header:'pass/idle/nonbase/000_header_jump_forwards',throw:'highpass/idle/special/000_throw',slide:'sliding/sprint/000',tackle:'interfere/sprint/000_reach'};
const mirror=name=>name.startsWith('left_')?'right_'+name.slice(5):name.startsWith('right_')?'left_'+name.slice(6):name;
export function fullStride(clip){
  const lookup=new Map(clip.tracks.map(t=>[t.name,t]));
  const tracks=clip.tracks.map(track=>{
    const [node,property]=track.name.split('.'),other=lookup.get(`${mirror(node)}.${property}`)??track,size=track.getValueSize(),times=[...track.times],values=[...track.values];
    for(let i=0;i<other.times.length;i++){const t=other.times[i]+clip.duration;if(t<=times.at(-1)+1e-6)continue;const value=Array.from(other.values.slice(i*size,(i+1)*size));if(property==='quaternion'){value[1]*=-1;value[2]*=-1;}else value[0]*=-1;times.push(t);values.push(...value);}
    const end=clip.duration*2,tail=Math.min(.12,clip.duration*.25),first=values.slice(0,size);
    // The source head/shoulder tracks have small endpoint offsets. Blend the
    // final support phase into the opening pose, avoiding a visible loop snap.
    if(times.at(-1)<end-1e-5){times.push(end);values.push(...first);}
    for(let i=0;i<times.length;i++)if(times[i]>end-tail){const t=THREE.MathUtils.smoothstep(times[i],end-tail,end),offset=i*size;if(property==='quaternion'){const a=new THREE.Quaternion().fromArray(values,offset),b=new THREE.Quaternion().fromArray(first);a.slerp(b,t).normalize().toArray(values,offset);}else for(let c=0;c<size;c++)values[offset+c]+=(first[c]-values[offset+c])*t;}
    return new track.constructor(track.name,times,values);
  });return new THREE.AnimationClip(clip.name+'-full-stride',clip.duration*2,tracks);
}
function removeOldHead(geometry){
  const g=geometry.index?geometry.toNonIndexed():geometry.clone(),out={position:[],normal:[],uv:[],skinIndex:[],skinWeight:[]},position=g.attributes.position;
  for(let i=0;i<position.count;i+=3){if([0,1,2].every(n=>position.getZ(i+n)>1.545))continue;for(const [name,values] of Object.entries(out)){const a=g.getAttribute(name);for(let n=0;n<3;n++)for(let c=0;c<a.itemSize;c++)values.push(a.array[(i+n)*a.itemSize+c]);}}
  const result=new THREE.BufferGeometry();for(const [name,values] of Object.entries(out)){const a=g.getAttribute(name),Type=name==='skinIndex'?Uint16Array:Float32Array;result.setAttribute(name,new THREE.BufferAttribute(new Type(values),a.itemSize));}result.computeBoundingSphere();return result;
}
export async function loadRealPlayerAssets(){
  if(template)return;
  const loader=new GLTFLoader(),textures=new THREE.TextureLoader();
  const [motion,sculpt,head,colour,normal]=await Promise.all([
    loader.loadAsync(new URL('./assets/players/motions.glb',import.meta.url).href),loader.loadAsync(new URL('./assets/players/footballer.glb',import.meta.url).href),
    fetch(new URL('./assets/players/faces/face08.json',import.meta.url).href).then(r=>{if(!r.ok)throw Error('Head mesh unavailable');return r.json();}),
    textures.loadAsync(new URL('./assets/players/faces/face08-color.png',import.meta.url).href),textures.loadAsync(new URL('./assets/players/faces/face08-normal.png',import.meta.url).href)
  ]);
  motion.scene.updateMatrixWorld(true);sculpt.scene.updateMatrixWorld(true);
  const targets={};motion.scene.traverse(o=>{if(o.isSkinnedMesh)targets[o.material.name]=o;});
  const anchor=targets.kit,bones=new Map(anchor.skeleton.bones.map((b,i)=>[b.name,i]));
  sculpt.scene.traverse(o=>{
    if(!o.isSkinnedMesh)return;
    const sourceBone=o.skeleton.bones.findIndex(b=>b.name===anchor.skeleton.bones[0].name),transform=new THREE.Matrix4().copy(anchor.skeleton.boneInverses[0]).invert().multiply(o.skeleton.boneInverses[sourceBone]);
    let geometry=o.geometry.clone();geometry.applyMatrix4(transform);
    const indices=geometry.attributes.skinIndex,mapping=o.skeleton.bones.map(b=>bones.get(b.name)??0);
    for(let i=0;i<indices.array.length;i++)indices.array[i]=mapping[indices.array[i]];
    if(o.material.name==='skin')geometry=removeOldHead(geometry);
    geometry=sculptFootballGeometry(geometry,o.material.name);
    const target=targets[o.material.name];
    if(target)target.geometry=geometry;
    else{const mesh=new THREE.SkinnedMesh(geometry,o.material);mesh.position.copy(anchor.position);mesh.quaternion.copy(anchor.quaternion);mesh.scale.copy(anchor.scale);anchor.parent.add(mesh);mesh.bind(anchor.skeleton,anchor.bindMatrix);}
  });
  const oldHair=[];motion.scene.traverse(o=>{if(o.isMesh&&!o.isSkinnedMesh&&o.material.name==='hair')oldHair.push(o);});oldHair.forEach(o=>o.removeFromParent());
  reshapeAthlete(motion.scene,motion.animations);
  faceGeometry=new THREE.BufferGeometry();faceGeometry.setAttribute('position',new THREE.Float32BufferAttribute(head.positions,3));faceGeometry.setAttribute('normal',new THREE.Float32BufferAttribute(head.normals,3));faceGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(head.uvs,2));const hairWeights=[];for(let i=0;i<faceGeometry.attributes.position.count;i++){const a=faceGeometry.attributes.position,z=a.getZ(i),x=Math.abs(a.getX(i)),back=a.getY(i);hairWeights.push(THREE.MathUtils.smoothstep(z,.13,.17)*Math.max(THREE.MathUtils.smoothstep(z,.16,.19),back>-.025?1:0));a.setZ(i,z+.10);}faceGeometry.setAttribute('hairMask',new THREE.Float32BufferAttribute(hairWeights,1));faceGeometry.computeBoundingSphere();
  faceColour=colour;faceColour.colorSpace=THREE.SRGBColorSpace;faceColour.anisotropy=8;faceNormal=normal;
  clips={};
  for(const clip of motion.animations){for(const track of clip.tracks)if(track.name==='player.position'){const base=track.values[2];for(let i=0;i<track.values.length;i+=3){track.values[i]=0;track.values[i+1]=0;track.values[i+2]-=base;}}}
  for(const [key,name] of Object.entries(names)){const clip=motion.animations.find(c=>c.name===name);if(!clip)throw Error('Missing player motion: '+name);clips[key]=['walk','run','dribble'].includes(key)?fullStride(clip):clip;}
  template=motion.scene;
  const testHead=new THREE.Mesh(faceGeometry,new THREE.MeshBasicMaterial());template.getObjectByName('neck').add(testHead);template.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(template,true);athleteScale=VISUAL_SCALE.playerHeight/(bounds.max.y-bounds.min.y);athleteFloor=-bounds.min.y*athleteScale;
  testHead.removeFromParent();testHead.material.dispose();
}

function kitAtlas(profile,uniform){
  const keeper=profile.role==='GK',shirt=keeper?uniform.keeper:uniform.shirt,key=JSON.stringify([uniform,keeper,profile.number,profile.skin]);if(textureCache.has(key))return textureCache.get(key);
  const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d'),W=512;
  const band=(start,end,colour)=>{ctx.fillStyle=colour;ctx.fillRect(0,Math.round(start*W),W,Math.ceil((end-start)*W)+1);};
  band(0,.397,shirt);band(.397,.567,uniform.shorts);band(.567,.760,uniform.socks);band(.760,.98,keeper?'#e6ece9':profile.skin??'#d3a381');band(.98,1,'#17191b');
  ctx.save();ctx.beginPath();ctx.rect(0,0,W,.397*W);ctx.clip();
  if(!keeper&&uniform.pattern==='hechter')for(const centre of [.25,.75]){ctx.fillStyle='#f3f3ef';ctx.fillRect((centre-.038)*W,0,.076*W,.397*W);ctx.fillStyle='#c52d43';ctx.fillRect((centre-.028)*W,0,.056*W,.397*W);}
  if(!keeper&&uniform.pattern==='madrid'){ctx.strokeStyle='#b39c642d';ctx.lineWidth=1.5;for(let x=0;x<W;x+=24){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,.397*W);ctx.stroke();}}
  // Low-contrast fabric grain and seam shading, with club colours remaining
  // readable under the actual stadium lighting.
  for(let x=0;x<W;x+=3){ctx.fillStyle=x%6?'#ffffff07':'#00000007';ctx.fillRect(x,0,1,.397*W);}
  for(const centre of [.25,.75]){const shade=ctx.createLinearGradient((centre-.2)*W,0,(centre+.2)*W,0);shade.addColorStop(0,'#00000028');shade.addColorStop(.45,'#ffffff08');shade.addColorStop(1,'#00000028');ctx.fillStyle=shade;ctx.fillRect((centre-.2)*W,0,.4*W,.397*W);}
  ctx.restore();
  const light=new THREE.Color(shirt).getHSL({h:0,s:0,l:0}).l,ink=light>.65?'#192333':'#f1f2e9';ctx.fillStyle=ink;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`900 ${.132*W}px system-ui`;
  if(profile.number!=null){ctx.save();ctx.translate(.75*W,.21*W);const width=ctx.measureText(String(profile.number??10)).width;ctx.scale(Math.min(1,.145*W/width),1);ctx.fillText(profile.number,0,0);ctx.restore();}
  for(const centre of [.25,.75]){
    ctx.fillStyle=ink;ctx.fillRect((centre-.04)*W,.007*W,.08*W,.005*W);
    
  }
  if(!keeper){
    ctx.fillStyle=ink;ctx.font='700 13px system-ui';ctx.fillText(uniform.pattern==='madrid'?'MADRID':'PARIS',.25*W,.19*W);
    ctx.strokeStyle=ink;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(.32*W,.105*W,.012*W,.015*W,0,0,Math.PI*2);ctx.stroke();
  }
  band(.397,.409,keeper?'#243e43':uniform.shorts);band(.550,.558,shirt);band(.574,.580,ink);band(.593,.598,ink);
  ctx.strokeStyle='#ffffff26';ctx.lineWidth=1;for(const x of [.11,.39,.61,.89]){ctx.beginPath();ctx.moveTo(x*W,.416*W);ctx.lineTo(x*W,.548*W);ctx.stroke();}
  const texture=new THREE.CanvasTexture(c);texture.flipY=false;texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;textureCache.set(key,texture);return texture;
}
export function buildRealAthlete(team,index){
  if(!template)throw Error('Player assets have not loaded');
  const group=new THREE.Group(),model=cloneRig(template);model.scale.setScalar(athleteScale);model.position.y=athleteFloor;group.add(model);
  const bones={};model.traverse(o=>{if(o.isBone)bones[o.name]=o;if(o.isMesh){o.material=o.material.clone();o.castShadow=true;o.receiveShadow=false;o.frustumCulled=false;}});
  const restBones=new Map(Object.values(bones).map(b=>[b.name,b.quaternion.clone()]));const materials={};model.traverse(o=>{if(o.isMesh)materials[o.material.name]=o.material;});
  materials.skin.map=null;materials.skin.normalMap=null;materials.skin.roughness=.76;
  if(materials.shoe){materials.shoe.roughness=.48;materials.shoe.color.set(['#ebeee9','#cde78b','#e8bcaf','#d6dfe7'][index%4]);}if(materials.shoe_sole)materials.shoe_sole.roughness=.6;
  materials.kit.bumpMap=clothSurface();materials.kit.bumpScale=.006;
  const faceMaterial=new THREE.MeshStandardMaterial({map:faceColour,normalMap:faceNormal,normalScale:new THREE.Vector2(.55,.55),roughness:.62});
  faceMaterial.userData.hairColour={value:new THREE.Color('#292329')};faceMaterial.onBeforeCompile=shader=>{shader.uniforms.hairColour=faceMaterial.userData.hairColour;shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float hairMask; varying float vHairMask;').replace('#include <begin_vertex>','#include <begin_vertex>\nvHairMask=hairMask;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 hairColour; varying float vHairMask;').replace('#include <map_fragment>','#include <map_fragment>\nfloat hairLight=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)); diffuseColor.rgb=mix(diffuseColor.rgb,hairColour*clamp(.55+hairLight*3.0,.55,1.2),vHairMask*(1.0-smoothstep(.18,.4,hairLight)));');};
  const headMount=new THREE.Group();bones.neck.add(headMount);const face=new THREE.Mesh(faceGeometry,faceMaterial);face.castShadow=true;headMount.add(face);
  const hairMaterial=new THREE.MeshStandardMaterial({color:'#292329',roughness:.93}),hair=new THREE.Mesh(buildHairGeometry(faceGeometry,index%3),hairMaterial);hair.castShadow=true;headMount.add(hair);
  headMount.scale.set(index%3===0?1.02:.98,.98,.96);
  const proxy=()=>new THREE.Group(),arms=[proxy(),proxy()],elbows=[proxy(),proxy()],legs=[proxy(),proxy()],knees=[proxy(),proxy()];
  for(let i=0;i<2;i++){const mount=new THREE.Group();mount.rotation.x=Math.PI/2;bones[i?'left_shoulder':'right_shoulder'].add(mount);mount.add(arms[i]);}
  const mixer=new THREE.AnimationMixer(model),actions={};for(const [name,clip] of Object.entries(clips))actions[name]=mixer.clipAction(clip);
  actions.idle.play();mixer.update(.01);
  const visual={realistic:true,group,model,bones,restBones,head:headMount,body:proxy(),arms,elbows,legs,knees,mixer,actions,actionName:'idle',clock:0,skin:materials.skin,faceMaterial,kit:materials.kit,handMaterial:materials.hands,shorts:new THREE.MeshStandardMaterial(),sockMaterial:new THREE.MeshStandardMaterial(),sleeveMaterial:new THREE.MeshStandardMaterial(),hairMaterial,trim:new THREE.MeshStandardMaterial(),labels:[],team,index};
  applyRealAppearance(visual,{height:index?180:190,weight:77,skin:['#e4b18f','#c18e69','#935b41'][index%3],hair:'#292329',role:index?'ST':'GK',number:index+1},{id:'base',shirt:team?'#f4f2ea':'#142342',shorts:team?'#f4f2ea':'#142342',socks:team?'#f4f2ea':'#142342',keeper:'#75bda4',accent:'#f3f3ef',pattern:'plain'});
  return visual;
}
export function applyRealAppearance(v,profile,uniform){
  if(!uniform)return;
  const height=profile.height??180,weight=profile.weight??77,width=THREE.MathUtils.clamp(Math.sqrt(weight/(height/100)**2/24),.83,1.24);
  v.group.scale.set(width/(v.fieldScale??1),height/180,width/(v.fieldScale??1));v.head.scale.set(Math.pow(width,-.65)*(v.index%3===0?1.02:.98),.98,Math.pow(width,-.65)*.96);
  const skin=new THREE.Color(profile.skin??'#e4b18f'),reference=new THREE.Color('#d4b298');v.skin.color.copy(skin).multiplyScalar(.72);v.faceMaterial.color.setRGB(Math.min(1.5,skin.r/reference.r),Math.min(1.5,skin.g/reference.g),Math.min(1.5,skin.b/reference.b));
  v.faceMaterial.userData.hairColour.value.set(profile.hair??'#292329');v.hairMaterial.color.set(profile.hair??'#292329');v.kit.color.set(0xffffff);const atlas=kitAtlas(profile,uniform);v.kit.map=atlas;v.kit.roughness=.84;if(v.handMaterial){v.handMaterial.map=null;v.handMaterial.normalMap=null;v.handMaterial.color.copy(profile.role==='GK'?new THREE.Color('#edf1ed'):skin.clone().multiplyScalar(.72));v.handMaterial.roughness=.76;}
  v.uniform=uniform;v.profile={...profile};
}
function switchAction(v,key){
  if(v.actionName===key)return;
  const previous=v.actions[v.actionName],next=v.actions[key],gaits=['walk','run','dribble'];
  const phase=previous&&gaits.includes(v.actionName)&&gaits.includes(key)?(previous.time%previous.getClip().duration)/previous.getClip().duration:0;
  next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();if(phase)next.time=phase*next.getClip().duration;
  if(previous)previous.crossFadeTo(next,.16,false);v.actionName=key;
}
export function updateRealPlayer(v,p,dt,active,charge=0){
  if(!v.realistic)return;dt=Math.max(0,dt);v.clock+=dt;const speed=p?Math.hypot(p.vx??0,p.vz??0):0;
  for(const [name,q] of v.restBones??[])v.bones[name].quaternion.copy(q);
  v.motionSpeed??=speed;v.motionSpeed+=(speed-v.motionSpeed)*(1-Math.exp(-dt*12));
  const kick=p?.kickAnim??0;if(kick>(v.lastKick??0)+.025){v.kickStarted=v.clock;v.kickKind=p.kickStyle==='shoot'||p.kickStyle==='clearance'?'shot':['cross','loft'].includes(p.kickStyle)?'cross':p.kickStyle==='header'?'header':'pass';}v.lastKick=kick;
  const striking=v.kickStarted!==undefined&&v.clock-v.kickStarted<.38;
  const windUp=p?.chargeType==='pass'||p?.chargeType==='through'?'pass':p?.chargeType==='cross'?'cross':'shot';
  let key=charge>0?windUp:striking?v.kickKind:p?.throwAnim>0?'throw':gaitFor(v.motionSpeed,v.actionName,p?.ownsBall);
  if(p?.slide)key='slide';else if(p?.tackleAnim>0)key='tackle';
  const signature=p?.celebration>0&&!(p.celebration<1.25&&p.celebrationKind!=='embrace');
  // Volleys and acrobatic kicks are posed by hand (game.js sets the leg/arm controls), so the clip underneath stays neutral.
  const acro=Boolean(p?.aerial&&p.aerial.style&&p.aerial.style!=='header');
  if(p?.keeperAction||p?.distribution||p?.wall||signature||acro)key='idle';switchAction(v,key);
  const action=v.actions[key];
  // Slide: play the clip through the slide, then run it back to the start while he gets up (no frozen last frame).
  const slideProgress=sl=>{if(sl.elapsed<sl.duration)return .9*sl.elapsed/sl.duration;const r=Math.min(1,(sl.elapsed-sl.duration)/Math.max(.05,sl.recover));return .9*(1-r*r*(3-2*r));};
  if(key==='slide'||key==='tackle'){const progress=key==='slide'?slideProgress(p.slide):1-p.tackleAnim/.42;action.timeScale=0;action.time=action.getClip().duration*Math.min(.98,progress);v.mixer.update(dt);}
  else if(charge>0){action.timeScale=0;action.time=action.getClip().duration*(key==='pass'?.06+.16*charge:.06+.36*charge);v.mixer.update(dt);}
  else if(striking){action.timeScale=0;action.time=action.getClip().duration*Math.min(.98,.43+(v.clock-v.kickStarted)/.38*.55);v.mixer.update(dt);}
  else{action.timeScale=['walk','run','dribble'].includes(key)?strideRate(v.motionSpeed,key,athleteScale*(v.group?.scale.y??1)):1;v.mixer.update(dt);}
  if(p?.keeperAction||p?.distribution||signature||acro){
    const pairs=[[v.legs[0],v.bones.right_thigh],[v.legs[1],v.bones.left_thigh],[v.knees[0],v.bones.right_knee],[v.knees[1],v.bones.left_knee],[v.arms[0],v.bones.right_shoulder],[v.arms[1],v.bones.left_shoulder]];
    for(const [control,bone] of pairs){axis.setFromEuler(euler.set(control.rotation.x,-control.rotation.z,0));bone.quaternion.copy(v.restBones.get(bone.name)).multiply(axis);}
  }
  if(p?.keeperAction||p?.distribution||signature||acro){for(let i=0;i<2;i++){const bone=v.bones[i?'left_elbow':'right_elbow'];bone.quaternion.copy(v.restBones.get(bone.name)).multiply(axis.setFromEuler(euler.set(v.elbows[i].rotation.x,0,0)));}}
  v.model.position.y=athleteFloor;
  if(p?.index===0&&!p.keeperAction&&!p.distribution&&!signature&&speed<1.5){
    v.model.position.y-=.02;
    for(const [i,side] of ['right','left'].entries()){
      for(const joint of ['thigh','knee','ankle','shoulder','elbow']){const bone=v.bones[side+'_'+joint];bone.quaternion.copy(v.restBones.get(bone.name));}
      v.bones[side+'_thigh'].rotation.x=-.1;v.bones[side+'_knee'].rotation.x=.22;v.bones[side+'_ankle'].rotation.x=-.12;
      v.bones[side+'_shoulder'].quaternion.multiply(axis.setFromEuler(euler.set(p.holdingBall?-1:-.35,i?.28:-.28,0)));
      v.bones[side+'_elbow'].rotation.x=p.holdingBall?-1.1:-.45;
    }
  }
  if(p?.wall){for(const side of ['left','right']){for(const part of ['shoulder','elbow']){const b=v.bones[side+'_'+part];b.quaternion.copy(v.restBones.get(b.name));}v.bones[side+'_shoulder'].rotation.x=-.25;v.bones[side+'_elbow'].rotation.x=-.8;}}
  if(p?.official){for(let i=0;i<2;i++){const control=v.arms[i],bone=v.bones[i?'left_shoulder':'right_shoulder'];axis.setFromEuler(euler.set(0,-control.rotation.z,0));bone.quaternion.multiply(axis);control.rotation.set(0,0,0);}}
  if(!p){for(const bone of Object.values(v.bones))bone.quaternion.copy(v.restBones.get(bone.name));v.bones.middle.rotation.x=.015+Math.sin(v.clock*1.8)*.008;v.bones.neck.rotation.x=-.025;
    for(const [i,side] of ['right','left'].entries()){v.bones[side+'_shoulder'].quaternion.multiply(axis.setFromEuler(euler.set(-.06,i?-.045:.045,0)));v.bones[side+'_elbow'].rotation.x=-.16;v.bones[side+'_knee'].rotation.x=.035;v.bones[side+'_ankle'].rotation.x=-.035;}
  }
  // Ground contact: on the ground-level moves, lift the body so no bone sinks below the turf.
  if(p?.slide||p?.tackleAnim>0||acro){v.model.updateMatrixWorld(true);v.group.updateWorldMatrix(true,false);let low=Infinity;for(const bone of Object.values(v.bones)){bone.getWorldPosition(floorProbe);low=Math.min(low,floorProbe.y);}
    const ground=VISUAL_SCALE.turfY,clear=.05;
    if(low<ground+clear){v.model.position.y+=(ground+clear-low)/(v.group.scale.y||1);}}
  v.model.updateMatrixWorld(true);
}
const floorProbe=new THREE.Vector3();
