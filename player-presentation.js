import {distributionPose} from './keeper-control.js?v=20261114-runmenu';
import * as THREE from './vendor/three.module.min.js';
import {keeperPose} from './keeper.js?v=20261114-runmenu';
import {celebrationPose} from './presentation.js?v=20261114-runmenu';
export function applyKeeperRig(visual,p){
 const g=visual.group,pose=keeperPose(p);g.rotation.set(0,p.heading,0);g.position.y=pose.rootY-.07;
 visual.knees.forEach((k,i)=>k.rotation.x=pose.kneeX?.[i]??0);
 g.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),pose.leanX));g.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),pose.leanZ));
 visual.legs.forEach((leg,i)=>{leg.rotation.x=pose.legX[i];leg.rotation.z=pose.legZ[i];});visual.arms.forEach((arm,i)=>{arm.rotation.x=pose.armX[i];arm.rotation.z=pose.armZ[i];visual.elbows[i].rotation.x=pose.elbowX?.[i]??-.28;});
 const pivot=new THREE.Vector3(0,.9*(p.profile?.height??180)/180,0);g.position.add(pivot.clone().sub(pivot.clone().applyQuaternion(g.quaternion)));
}
export function applyCelebrationRig(visual,p){
 const g=visual.group,pose=celebrationPose(p.celebrationKind,p.celebration,p.stride);g.position.y=pose.rootY-.07+(p.celebrationLift??0);if(visual.shadow)visual.shadow.material.opacity=.22/(1+Math.max(0,pose.rootY-.12));g.rotation.x=pose.lean;g.rotation.y+=pose.yaw;
 visual.elbows.forEach((e,i)=>e.rotation.x=Array.isArray(pose.elbowX)?pose.elbowX[i]:pose.elbowX??-.15);visual.knees.forEach(k=>k.rotation.x=pose.kneeX??0);visual.legs.forEach((leg,i)=>{leg.rotation.x=pose.legX[i];leg.rotation.z=pose.legZ[i];});visual.arms.forEach((arm,i)=>{arm.rotation.z=pose.armZ[i];if(pose.armX!==undefined)arm.rotation.x=pose.armX;});
}

export function applyDistributionRig(visual,p){const pose=distributionPose(p.distribution),g=visual.group;g.rotation.set(pose.lean,p.heading,0);visual.arms.forEach((a,i)=>{a.rotation.x=pose.armX[i];a.rotation.z=pose.armZ[i];visual.elbows[i].rotation.x=pose.elbows[i];});visual.legs.forEach((a,i)=>{a.rotation.x=pose.legX[i];a.rotation.z=0;visual.knees[i].rotation.x=pose.knees[i];});}
