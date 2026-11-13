// motive: 피파 모티브 keyboard layout, following the official keyboard table (기본수비).
// Attack: 방향키 이동, E 질주, S 패스, W 스루, A 로빙·크로스, D 슛, Q 노 터치 페인팅 (Q+E 큰 페인팅), Ctrl 퍼스트 터치.
// Defence: D 스탠딩 태클, A 슬라이딩 태클, S 선수 변경, Q 수비 도움 요청, Shift + 방향키 선수 바꾸기.
// Taps: A A 땅볼 크로스, A A A 낮은 크로스, D D 깔아차기. Fakes: D 후 S 슛 페이크, A 후 S 패스 페이크.
// Skills: Shift + 방향키 조합, Z + ← 드래그 백. Extra (not in the table): 1~4 각도 침투, F + D 파워슛.
export const CONTROL_PRESETS={current:{move:'WASD / 방향키',pass:'e',through:'r',cross:'x',shoot:' ',sprint:'shift',switch:'q',shotMods:[['c','power'],['z','finesse'],['q','chip']]},motive:{move:'방향키',pass:'s',through:'w',cross:'a',shoot:'d',sprint:'e',switch:'q',defendSwitch:'s',tackle:'d',slideTackle:'a',helpDefend:'q',feint:'q',skill:'shift',keeperDrop:'w',cancel:['e','c'],knockOn:'control',doubleTap:{cross:'ground',shoot:'low'},tripleTap:{cross:'low'},fakeWith:'s',runAngles:{1:45,2:80,3:135,4:170},shotMods:[['c','rabona'],['f','power'],['z','finesse'],['q','chip']]}};
export const DEFAULT_PRESET='motive';
export const DOUBLE_TAP_MS=170;
export const validPreset=value=>Object.hasOwn(CONTROL_PRESETS,value)?value:DEFAULT_PRESET;
export const keyLabel=key=>key===' '?'Space':key==='shift'?'Shift':key==='control'?'Ctrl':key.toUpperCase();
// WASD doubles as movement only in the current preset, so A/D throw-ins are blocked there alone.
export function actionFor(key,preset,{throwing=false,defending=false,attacking=false}={}){const name=validPreset(preset),p=CONTROL_PRESETS[name];if(throwing&&name==='current'&&['a','d'].includes(key))return null;if(defending){if(p.defendSwitch===key)return 'switch';if(p.tackle===key)return 'tackle';if(p.slideTackle===key)return 'slide';if(p.helpDefend===key)return 'help';}if(attacking){if(p.feint===key)return 'feint';if(p.runAngles?.[key]!==undefined)return 'run';}return ['pass','through','cross','shoot','switch'].find(action=>p[action]===key)??null;}
export const runAngleFor=(key,preset)=>CONTROL_PRESETS[validPreset(preset)].runAngles?.[key]??null;
export function movement(keys,preset,throwing=false){const current=validPreset(preset)==='current';return {x:Number(keys.has('arrowright')||(current&&keys.has('d')))-Number(keys.has('arrowleft')||(current&&keys.has('a'))),z:throwing?0:Number(keys.has('arrowdown')||(current&&keys.has('s')))-Number(keys.has('arrowup')||(current&&keys.has('w'))),sprint:keys.has(CONTROL_PRESETS[validPreset(preset)].sprint)};}
export const isCancelCombo=(keys,preset)=>{const combo=CONTROL_PRESETS[validPreset(preset)].cancel;return Boolean(combo)&&combo.every(key=>keys.has(key));};
// Q+S 침투 패스 · C+S 플레어 패스 · Z+S 드라이브 땅볼 패스 · Q+W 로빙 스루 · Z+W 침투 스루 · Q+A 얼리 크로스 · Z+A 바운싱 로빙 패스
export const kickStyleFor=(type,keys)=>type==='pass'?(keys.has('q')?'lead':keys.has('c')?'flair':keys.has('z')?'drive':'auto'):type==='through'?(keys.has('q')?'lob':keys.has('z')?'driven':'auto'):type==='cross'?(keys.has('q')?'early':keys.has('z')?'bounce':'auto'):'auto';

// Shift + arrows, read relative to the attacking direction: F toward goal, B back, L/R the attacker's left/right.
// Patterns are cardinal approximations of the table's stick motions (e.g. ←↖↑↗→↘↓ roulette → B L F R).
export const SKILL_PATTERNS=[
  ['B,L,F,R','roulette',-1],['B,R,F,L','roulette',1],
  ['B,F,F','rainbow',1],['F,F,F','flickUp',1],
  ['R,B,L','elastico',1],['L,B,R','elastico',-1],
  ['F,R','stepover',-1],['F,L','stepover',1],['R,F','reverseStepover',-1],['L,F','reverseStepover',1],
  ['B,L','turn',1],['B,R','turn',-1],['F,B','heelFlick',1],
  ['L','bodyFeint',1],['R','bodyFeint',-1],['B','dragBack',1],
];
export const SKILL_HOLDS={L:['sideStep',1],R:['sideStep',-1],B:['ballRoll',1]};
export const SKILL_LABELS={feint:'노 터치 페인팅',bigFeint:'큰 페인팅',bodyFeint:'속임 동작',sideStep:'사이드 스텝',ballRoll:'퀵 볼 롤',stepover:'헛다리',reverseStepover:'역헛다리',elastico:'엘라스티코',roulette:'룰렛',heelFlick:'힐 플릭',dragBack:'드래그 백',turn:'턴',flickUp:'볼 띄우기',rainbow:'레인보우',fakeCut:'슛·패스 페이크',scoopTurn:'스쿱 턴'};
export function relativeArrow(key,attackSign){const map=attackSign>0?{arrowright:'F',arrowleft:'B',arrowup:'L',arrowdown:'R'}:{arrowleft:'F',arrowright:'B',arrowdown:'L',arrowup:'R'};return map[key]??null;}

export const SHOT_LABELS={auto:'일반 슛',finesse:'감아차기',power:'파워슛',chip:'칩슛',low:'깔아차기',rabona:'플레어 슛'};
export const KICK_LABELS={pass:{auto:'패스',curl:'감아 패스',lead:'침투 패스',flair:'플레어 패스',drive:'드라이브 땅볼 패스'},through:{auto:'스루패스',lob:'로빙 스루',driven:'침투 스루'},cross:{auto:'크로스',curl:'감아 크로스',ground:'땅볼 크로스',early:'얼리 크로스',low:'낮은 크로스',bounce:'바운싱 로빙 패스'}};
export const shotModKeys=preset=>CONTROL_PRESETS[validPreset(preset)].shotMods.map(([key])=>key);
export const shotStyleFor=(keys,fallback='auto',preset=DEFAULT_PRESET)=>CONTROL_PRESETS[validPreset(preset)].shotMods.find(([key])=>keys.has(key))?.[1]??fallback;
