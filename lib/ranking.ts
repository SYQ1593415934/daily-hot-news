export type RankedItem = { id:string; platform:string; title:string; url:string; rank:number; observedAt:string; storyId?:string|null };
export type SourceState = { platform:string; lastSuccessAt:string|null; sourceUpdatedAt:string|null; error:string|null };
export type HotEvent<T extends RankedItem> = { title:string; items:T[]; score:number; platformCount:number };

const excluded = /(人工智能|大模型|生成式AI|生成式人工智能|ChatGPT|DeepSeek|Claude|Gemini|OpenAI|Anthropic|大语言模型)/i;
const conflictWords = ["辟谣","回应","否认","造谣","撤销","取消","确认","去世","逝世","复出","受伤","夺冠","亚军","决赛","合照","单曲","营销","祝贺","演唱会","赞歌","骄傲","时刻"];
export function normalizeTitle(title:string) {
  return title.toLocaleLowerCase().normalize("NFKC")
    .replace(/^(如何看待|怎么看待|如何评价|如何看|怎么看)/, "")
    .replace(/[？?，,。！!：:；;#＃\s【】\[\]《》“”"'·（）()]/g,"")
    .replace(/(对此你有什么想说的|对此你怎么看|你怎么看|如何评价|如何看待|怎么评价|为什么|意味着什么)$/,"");
}
function grams(text:string):Set<string> {
  const chars=Array.from(text), result=new Set<string>();
  for(let i=0;i<chars.length-1;i++) result.add(chars[i]+chars[i+1]);
  return result;
}
export function sameEventTitle(a:string,b:string):boolean {
  const x=normalizeTitle(a), y=normalizeTitle(b);
  if(!x || !y) return false;
  if(x===y) return true;
  if(Math.min(x.length,y.length)<5) return false;
  const yearsX: string[] = x.match(/20\d{2}/g) || [];
  const yearsY: string[] = y.match(/20\d{2}/g) || [];
  if (yearsX.length && yearsY.length && !yearsX.some(year => yearsY.includes(year))) return false;
  // Match headlines and result reports can describe the same final differently.
  const matchTeams = (title: string) => {
    const match = title.match(/([a-z][a-z0-9]{2,})vs([a-z][a-z0-9]{2,})/);
    return match && /总决赛|决赛/.test(title) ? [match[1], match[2]] : null;
  };
  const sameFinal = (matchTitle: string, resultTitle: string) => {
    const teams = matchTeams(matchTitle);
    if (!teams || !/(夺冠|夺得冠军|亚军|不敌|输给|负于)/.test(resultTitle)) return false;
    if (/(辟谣|否认|取消|受伤|单曲|赞歌|合照|营销|祝贺|演唱会)/.test(resultTitle)) return false;
    const yearsA: string[] = matchTitle.match(/20\d{2}/g) || [];
    const yearsB: string[] = resultTitle.match(/20\d{2}/g) || [];
    if (yearsA.length && yearsB.length && !yearsA.some(year => yearsB.includes(year))) return false;
    return teams.some(team => resultTitle.includes(team));
  };
  if (sameFinal(x, y) || sameFinal(y, x)) return true;
  // A match result can be described from either team's perspective.
  const winnerFromResult = (title: string) => title.match(/(?:不敌|输给|负于)([a-z][a-z0-9]{2,})[^。！？?]*(?:亚军|决赛)/)?.[1];
  const winnerA = winnerFromResult(x), winnerB = winnerFromResult(y);
  const isWinnerReport = (title: string, winner: string | undefined) => {
    if (!winner || !title.includes(winner) || !/(夺冠|夺得冠军|夺得总冠军)/.test(title)) return false;
    return !/(辟谣|否认|取消|受伤|单曲|赞歌|合照|营销|祝贺|演唱会)/.test(title);
  };
  if (isWinnerReport(y, winnerA) || isWinnerReport(x, winnerB)) return true;
  if(conflictWords.some(word=>x.includes(word)!==y.includes(word) && ["辟谣","否认","造谣","撤销","取消","去世","逝世","受伤","亚军","合照","单曲","营销","祝贺","演唱会","赞歌","骄傲","时刻"].includes(word))) return false;
  const shorter=x.length<=y.length?x:y, longer=x.length<=y.length?y:x;
  if(longer.includes(shorter) && longer.length-shorter.length<=18) return true;
  const names=x.match(/[a-z]{3,}/g) || [];
  const sharedEntity=names.some(name => y.includes(name));
  const winning=(text:string)=>/(夺冠|夺得冠军|夺得总冠军)/.test(text);
  if(sharedEntity && winning(x) && winning(y)) return true;
  const left=grams(x),right=grams(y);
  let shared=0; for(const value of left) if(right.has(value)) shared++;
  return shared>=5 && 2*shared/(left.size+right.size)>=0.72;
}
/** Ranks are relative per platform. Never adds incomparable platform heat metrics. */
export function rankEvents<T extends RankedItem>(items:T[], statuses:SourceState[], now:number):HotEvent<T>[] {
  const valid=items.filter(item=>{
    const status=statuses.find(s=>s.platform===item.platform);
    const updated=status?.sourceUpdatedAt || status?.lastSuccessAt;
    const time=updated ? Date.parse(updated) : NaN;
    return status?.lastSuccessAt===item.observedAt && Number.isFinite(time) && now-time>=-300000 && now-time<=24*3600000
      && Number.isInteger(item.rank) && item.rank>0 && !excluded.test(item.title);
  }).sort((a,b)=>a.rank-b.rank || a.platform.localeCompare(b.platform) || a.title.localeCompare(b.title));
  const groups:T[][]=[];
  for(const item of valid) {
    const group=groups.find(group => group.every(other =>
      (item.storyId && other.storyId ? item.storyId===other.storyId : sameEventTitle(other.title,item.title))));
    if(group) group.push(item); else groups.push([item]);
  }
  return groups.map(group=>{
    const best=new Map<string,number>();
    for(const item of group) best.set(item.platform,Math.min(best.get(item.platform)??Infinity,item.rank));
    const score=Math.round([...best.values()].reduce((sum,rank)=>sum+100/Math.log2(rank+2),0));
    return { title:group[0].title, items:group, score, platformCount:best.size };
  }).sort((a,b)=>b.score-a.score || b.platformCount-a.platformCount || a.title.localeCompare(b.title));
}
