import type { RankedItem, SourceState } from "./ranking";

export type StoryRecord = { id:string; title:string; summary:string|null; visible:number; updatedAt:string };
export type CuratedItem = RankedItem & { storyId:string|null };
export type CuratedEvent<T extends CuratedItem> = { story:StoryRecord; items:T[]; score:number; platformCount:number };

/** Only explicitly reviewed event links are used; no guesswork happens while rendering. */
export function rankCurated<T extends CuratedItem>(stories:StoryRecord[], items:T[], statuses:SourceState[], now:number):CuratedEvent<T>[] {
  const result:CuratedEvent<T>[]=[];
  for(const story of stories) {
    if(!story.visible) continue;
    const attached=items.filter(item=>{
      const state=statuses.find(status=>status.platform===item.platform);
      const sourceTime=state?.sourceUpdatedAt || state?.lastSuccessAt;
      const time=sourceTime ? Date.parse(sourceTime) : NaN;
      return item.storyId===story.id && item.observedAt===state?.lastSuccessAt &&
        Number.isFinite(time) && now-time>=-300000 && now-time<=86400000 && Number.isInteger(item.rank) && item.rank>0;
    }).sort((a,b)=>a.rank-b.rank);
    if(!attached.length) continue;
    const platformRanks=new Map<string,number>();
    for(const item of attached) platformRanks.set(item.platform,Math.min(platformRanks.get(item.platform)??Infinity,item.rank));
    result.push({story,items:attached,score:Math.round([...platformRanks.values()].reduce((sum,rank)=>sum+100/Math.log2(rank+2),0)),platformCount:platformRanks.size});
  }
  return result.sort((a,b)=>b.score-a.score || b.platformCount-a.platformCount || a.story.title.localeCompare(b.story.title));
}
