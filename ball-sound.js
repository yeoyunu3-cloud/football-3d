// Synthesised ball sounds (no audio files): a soft leather tap for dribble touches,
// a fuller thump for traps and a punchy strike for passes and shots.
let ctx=null,master=null,noise=null;

// Browsers only allow audio after a user gesture, so the context is created on first input.
export function unlockBallSound(){
  if(!ctx){
    const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;
    ctx=new Ctx();master=ctx.createGain();master.gain.value=.9;
    const comp=ctx.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=4;master.connect(comp).connect(ctx.destination);
    noise=ctx.createBuffer(1,ctx.sampleRate*.25,ctx.sampleRate);const data=noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
  }
  if(ctx.state==='suspended')ctx.resume();
}

function voice({gain,body,bodyEnd,bodyDecay,click,clickQ,clickDecay,clickGain}){
  if(!ctx||ctx.state!=='running')return;
  const t=ctx.currentTime,jitter=1+(Math.random()-.5)*.12;
  // Low "thud" of the boot meeting the ball.
  const osc=ctx.createOscillator(),og=ctx.createGain();
  osc.type='sine';osc.frequency.setValueAtTime(body*jitter,t);osc.frequency.exponentialRampToValueAtTime(bodyEnd*jitter,t+bodyDecay);
  og.gain.setValueAtTime(0,t);og.gain.linearRampToValueAtTime(gain,t+.004);og.gain.exponentialRampToValueAtTime(.0001,t+bodyDecay);
  osc.connect(og).connect(master);osc.start(t);osc.stop(t+bodyDecay+.02);
  // Short filtered noise for the leather slap.
  const src=ctx.createBufferSource(),bp=ctx.createBiquadFilter(),ng=ctx.createGain();
  src.buffer=noise;bp.type='bandpass';bp.frequency.value=click*jitter;bp.Q.value=clickQ;
  ng.gain.setValueAtTime(gain*clickGain,t);ng.gain.exponentialRampToValueAtTime(.0001,t+clickDecay);
  src.connect(bp).connect(ng).connect(master);src.start(t);src.stop(t+clickDecay+.02);
}

export const playTouch=(strength=.5)=>voice({gain:.16+.22*strength,body:190,bodyEnd:120,bodyDecay:.07,click:1500,clickQ:1.4,clickDecay:.035,clickGain:.9});
export const playTrap=(strength=.6)=>voice({gain:.25+.3*strength,body:150,bodyEnd:85,bodyDecay:.11,click:1100,clickQ:1.1,clickDecay:.05,clickGain:.8});
export const playKick=(power=.5)=>voice({gain:.35+.55*power,body:120+40*power,bodyEnd:55,bodyDecay:.13+.06*power,click:900+700*power,clickQ:.8,clickDecay:.07,clickGain:1.1});

// Goal crowd roar, synthesised (no audio file): tens of thousands of voices are broadband noise, so the roar is
// shaped noise in layers. A low stadium rumble, a wide vocal band whose centre rises as the crowd erupts, a hiss of
// applause that flutters, and a few dozen single "woo" shouts and whistles that glide up and are panned around.
// It bursts in within about 0.3 s, holds for a few seconds and fades out over roughly 7 s.
let crowdNoise=null;
function pinkNoise(seconds){
  // Paul Kellet's pink-noise filter: closer to a crowd than white noise (less fizz, more body).
  const buffer=ctx.createBuffer(2,ctx.sampleRate*seconds,ctx.sampleRate);
  for(let ch=0;ch<2;ch++){const d=buffer.getChannelData(ch);let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
    for(let i=0;i<d.length;i++){const w=Math.random()*2-1;b0=.99886*b0+w*.0555179;b1=.99332*b1+w*.0750759;b2=.969*b2+w*.153852;b3=.8665*b3+w*.3104856;b4=.55*b4+w*.5329522;b5=-.7616*b5-w*.016834;d[i]=(b0+b1+b2+b3+b4+b5+b6+w*.5362)*.11;b6=w*.115926;}}
  return buffer;
}
function noiseLayer(t,{type,freq,q=.7,gain,attack,hold,release,freqTo,pan=0,start=0}){
  const src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),g=ctx.createGain(),panner=ctx.createStereoPanner?ctx.createStereoPanner():null;
  src.buffer=crowdNoise;src.loop=true;filter.type=type;filter.Q.value=q;
  const t0=t+start;filter.frequency.setValueAtTime(freq,t0);if(freqTo)filter.frequency.exponentialRampToValueAtTime(freqTo,t0+attack+hold*.4);
  g.gain.setValueAtTime(.0001,t0);g.gain.exponentialRampToValueAtTime(gain,t0+attack);g.gain.setValueAtTime(gain,t0+attack+hold*.5);
  g.gain.exponentialRampToValueAtTime(gain*.7,t0+attack+hold);g.gain.exponentialRampToValueAtTime(.0001,t0+attack+hold+release);
  let node=src.connect(filter).connect(g);if(panner){panner.pan.value=pan;node=node.connect(panner);}node.connect(master);
  src.start(t0,Math.random()*2);src.stop(t0+attack+hold+release+.1);return g;
}
export function playCrowdRoar(intensity=1){
  if(!ctx||ctx.state!=='running')return;
  crowdNoise??=pinkNoise(4);
  const t=ctx.currentTime+.02,k=Math.max(.3,Math.min(1.2,intensity));
  // Body of the roar.
  noiseLayer(t,{type:'lowpass',freq:240,q:.5,gain:.55*k,attack:.35,hold:3.6,release:6.5});
  noiseLayer(t,{type:'bandpass',freq:620,freqTo:1050,q:.55,gain:.95*k,attack:.28,hold:3.2,release:6});
  noiseLayer(t,{type:'bandpass',freq:1500,freqTo:2100,q:.8,gain:.42*k,attack:.25,hold:2.6,release:5,pan:-.35});
  noiseLayer(t,{type:'bandpass',freq:1350,freqTo:1900,q:.8,gain:.42*k,attack:.3,hold:2.8,release:5,pan:.35});
  // Applause hiss with a fast flutter.
  const clap=noiseLayer(t,{type:'highpass',freq:2800,q:.4,gain:.26*k,attack:.6,hold:3.5,release:4.5,start:.25});
  const lfo=ctx.createOscillator(),depth=ctx.createGain();lfo.type='triangle';lfo.frequency.value=13;depth.gain.value=.09*k;lfo.connect(depth).connect(clap.gain);lfo.start(t);lfo.stop(t+9);
  // Individual shouts and whistles across the stands.
  for(let i=0;i<34;i++){
    const start=Math.random()*2.6,dur=.35+Math.random()*1,whistle=i%7===0;
    const src=ctx.createBufferSource(),bp=ctx.createBiquadFilter(),g=ctx.createGain(),panner=ctx.createStereoPanner?ctx.createStereoPanner():null,t0=t+start,f=whistle?2400+Math.random()*900:550+Math.random()*900;
    src.buffer=crowdNoise;src.loop=true;bp.type='bandpass';bp.Q.value=whistle?28:7+Math.random()*6;
    bp.frequency.setValueAtTime(f,t0);bp.frequency.exponentialRampToValueAtTime(f*(1.25+Math.random()*.35),t0+dur*.55);bp.frequency.exponentialRampToValueAtTime(f*1.05,t0+dur);
    const peak=(whistle?.5:.32)*k*(.5+Math.random()*.5);g.gain.setValueAtTime(.0001,t0);g.gain.exponentialRampToValueAtTime(peak,t0+.06);g.gain.exponentialRampToValueAtTime(.0001,t0+dur);
    let node=src.connect(bp).connect(g);if(panner){panner.pan.value=Math.random()*1.6-.8;node=node.connect(panner);}node.connect(master);
    src.start(t0,Math.random()*3);src.stop(t0+dur+.05);
  }
}
