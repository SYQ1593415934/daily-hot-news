import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { stories, observations, storySources } from "@/db/schema";
export const dynamic = "force-dynamic";
export default async function Story({params}:{params:Promise<{id:string}>}) {
  const {id} = await params;
  const db = getDb();
  const [rows,platforms,sources] = await Promise.all([
    db.select().from(stories).where(eq(stories.id,id)).limit(1),
    db.select().from(observations).where(eq(observations.storyId,id)),
    db.select().from(storySources).where(eq(storySources.storyId,id)),
  ]);
  const story = rows[0];
  if(!story || !story.visible) notFound();
  const format = (date:string) => new Date(date).toLocaleString("zh-CN",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"});
  return <main className="mx-auto max-w-[810px] px-6 pb-24 pt-12 sm:px-10 sm:pt-20"><a href="/" className="text-sm text-[#888] hover:text-[#c83d2c]">← 返回热点</a><p className="mt-12 text-xs tracking-widest text-[#c83d2c]">{story.category || "综合"}</p><h1 className="mt-4 text-3xl font-semibold leading-snug sm:text-4xl">{story.title}</h1><p className="mt-4 text-xs text-[#999]">更新于 {format(story.updatedAt)} · 北京时间</p><div className="mt-10 h-[3px] w-10 bg-[#c83d2c]"/><p className="mt-9 whitespace-pre-wrap text-base leading-8 text-[#444]">{story.summary || "背景待补充"}</p><section className="mt-14 border-t border-[#ddd] pt-8"><h2 className="text-sm font-semibold">报道来源</h2>{sources.length ? <ul className="mt-4 space-y-3">{sources.map(source=><li key={source.id}><a className="text-sm text-[#555] underline decoration-[#ddd] underline-offset-4 hover:text-[#c83d2c]" href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a></li>)}</ul> : <p className="mt-4 text-sm text-[#999]">暂无可核对的报道来源。</p>}</section><section className="mt-10 border-t border-[#eee] pt-8"><h2 className="text-sm font-semibold">平台话题</h2><ul className="mt-4 space-y-3">{platforms.map(source=><li key={source.id}><a className="text-sm text-[#777] hover:text-[#c83d2c]" href={source.url} target="_blank" rel="noopener noreferrer">{source.platform} · {source.title} ↗</a></li>)}</ul></section></main>;
}
