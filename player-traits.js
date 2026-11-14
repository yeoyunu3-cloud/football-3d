// Player types: each outfield player gets a style that changes how they move, win duels and strike the ball.
// Multipliers are around 1 (1 = average). pace: top speed · agility: acceleration and turning ·
// strength: shoulder duels and holding the ball · aerial: jump height and winning headers ·
// longShot: power and keeper difficulty from distance · passing: pass speed.
export const ARCHETYPES={
  balanced:{label:'밸런스형',desc:'모든 능력이 고른 선수',height:180,weight:76,pace:1,agility:1,strength:1,aerial:1,longShot:1,passing:1},
  target:{label:'타깃형',desc:'키·점프가 좋아 헤딩과 몸싸움에 강함',height:192,weight:88,pace:.93,agility:.86,strength:1.4,aerial:1.45,longShot:1,passing:.97},
  speedster:{label:'스피드형',desc:'몸은 작지만 빠르고 민첩함',height:169,weight:64,pace:1.12,agility:1.35,strength:.78,aerial:.72,longShot:.95,passing:1},
  shooter:{label:'중거리형',desc:'평범한 체격 · 중거리 슛이 강하고 정확함',height:179,weight:75,pace:1,agility:1,strength:1,aerial:.98,longShot:1.45,passing:1.03},
  stopper:{label:'파이터형',desc:'단단한 체격 · 몸싸움과 공중볼 경합에 강함',height:188,weight:85,pace:.96,agility:.9,strength:1.32,aerial:1.28,longShot:.95,passing:.97},
  playmaker:{label:'플레이메이커',desc:'빠르고 정확한 패스 · 무난한 중거리',height:176,weight:70,pace:1,agility:1.08,strength:.9,aerial:.9,longShot:1.12,passing:1.15},
};
export const ARCHETYPE_IDS=Object.keys(ARCHETYPES);
// 4-4-2 slots: GK, LB, CB, CB, RB, LM, CM, CM, RM, ST, ST.
export const DEFAULT_ARCHETYPES=['balanced','speedster','stopper','target','balanced','speedster','playmaker','shooter','speedster','target','speedster'];
export const validArchetype=(value,index=1)=>ARCHETYPES[value]?value:DEFAULT_ARCHETYPES[index%11]??'balanced';
export const archetypeOf=p=>validArchetype(p?.profile?.archetype??p?.archetype,p?.index??1);
export const traits=p=>p?.index===0?ARCHETYPES.balanced:ARCHETYPES[archetypeOf(p)];
export const heightOf=p=>p?.profile?.height??ARCHETYPES[archetypeOf(p)].height;
export const weightOf=p=>p?.profile?.weight??ARCHETYPES[archetypeOf(p)].weight;
