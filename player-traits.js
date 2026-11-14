// Player types: each outfield player gets a style that changes how they move, win duels and strike the ball.
// Multipliers are around 1 (1 = average). pace: top speed · agility: acceleration and turning ·
// strength: shoulder duels and holding the ball · aerial: jump height and winning headers ·
// longShot: power and keeper difficulty from distance · passing: pass speed ·
// stars: skill-move level (2~5); one keyboard command gives a harder move to a higher-star player.
export const ARCHETYPES={
  balanced:{label:'밸런스형',desc:'모든 능력이 고른 선수',height:180,weight:76,pace:1,agility:1,strength:1,aerial:1,longShot:1,passing:1,stars:3},
  target:{label:'타깃형',desc:'키·점프가 좋아 헤딩과 몸싸움에 강함',height:192,weight:88,pace:.93,agility:.86,strength:1.4,aerial:1.45,longShot:1,passing:.97,stars:2},
  speedster:{label:'스피드형',desc:'몸은 작지만 빠르고 민첩함',height:169,weight:64,pace:1.12,agility:1.35,strength:.78,aerial:.72,longShot:.95,passing:1,stars:4},
  shooter:{label:'중거리형',desc:'평범한 체격 · 중거리 슛이 강하고 정확함',height:179,weight:75,pace:1,agility:1,strength:1,aerial:.98,longShot:1.45,passing:1.03,stars:3},
  stopper:{label:'파이터형',desc:'단단한 체격 · 몸싸움과 공중볼 경합에 강함',height:188,weight:85,pace:.96,agility:.9,strength:1.32,aerial:1.28,longShot:.95,passing:.97,stars:2},
  trickster:{label:'트릭스터',desc:'개인기 5성 · 화려한 발재간과 민첩함 · 몸싸움은 약함',height:173,weight:67,pace:1.05,agility:1.3,strength:.82,aerial:.8,longShot:1.05,passing:1.05,stars:5},
  playmaker:{label:'플레이메이커',desc:'빠르고 정확한 패스 · 무난한 중거리',height:176,weight:70,pace:1,agility:1.08,strength:.9,aerial:.9,longShot:1.12,passing:1.15,stars:4},
};
export const ARCHETYPE_IDS=Object.keys(ARCHETYPES);
// 4-4-2 slots: GK, LB, CB, CB, RB, LM, CM, CM, RM, ST, ST.
export const DEFAULT_ARCHETYPES=['balanced','speedster','stopper','target','balanced','trickster','playmaker','shooter','speedster','target','speedster'];
export const validArchetype=(value,index=1)=>ARCHETYPES[value]?value:DEFAULT_ARCHETYPES[index%11]??'balanced';
export const archetypeOf=p=>validArchetype(p?.profile?.archetype??p?.archetype,p?.index??1);
export const traits=p=>p?.index===0?ARCHETYPES.balanced:ARCHETYPES[archetypeOf(p)];
export const heightOf=p=>p?.profile?.height??ARCHETYPES[archetypeOf(p)].height;
export const weightOf=p=>p?.profile?.weight??ARCHETYPES[archetypeOf(p)].weight;

// 신특 (special traits): up to two per player, on top of the player type. Each one changes a specific
// situation in the match engine (see the `hasTrait` uses in match.js, keeper.js and team-shape.js).
export const SPECIAL_TRAITS={
  lineBreaker:{label:'라인 브레이커',group:'공격',desc:'수비 뒷공간 침투를 더 자주, 더 빠르게 하고 오프사이드 라인에 바짝 붙어 기다림'},
  trickster:{label:'트릭스터',group:'공격',desc:'개인기가 20% 빨리 끝나 다음 동작으로 바로 이어짐'},
  speedster:{label:'스피드스터',group:'공격',desc:'공을 몰 때 가속이 빠르고 드리블 속도가 줄지 않음'},
  crossPoacher:{label:'크로스 포처',group:'공격',desc:'크로스·컷백 때 박스 안으로 파고드는 속도가 빨라짐'},
  acrobatic:{label:'아크로바틱 피니셔',group:'공격',desc:'공중볼에 바이시클 킥·시저스 킥이 나가고 발리 슛이 강해짐'},
  laserShooter:{label:'레이저 슈터',group:'슛·패스',desc:'D · DD 슛이 낮고 빠르게 뻗음'},
  commander:{label:'커맨더',group:'슛·패스',desc:'로빙 스루(Q+W)에 백스핀이 걸려 빈 공간에 멈추듯 떨어짐'},
  twoHearts:{label:'2개의 심장',group:'슛·패스',desc:'질주할 때 체력이 40% 덜 닳음'},
  fighter:{label:'파이터',group:'수비',desc:'몸싸움과 공 뺏기에 강함'},
  predator:{label:'프레데터',group:'수비',desc:'수비 때 방향 전환이 빠르고 개인기에 덜 속음'},
  wildTackler:{label:'와일드 태클러',group:'수비',desc:'스탠딩 태클 범위가 넓고 옆·뒤 태클의 반칙이 줄어듦'},
  chaser:{label:'체이서',group:'수비',desc:'공을 뺏겼을 때 수비 진영으로 돌아오는 속도가 빠름'},
  blocker:{label:'블로커',group:'수비',desc:'슛 길목에 있으면 몸을 던져 막아냄'},
  titan:{label:'타이탄',group:'수비',desc:'공중볼 경합에서 더 높이 뛰고 더 잘 이김'},
  gkDeadeye:{label:'GK 데드아이',group:'골키퍼',desc:'중거리 슛에 더 빨리 반응함'},
  gkQuick:{label:'GK 빠른 반응',group:'골키퍼',desc:'1대1에서 더 멀리서, 더 빨리 뛰어나와 덮침'},
  gkAerial:{label:'GK 공중볼 장악',group:'골키퍼',desc:'크로스·코너킥을 더 넓은 범위에서 처리함'},
};
export const MAX_SPECIALS=2;
export const SPECIAL_IDS=Object.keys(SPECIAL_TRAITS);
export const isKeeperTrait=id=>id.startsWith('gk');
// 4-4-2 slots: GK, LB, CB, CB, RB, LM, CM, CM, RM, ST, ST.
export const DEFAULT_SPECIALS=[['gkDeadeye','gkQuick'],['chaser','speedster'],['fighter','predator'],['fighter','titan'],['chaser','wildTackler'],['trickster','speedster'],['commander','twoHearts'],['laserShooter','blocker'],['speedster','crossPoacher'],['acrobatic','titan'],['lineBreaker','speedster']];
// Keeps valid ids only, no duplicates, at most two, and keeper traits only on the keeper slot.
export function validSpecials(value,index=1){
  const keeper=index%11===0,list=Array.isArray(value)?value:DEFAULT_SPECIALS[index%11]??[];
  return [...new Set(list.filter(id=>SPECIAL_TRAITS[id]&&isKeeperTrait(id)===keeper))].slice(0,MAX_SPECIALS);
}
export const specialsOf=p=>p?.profile?.specials??p?.specials??DEFAULT_SPECIALS[(p?.index??1)%11]??[];
export const hasTrait=(p,id)=>specialsOf(p).includes(id);
export const strengthOf=p=>traits(p).strength*(hasTrait(p,'fighter')?1.22:1);
export const aerialOf=p=>traits(p).aerial*(hasTrait(p,'titan')?1.22:1);
