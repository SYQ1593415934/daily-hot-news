import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { dailyReports } from "@/db/schema";

export const dynamic = "force-dynamic";

type Report = typeof dailyReports.$inferSelect;
type Section = { title: string | null; lines: string[] };

function splitReport(content: string): Section[] {
  const sections: Section[] = [];
  let current: Section = { title: null, lines: [] };
  for (const line of content.split(/\r?\n/)) {
    const heading = line.match(/^\s*\d+[.、]\s*(.+)$/);
    if (heading) {
      if (current.title || current.lines.some(value => value.trim())) sections.push(current);
      current = { title: heading[1].trim(), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.title || current.lines.some(value => value.trim())) sections.push(current);
  return sections;
}

function TextWithLinks({ text }: { text: string }) {
  return <>{text.split(/(https?:\/\/[^\s]+)/g).map((part, index) => {
    if (!/^https?:\/\//.test(part)) return part;
    return <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="break-all text-[#b74232] underline decoration-[#e4c4be] underline-offset-4 hover:decoration-[#b74232]">查看来源 ↗</a>;
  })}</>;
}

function Brief({ report }: { report: Report }) {
  const sections = splitReport(report.content);
  return <article>
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#242424] pb-4">
      <div><p className="text-xs tracking-[0.14em] text-[#a5a09b]">DAILY BRIEF</p><h2 className="mt-2 font-serif text-2xl font-semibold">{report.date}</h2></div>
      <p className="text-xs text-[#999]">更新于 {new Date(report.createdAt).toLocaleString("zh-CN", {timeZone:"Asia/Shanghai",hour12:false})}</p>
    </div>
    <div>{sections.map((section, index) => {
      const lines = section.lines.join("\n").trim();
      if (!section.title) return <p key={index} className="mt-6 whitespace-pre-wrap text-sm leading-7 text-[#888]"><TextWithLinks text={lines}/></p>;
      return <section key={index} className="grid grid-cols-[2rem_1fr] gap-3 border-b border-[#eeeae6] py-7 sm:grid-cols-[3rem_1fr] sm:gap-5">
        <span className="font-serif text-lg text-[#c83d2c]">{String(sections.slice(0,index+1).filter(item=>item.title).length).padStart(2,"0")}</span>
        <div><h3 className="text-base font-semibold leading-7 sm:text-lg">{section.title}</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#666]"><TextWithLinks text={lines}/></p></div>
      </section>;
    })}</div>
  </article>;
}

export default async function Daily({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  let reports: Report[] = [];
  let unavailable = false;
  try { reports = await getDb().select().from(dailyReports).orderBy(desc(dailyReports.date)).limit(30); }
  catch { unavailable = true; }
  const report = reports.find(item => item.date === date) || reports[0];
  return <main className="min-h-screen bg-white text-[#202020]"><div className="mx-auto max-w-[810px] px-6 pb-20 pt-12 sm:px-10 sm:pt-20">
    <a href="/" className="text-sm text-[#888] hover:text-[#c83d2c]">← 返回热点</a>
    <header className="mb-12 mt-9 flex flex-wrap items-end justify-between gap-5"><div><p className="text-[11px] tracking-[0.22em] text-[#a5a09b]">THE DAILY SIGNAL</p><h1 className="mt-3 font-serif text-3xl font-semibold sm:text-4xl">每日简报</h1><div className="mt-5 h-[3px] w-10 bg-[#c83d2c]"/></div>
      {reports.length > 1 && <form method="get" className="flex items-center gap-2"><label htmlFor="brief-date" className="text-xs text-[#888]">往期</label><select id="brief-date" name="date" defaultValue={report?.date} className="border-b border-[#ddd] bg-white px-1 py-2 text-sm">{reports.map(item=><option key={item.date} value={item.date}>{item.date}</option>)}</select><button className="px-2 py-2 text-sm text-[#b74232] hover:underline">查看</button></form>}
    </header>
    {unavailable ? <p className="py-12 text-sm text-[#888]">简报暂时无法加载，请稍后再试。</p> : report ? <Brief report={report}/> : <section className="border-t border-[#ddd] py-12"><p className="font-semibold">简报暂未生成</p><p className="mt-3 text-sm leading-6 text-[#888]">可先到首页查看各平台最新热点。</p><a href="/" className="mt-5 inline-block text-sm text-[#b74232] hover:underline">查看热点 →</a></section>}
  </div></main>;
}
