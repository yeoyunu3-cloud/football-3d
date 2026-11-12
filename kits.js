export const KIT_PRESETS=[
{id:'psg-home',name:'PSG 홈 스타일',shirt:'#142342',shorts:'#142342',socks:'#142342',keeper:'#75bda4',accent:'#f3f3ef',pattern:'hechter'},
{id:'madrid-home',name:'레알 마드리드 홈 스타일',shirt:'#f4f2ea',shorts:'#f4f2ea',socks:'#f4f2ea',keeper:'#637b65',accent:'#c3a461',pattern:'madrid'}
];
export const kitById=id=>KIT_PRESETS.find(kit=>kit.id===id);
export function kitData(kit){const {name,...data}=kit;return {...data};}

export function resolveKitClash(home,away){if(home?.id!==away?.id)return away;return away.id==='psg-home'?{...away,id:'psg-away',shirt:'#f2f1e9',shorts:'#f2f1e9',socks:'#f2f1e9'}:{...away,id:'madrid-away',shirt:'#16233b',shorts:'#16233b',socks:'#16233b'};}
