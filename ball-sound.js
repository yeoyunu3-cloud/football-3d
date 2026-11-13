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
