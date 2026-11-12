export function paintKit(ctx,kit,{keeper=false,size=512}={}){
  const s=size/256,base=keeper?kit.keeper:kit.shirt,accent=kit.accent??'#e4c986',pattern=keeper?'plain':kit.pattern;
  ctx.save();ctx.scale(s,s);ctx.fillStyle=base;ctx.fillRect(0,0,256,256);ctx.fillStyle=accent;
  if(pattern==='stripes')for(let x=0;x<256;x+=43)ctx.fillRect(x,0,13,256);
  if(pattern==='hoops')for(let y=20;y<256;y+=48)ctx.fillRect(0,y,256,10);
  if(pattern==='halves')ctx.fillRect(0,0,128,256);
  if(pattern==='sash'){ctx.beginPath();ctx.moveTo(0,40);ctx.lineTo(25,0);ctx.lineTo(256,191);ctx.lineTo(256,228);ctx.closePath();ctx.fill();}
  if(pattern==='chevron'){ctx.beginPath();ctx.moveTo(0,58);ctx.lineTo(128,112);ctx.lineTo(256,58);ctx.lineTo(256,81);ctx.lineTo(128,139);ctx.lineTo(0,81);ctx.closePath();ctx.fill();}
  if(pattern==='hechter')for(const x of [0,128,256]){ctx.fillStyle='#f1f3f4';ctx.fillRect(x-17,0,34,256);ctx.fillStyle='#d32b45';ctx.fillRect(x-12,0,24,256);ctx.strokeStyle='#ffffff24';ctx.lineWidth=.6;for(let y=0;y<256;y+=13){ctx.beginPath();ctx.moveTo(x-12,y);ctx.lineTo(x+12,y+18);ctx.stroke();}}
  if(pattern==='madrid'){ctx.strokeStyle='#d4bd7f';ctx.lineWidth=1;for(let x=0;x<256;x+=16){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,256);ctx.stroke();}ctx.fillStyle='#1f3153';for(let x=45;x<95;x+=15)ctx.fillRect(x,0,4,40);for(let x=173;x<223;x+=15)ctx.fillRect(x,0,4,40);}
  ctx.globalAlpha=.065;for(let x=0;x<256;x+=3){ctx.fillStyle=x%6?'#ffffff':'#000000';ctx.fillRect(x,0,1,256);}ctx.globalAlpha=1;
  const shading=ctx.createLinearGradient(0,0,256,0);shading.addColorStop(0,'#00000022');shading.addColorStop(.22,'#ffffff08');shading.addColorStop(.45,'#00000018');shading.addColorStop(.7,'#ffffff09');shading.addColorStop(1,'#00000022');ctx.fillStyle=shading;ctx.fillRect(0,0,256,256);
  ctx.fillStyle=accent;ctx.fillRect(0,4,256,5);ctx.fillRect(0,238,256,3);ctx.strokeStyle='#ffffff25';ctx.lineWidth=.7;for(const x of [36,92,164,220]){ctx.beginPath();ctx.moveTo(x,30);ctx.lineTo(x,232);ctx.stroke();}
  // A generic stitched badge, without reproducing club or sponsor logos.
  ctx.fillStyle=accent;ctx.beginPath();ctx.moveTo(154,59);ctx.lineTo(170,59);ctx.lineTo(170,73);ctx.lineTo(162,80);ctx.lineTo(154,73);ctx.closePath();ctx.fill();ctx.fillStyle=base;ctx.fillRect(159,64,6,8);ctx.restore();
}
