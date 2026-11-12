export function hashSeed(value){let h=2166136261;for(const c of String(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
export function variation(match,key){let x=hashSeed(`${match.variationSeed??0}:${key}`);x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;}
export const CELEBRATIONS=['slide','jumpTurn','airplane','fistPump','dance','salute'];
