import { rankEvents, type RankedItem, type SourceState } from "./ranking.ts";

export function yesterdayWindow(now: Date) {
  const shanghaiDay = new Date(now.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
  const end = new Date(`${shanghaiDay}T00:00:00+08:00`);
  const start = new Date(end.getTime() - 24 * 3600_000);
  return { date: new Date(start.getTime() + 8 * 3600_000).toISOString().slice(0, 10), start: start.toISOString(), end: end.toISOString() };
}

type Snapshot = { observationId: string; platform: string; title: string; url: string; rank: number; observedAt: string; sourceUpdatedAt: string | null };

/** Use each topic's best observed rank on each platform during the previous local day. */
export function rankYesterday(rows: Snapshot[], start: string, end: string) {
  const best = new Map<string, Snapshot>();
  for (const row of rows) {
    if (row.observedAt < start || row.observedAt >= end || (row.sourceUpdatedAt && (row.sourceUpdatedAt < start || row.sourceUpdatedAt >= end))) continue;
    const key = `${row.platform}:${row.observationId}`;
    const previous = best.get(key);
    if (!previous || row.rank < previous.rank || (row.rank === previous.rank && row.observedAt > previous.observedAt)) best.set(key, row);
  }
  const timestamp = new Date(Date.parse(end) - 1).toISOString();
  const items: RankedItem[] = [...best.values()].map(row => ({id:row.observationId,platform:row.platform,title:row.title,url:row.url,rank:row.rank,observedAt:timestamp}));
  const statuses: SourceState[] = [...new Set(items.map(item=>item.platform))].map(platform=>({platform,lastSuccessAt:timestamp,sourceUpdatedAt:timestamp,error:null}));
  return rankEvents(items,statuses,Date.parse(timestamp));
}
