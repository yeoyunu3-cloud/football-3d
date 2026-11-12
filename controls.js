// motive: 피파 모티브 keyboard layout (방향키 이동, S 패스, W 스루, A 로빙·크로스, D 슛, E 질주, Q 선수 변경).
// Defending: S 선수 변경, Space 태클, A 슬라이딩 태클. Double taps: A A 땅볼 크로스, D D 깔아차기, E E (또는 Ctrl) 치고 달리기.
// Attacking: Q 침투 요청, 1~4 침투 방향. Shot modifiers: Z 감아차기, C 라보나, F 파워슛, Q 칩슛.
export const CONTROL_PRESETS={current:{move:'WASD / 방향키',pass:'e',through:'r',cross:'x',shoot:' ',sprint:'shift',switch:'q',shotMods:[['c','power'],['z','finesse'],['q','chip']]},motive:{move:'방향키',pass:'s',through:'w',cross:'a',shoot:'d',sprint:'e',switch:'q',defendSwitch:'s',tackle:' ',slideTackle:'a',keeperDrop:'w',cancel:['e','c'],knockOn:'control',doubleTap:{cross:'ground',shoot:'low'},runCall:'q',runLanes:['1','2','3','4'],shotMods:[['c','rabona'],['f','power'],['z','finesse'],['q','chip']]}};
export const DEFAULT_PRESET='motive';
export const DOUBLE_TAP_MS=170;
export const RUN_LANE_LABELS=['왼쪽 측면','왼쪽 안쪽','오른쪽 안쪽','오른쪽 측면'];
export const validPreset=value=>Object.hasOwn(CONTROL_PRESETS,value)?value:DEFAULT_PRESET;
export const keyLabel=key=>key===' '?'Space':key==='shift'?'Shift':key==='control'?'Ctrl':key.toUpperCase();
// WASD doubles as movement only in the current preset, so A/D throw-ins are blocked there alone.
export function actionFor(key,preset,{throwing=false,defending=false,attacking=false}={}){const name=validPreset(preset),p=CONTROL_PRESETS[name];if(throwing&&name==='current'&&['a','d'].includes(key))return null;if(defending){if(p.defendSwitch===key)return 'switch';if(p.tackle===key)return 'tackle';if(p.slideTackle===key)return 'slide';}if(attacking&&(p.runCall===key||p.runLanes?.includes(key)))return 'run';return ['pass','through','cross','shoot','switch'].find(action=>p[action]===key)??null;}
export const runLaneFor=(key,preset)=>{const i=CONTROL_PRESETS[validPreset(preset)].runLanes?.indexOf(key)??-1;return i>=0?i+1:null;};
export function movement(keys,preset,throwing=false){const current=validPreset(preset)==='current';return {x:Number(keys.has('arrowright')||(current&&keys.has('d')))-Number(keys.has('arrowleft')||(current&&keys.has('a'))),z:throwing?0:Number(keys.has('arrowdown')||(current&&keys.has('s')))-Number(keys.has('arrowup')||(current&&keys.has('w'))),sprint:keys.has(CONTROL_PRESETS[validPreset(preset)].sprint)};}
export const isCancelCombo=(keys,preset)=>{const combo=CONTROL_PRESETS[validPreset(preset)].cancel;return Boolean(combo)&&combo.every(key=>keys.has(key));};
export const kickStyleFor=(type,keys)=>['pass','cross'].includes(type)&&keys.has('z')?'curl':'auto';

export const SHOT_LABELS={auto:'일반 슛',finesse:'감아차기',power:'파워슛',chip:'칩슛',low:'깔아차기',rabona:'라보나 슛'};
export const KICK_LABELS={pass:{auto:'패스',curl:'감아 패스'},through:{auto:'스루패스'},cross:{auto:'크로스',curl:'감아 크로스',ground:'땅볼 크로스'}};
export const shotModKeys=preset=>CONTROL_PRESETS[validPreset(preset)].shotMods.map(([key])=>key);
export const shotStyleFor=(keys,fallback='auto',preset=DEFAULT_PRESET)=>CONTROL_PRESETS[validPreset(preset)].shotMods.find(([key])=>keys.has(key))?.[1]??fallback;
