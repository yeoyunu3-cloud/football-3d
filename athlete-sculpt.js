import * as THREE from './vendor/three.module.min.js';
const smooth=THREE.MathUtils.smoothstep;
// Sculpt the licensed mesh in its original Z-up bind coordinates. Skin weights,
// UVs and the animation skeleton stay intact; clothing lengths are independent.
export function sculptFootballGeometry(source,materialName){
 const g=materialName==='kit'?trimShirtHem(source):source.clone(),a=g.attributes.position,uv=g.attributes.uv;
 for(let i=0;i<a.count;i++){
  let x=a.getX(i),y=a.getY(i),z=a.getZ(i);const u=uv?.getX(i)??0,v=uv?.getY(i)??0,abs=Math.abs(x);
  if(materialName==='kit'){
   // One continuous deformation across UV seams, including duplicated cuffs.
   const lower=smooth(z,.57,.96)*(1-smooth(z,1.0,1.38));z+=.13*lower;
   const chest=Math.exp(-(((z-1.48)/.16)**2)),waist=Math.exp(-(((z-1.16)/.16)**2));
   const torso=1-smooth(abs,.17,.28);x*=1+torso*(chest*.24-waist*.015);
   y+=(y<-.02?-1:1)*torso*chest*.008;
   z+=.025*chest*smooth(abs,.12,.20)*(1-smooth(abs,.29,.36));
   const fit=1-.04*smooth(z,.64,.82)*(1-smooth(z,1.02,1.18)),hip=Math.exp(-(((z-1.06)/.13)**2));x*=fit*(1-.14*hip);y*=fit*(1-.24*hip);
  }
  // Give the calves their own volume, with a slim ankle rather than a cone.
  if(z<.60&&z>.12&&!materialName.startsWith('shoe')){
   const centre=Math.sign(x)*.225,calf=Math.exp(-(((z-.36)/.12)**2));
   x=centre+(x-centre)*(1+.12*calf);y*=1+.08*calf;
  }
  a.setXYZ(i,x,y,z);
 }
 const normals=g.attributes.normal;for(let i=0;i<normals.count;i++){const n=new THREE.Vector3().fromBufferAttribute(normals,i).normalize();normals.setXYZ(i,n.x,n.y,n.z);}g.computeBoundingSphere();return g;
}
export function buildHairGeometry(face,style=0){
 const out=[],normals=[],p=face.attributes.position,n=face.attributes.normal,mask=face.attributes.hairMask;
 for(let i=0;i<p.count;i+=3){
  if([0,1,2].some(j=>mask.getX(i+j)<.6))continue;
  for(let j=0;j<3;j++){const k=i+j,x=p.getX(k),y=p.getY(k),z=p.getZ(k),crown=smooth(z,.20,.28),volume=.0025+crown*(style===1?.011:.005),grain=Math.sin(x*210)*Math.sin(y*190)*.0007;
   out.push(x+n.getX(k)*(volume+grain),y+n.getY(k)*(volume+grain),z+n.getZ(k)*(volume+grain));normals.push(n.getX(k),n.getY(k),n.getZ(k));}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(out,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.computeBoundingSphere();return g;
}

// Clip the old hanging shirt tail to a clean waist opening. Interpolate every
// surface attribute and merge bone influences at cuts so animation stays bound.
export function trimShirtHem(source,height=.99){
 const names=Object.keys(source.attributes),out=Object.fromEntries(names.map(n=>[n,[]])),index=source.index,total=index?index.count:source.attributes.position.count;
 const vertex=i=>Object.fromEntries(names.map(n=>[n,Array.from(source.attributes[n].array.slice(i*source.attributes[n].itemSize,(i+1)*source.attributes[n].itemSize))]));
 const mix=(a,b,t)=>{const v=Object.fromEntries(names.map(n=>[n,a[n].map((x,k)=>x+(b[n][k]-x)*t)]));if(a.skinIndex&&a.skinWeight){const weights=new Map();for(const [p,w] of [[a,1-t],[b,t]])for(let k=0;k<4;k++)weights.set(p.skinIndex[k],(weights.get(p.skinIndex[k])??0)+p.skinWeight[k]*w);const ranked=[...weights].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=ranked.reduce((n,p)=>n+p[1],0)||1;while(ranked.length<4)ranked.push([0,0]);v.skinIndex=ranked.map(p=>p[0]);v.skinWeight=ranked.map(p=>p[1]/sum);}return v;};
 const emit=v=>{for(const n of names)out[n].push(...v[n]);};
 for(let i=0;i<total;i+=3){let poly=[0,1,2].map(j=>vertex(index?index.getX(i+j):i+j));
  if(poly.every(v=>v.uv[1]<=.3972)&&poly.some(v=>v.position[2]<height)){
   const clipped=[];for(let j=0;j<poly.length;j++){const a=poly[j],b=poly[(j+1)%poly.length],inside=a.position[2]>=height,next=b.position[2]>=height;if(inside)clipped.push(a);if(inside!==next)clipped.push(mix(a,b,(height-a.position[2])/(b.position[2]-a.position[2])));}poly=clipped;
  }
  for(let j=1;j+1<poly.length;j++)for(const v of [poly[0],poly[j],poly[j+1]])emit(v);
 }
 const g=new THREE.BufferGeometry();for(const name of names){const Type=name==='skinIndex'?Uint16Array:Float32Array;g.setAttribute(name,new THREE.BufferAttribute(new Type(out[name]),source.attributes[name].itemSize));}return g;
}
