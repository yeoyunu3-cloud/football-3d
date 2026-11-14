// motive: 피파 모티브 keyboard layout, following the official keyboard table (기본수비).
// Attack: 방향키 이동, E 질주, S 패스, W 스루, A 로빙·크로스, D 슛, Q 침투 메뉴 (4갈래 표시 → 1~4 선택), Ctrl 퍼스트 터치.
// Defence: D 스탠딩 태클, A 슬라이딩 태클, S 선수 변경, Q 수비 도움 요청, Shift + 방향키 선수 바꾸기.
// Taps: A A 땅볼 크로스, A A A 낮은 크로스, D D 깔아차기. Fakes: D 후 S 슛 페이크, A 후 S 패스 페이크.
// Skills: keyboard skill guide (Shift + 방향키, Z + ↓ 드래그 백, C + Z 저글링, Q + Z 풋 페이크, ` 개구리 점프). Extra (not in the table): 1~4 각도 침투, F + D 파워슛.
export const CONTROL_PRESETS={current:{move:'WASD / 방향키',pass:'e',through:'r',cross:'x',shoot:' ',sprint:'shift',switch:'q',shotMods:[['c','power'],['z','finesse'],['q','chip']]},motive:{move:'방향키',pass:'s',through:'w',cross:'a',shoot:'d',sprint:'e',switch:'q',defendSwitch:'s',tackle:'d',slideTackle:'a',helpDefend:'q',feint:'q',skill:'shift',keeperDrop:'w',cancel:['e','c'],knockOn:'control',doubleTap:{cross:'ground',shoot:'low'},tripleTap:{cross:'low'},fakeWith:'s',runAngles:{1:45,2:80,3:135,4:170},shotMods:[['c','rabona'],['f','power'],['z','finesse'],['q','chip']]}};
export const DEFAULT_PRESET='motive';
export const DOUBLE_TAP_MS=170;
export const validPreset=value=>Object.hasOwn(CONTROL_PRESETS,value)?value:DEFAULT_PRESET;
export const keyLabel=key=>key===' '?'Space':key==='shift'?'Shift':key==='control'?'Ctrl':key.toUpperCase();
// WASD doubles as movement only in the current preset, so A/D throw-ins are blocked there alone.
export function actionFor(key,preset,{throwing=false,defending=false,attacking=false}={}){const name=validPreset(preset),p=CONTROL_PRESETS[name];if(throwing&&name==='current'&&['a','d'].includes(key))return null;if(defending){if(p.keeperDrop===key)return 'rush';if(p.defendSwitch===key)return 'switch';if(p.tackle===key)return 'tackle';if(p.slideTackle===key)return 'slide';if(p.helpDefend===key)return 'help';}if(attacking){if(p.feint===key)return 'feint';if(p.runAngles?.[key]!==undefined)return 'run';}return ['pass','through','cross','shoot','switch'].find(action=>p[action]===key)??null;}
export const runAngleFor=(key,preset)=>CONTROL_PRESETS[validPreset(preset)].runAngles?.[key]??null;
export function movement(keys,preset,throwing=false){const current=validPreset(preset)==='current';return {x:Number(keys.has('arrowright')||(current&&keys.has('d')))-Number(keys.has('arrowleft')||(current&&keys.has('a'))),z:throwing?0:Number(keys.has('arrowdown')||(current&&keys.has('s')))-Number(keys.has('arrowup')||(current&&keys.has('w'))),sprint:keys.has(CONTROL_PRESETS[validPreset(preset)].sprint)};}
export const isCancelCombo=(keys,preset)=>{const combo=CONTROL_PRESETS[validPreset(preset)].cancel;return Boolean(combo)&&combo.every(key=>keys.has(key));};
// Q+S 침투 패스 · C+S 플레어 패스 · Z+S 드라이브 땅볼 패스 · Q+W 로빙 스루 · Z+W 침투 스루 · Q+A 얼리 크로스 · Z+A 바운싱 로빙 패스
export const kickStyleFor=(type,keys)=>type==='pass'?(keys.has('q')?'lead':keys.has('c')?'flair':keys.has('z')?'drive':'auto'):type==='through'?(keys.has('q')?'lob':keys.has('z')?'driven':'auto'):type==='cross'?(keys.has('q')?'early':keys.has('z')?'bounce':'auto'):'auto';

// Skill commands follow the keyboard skill guide literally. Its arrows assume the player faces the goal,
// so the keys are read as written: ↑ forward, ↓ back, ← the player's left, → the player's right.
export const skillArrow=key=>({arrowup:'F',arrowdown:'B',arrowleft:'L',arrowright:'R'})[key]??null;
// sequence -> [[stars needed, move, side], ...]: the highest move the player's skill stars allow is used.
// Several guide commands share one input (e.g. Shift + ↑←); better dribblers get the harder move.
export const SKILL_COMMANDS={
  shift:{
    'L':[[2,'bodyFeint',1]],'R':[[2,'bodyFeint',-1]],
    'F,L':[[2,'stepover',1],[3,'roulette',1],[4,'berbatovSpin',1],[5,'turnSpin',1]],'F,R':[[2,'stepover',-1],[3,'roulette',-1],[4,'berbatovSpin',-1],[5,'turnSpin',-1]],
    'L,F':[[2,'reverseStepover',1]],'R,F':[[2,'reverseStepover',-1]],
    'F,B':[[3,'heelFlick',1]],'F,F,F':[[3,'flickUp',1]],
    'L,B,R':[[3,'flipflap',1],[5,'reverseElastico',1]],'R,B,L':[[3,'flipflap',-1],[5,'elastico',1]],
    'B,F,F':[[4,'rainbow',1]],
    'B,L':[[5,'elasticoChop',1]],'B,R':[[5,'elasticoChop',-1]],
    'B,L,B,R':[[5,'hocusPocus',1]],'B,R,B,L':[[5,'tripleElastico',1]],
    'F,F,B':[[5,'sombreroFlick',1]],
  },
  shiftZ:{'F,B':[[4,'heelFlickTurn',1]],'F,L':[[5,'bolasie',1]],'F,R':[[5,'bolasie',-1]]},
  shiftQ:{'F,L':[[5,'elTornado',1]],'F,R':[[5,'elTornado',-1]]},
  z:{'B':[[2,'dragBack',1]],'B,L,B,R':[[5,'dragBackFake',1]]},
};
// Shift + one arrow held still.
export const SKILL_HOLDS={L:[[2,'sideStep',1]],R:[[2,'sideStep',-1]],F:[[5,'okochaSombrero',1]],B:[[5,'ballRoll',1]]};
export const pickSkill=(options,stars)=>options?.filter(([need])=>need<=stars).at(-1)??null;
export const SKILL_LABELS={feint:'노 터치 페인팅',bigFeint:'큰 페인팅',bodyFeint:'속임 동작',sideStep:'사이드 스텝',ballRoll:'퀵 볼 롤',stepover:'스텝오버',reverseStepover:'리버스 스텝오버',elastico:'엘라스티코',reverseElastico:'리버스 엘라스티코',roulette:'마르세유 룰렛',berbatovSpin:'베르바토프 스핀',turnSpin:'턴 스핀',heelFlick:'힐 플릭',dragBack:'드래그 백',dragBackFake:'드래그 백 페이크',flickUp:'볼 띄우기',rainbow:'레인보우',flipflap:'플립플랩',elasticoChop:'엘라스티코 촙',hocusPocus:'호커스 포커스',tripleElastico:'트리플 엘라스티코',sombreroFlick:'솜브레로 플릭',okochaSombrero:'오코차 솜브레로',heelFlickTurn:'힐 플릭 턴',bolasie:'볼라시 플릭',elTornado:'엘 토네이도',juggle:'볼 저글링',footFake:'풋 페이크',frogJump:'개구리 점프',fakeCut:'헛스윙',fakePass:'페이크 패스',scoopTurn:'스쿱 턴',heelToHeel:'힐투힐',fancyDragBack:'펜시 드래그 백',rabonaFake:'라보나 페이크'};

export const SHOT_LABELS={auto:'일반 슛',finesse:'감아차기',power:'파워슛',chip:'칩슛',low:'깔아차기',rabona:'플레어 슛'};
export const KICK_LABELS={pass:{auto:'패스',curl:'감아 패스',lead:'침투 패스',flair:'플레어 패스',drive:'드라이브 땅볼 패스'},through:{auto:'스루패스',lob:'로빙 스루',driven:'침투 스루'},cross:{auto:'크로스',curl:'감아 크로스',ground:'땅볼 크로스',early:'얼리 크로스',low:'낮은 크로스',bounce:'바운싱 로빙 패스'}};
export const shotModKeys=preset=>CONTROL_PRESETS[validPreset(preset)].shotMods.map(([key])=>key);
export const shotStyleFor=(keys,fallback='auto',preset=DEFAULT_PRESET)=>CONTROL_PRESETS[validPreset(preset)].shotMods.find(([key])=>keys.has(key))?.[1]??fallback;
