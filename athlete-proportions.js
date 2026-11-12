import * as THREE from './vendor/three.module.min.js';
// Lengthen the hip-to-ground section while keeping neck and total stature fixed.
export function bodyHeight(y,hip=.96,neck=1.61){const newHip=hip+.075;return y<hip?y*newHip/hip:y<neck?newHip+(y-hip)*(neck-newHip)/(neck-hip):y;}
export function reshapeAthlete(scene,animations){
 scene.updateMatrixWorld(true);const hip=scene.getObjectByName('body').getWorldPosition(new THREE.Vector3()).y,neck=scene.getObjectByName('neck').getWorldPosition(new THREE.Vector3()).y,remap=y=>bodyHeight(y,hip,neck);const joints=[],meshes=[],point=new THREE.Vector3();
 scene.traverse(o=>{if(o.isBone)joints.push({bone:o,old:o.position.clone(),world:o.getWorldPosition(new THREE.Vector3())});if(o.isSkinnedMesh)meshes.push(o);});
 for(const mesh of meshes){const g=mesh.geometry.clone(),a=g.attributes.position;for(let i=0;i<a.count;i++){point.fromBufferAttribute(a,i);mesh.localToWorld(point);point.y=remap(point.y);mesh.worldToLocal(point);a.setXYZ(i,point.x,point.y,point.z);}g.computeVertexNormals();g.computeBoundingSphere();mesh.geometry=g;}
 for(const j of joints){const target=j.world.clone();target.y=remap(target.y);j.bone.parent.updateWorldMatrix(true,false);j.bone.position.copy(j.bone.parent.worldToLocal(target));j.bone.updateWorldMatrix(false,false);}
 scene.updateMatrixWorld(true);for(const skeleton of new Set(meshes.map(m=>m.skeleton)))for(const inverse of skeleton.boneInverses){
  // glTF's inverse-bind matrices are in the asset's native Z-up bind space,
  // not the scene's Y-up default pose. Preserve their original rotations.
  const bind=inverse.clone().invert();point.setFromMatrixPosition(bind);point.z=remap(point.z);bind.setPosition(point);inverse.copy(bind.invert());
 }
 const deltas=new Map(joints.map(j=>[j.bone.name,j.bone.position.clone().sub(j.old)]));
 for(const clip of animations)for(const track of clip.tracks){const [name,property]=track.name.split('.'),delta=deltas.get(name);if(property!=='position'||!delta)continue;for(let i=0;i<track.values.length;i+=3){track.values[i]+=delta.x;track.values[i+1]+=delta.y;track.values[i+2]+=delta.z;}}
}
