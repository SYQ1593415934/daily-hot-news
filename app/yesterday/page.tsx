import { and, gte, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { hotlistSnapshots } from "@/db/schema";
import { rankYesterday, yesterdayWindow } from "@/lib/yesterday";

export const dynamic = "force-dynamic";

export default async function Yesterday() {
  const window = yesterdayWindow(new Date());
  let rows: typeof hotlistSnapshots.$inferSelect[] = [];
  let unavailable = false;
  try {
    rows = await getDb().select().from(hotlistSnapshots).where(and(gte(hotlistSnapshots.observedAt, window.start), lt(hotlistSnapshots.observedAt, window.end)));
  } catch { unavailable = true; }
  const usableRows = rows.filter(row => !row.sourceUpdatedAt || (row.sourceUpdatedAt >= window.start && row.sourceUpdatedAt < window.end));
  const events = rankYesterday(usableRows, window.start, window.end).slice(0, 100);
  const times = usableRows.map(row => row.observedAt).sort();
  const format = (value: string) => new Date(value).toLocaleString("zh-CN", {timeZone:"Asia/Shanghai",hour:"2-digit",minute:"2-digit",hour12:false});
  return <main className="min-h-screen bg-white text-[#202020]"><div className="mx-auto max-w-[810px] px-6 pb-20 pt-12 sm:px-10 sm:pt-20">
    <a href="/" className="text-sm text-[#888] hover:text-[#c83d2c]">← 返回热点</a>
    <header className="mt-9"><p className="text-[11px] tracking-[0.22em] text-[#a5a09b]">THE DAILY SIGNAL</p><h1 className="mt-3 font-serif text-3xl font-semibold">昨日总榜</h1><div className="mt-5 h-[3px] w-10 bg-[#c83d2c]"/></header>
    <div className="mt-10 flex flex-wrap items-center justify-between gap-2 border-b border-[#ddd] pb-4"><h2 className="font-semibold">{window.date}</h2><span className="text-xs text-[#999]">北京时间 00:00—24:00</span></div>
    <p className="mt-4 text-xs leading-6 text-[#999]">按昨日采集的各平台最佳名次和覆盖平台数计算，合并相似话题。榜单反映已采集时段，可能有遗漏。</p>
    {unavailable ? <p className="py-16 text-sm text-[#888]">昨日榜单暂时无法加载。</p> : !events.length ? <p className="py-16 text-sm text-[#888]">昨日没有保存的榜单数据。开始采集后，次日可查看。</p> : <>
      <p className="mt-2 text-xs text-[#999]">已采集时段 {format(times[0])}—{format(times[times.length-1])} · {new Set(usableRows.map(row=>row.platform)).size} 个平台</p>
      <ol>{events.map((event,index)=><li key={event.items[0].id} className="flex items-start gap-4 border-b border-[#eee] py-5"><span className="w-7 shrink-0 font-serif text-[#c83d2c]">{String(index+1).padStart(2,"0")}</span><div className="min-w-0 flex-1"><a href={event.items[0].url} target="_blank" rel="noopener noreferrer" className="break-words font-semibold leading-6 hover:text-[#c83d2c]">{event.title} ↗</a><p className="mt-2 text-xs text-[#999]">{[...new Set(event.items.map(item=>item.platform))].join(" · ")}</p></div><span className="shrink-0 text-sm text-[#777]">{event.score} 热度</span></li>)}</ol>
    </>}
  </div></main>;
}
