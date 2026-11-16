import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { observations, sourceStatus, stories, dailyReports, storySources } from "@/db/schema";
import { collectAll } from "@/lib/collect";
import { rankEvents } from "@/lib/ranking";
import { readCurrentHotlists } from "@/lib/current-hotlists";

export const dynamic = "force-dynamic";
const storySchema = z.object({ id: z.string().min(1).max(120), title: z.string().min(1).max(200), summary: z.string().min(1).max(1500), category: z.string().max(50), observationIds: z.array(z.string()).min(1).max(20), sources: z.array(z.object({title:z.string().min(1).max(200),url:z.string().url().max(2000).refine(value => value.startsWith("https://") || value.startsWith("http://")),publishedAt:z.string().nullable()})).min(1).max(10) });
const definitions = [
  {name:"collect_hotlists",description:"更新四个平台热榜；各平台失败独立记录。",inputSchema:{type:"object",properties:{}}},
  {name:"read_hotlists",description:"读取最新热榜、来源状态和已有事件。",inputSchema:{type:"object",properties:{}}},
  {name:"prepare_curation",description:"读取当前有效榜单和待语义核对的候选话题；候选分组仅供参考，不能直接当作同一事件。",inputSchema:{type:"object",properties:{}}},
  {name:"save_stories",description:"保存已核对来源的热点摘要；每条必须关联已有热榜条目。",inputSchema:{type:"object",properties:{stories:{type:"array",items:{type:"object",properties:{id:{type:"string"},title:{type:"string"},summary:{type:"string"},category:{type:"string"},observationIds:{type:"array",items:{type:"string"}},sources:{type:"array",items:{type:"object",properties:{title:{type:"string"},url:{type:"string"},publishedAt:{type:["string","null"]}},required:["title","url","publishedAt"]}}},required:["id","title","summary","category","observationIds","sources"]}}},required:["stories"]}},
  {name:"read_reports",description:"读取最近的日报。",inputSchema:{type:"object",properties:{}}},
  {name:"save_daily",description:"按北京时间日期保存日报。",inputSchema:{type:"object",properties:{date:{type:"string"},content:{type:"string"}},required:["date","content"]}},
];
const content = (data: unknown, isError = false) => ({content:[{type:"text",text:JSON.stringify(data)}], ...(isError ? {isError:true}: {})});

export async function POST(request: Request) {
  let message: {id?: unknown; method?: string; params?: {name?: string; arguments?: unknown}};
  try { message = await request.json(); } catch { return Response.json({jsonrpc:"2.0",id:null,error:{code:-32700,message:"Invalid JSON"}},{status:400}); }
  const reply = (result: unknown) => Response.json({jsonrpc:"2.0",id:message.id ?? null,result});
  if(message.method === "initialize") return reply({protocolVersion:"2025-03-26",capabilities:{tools:{}},serverInfo:{name:"今日热闻",version:"0.1.0"}});
  if(message.method === "notifications/initialized") return new Response(null,{status:202});
  if(message.method === "server/discover") return reply({supportedVersions:["2026-07-28"],capabilities:{tools:{}}});
  if(message.method === "tools/list") return reply({tools:definitions});
  if(message.method !== "tools/call") return Response.json({jsonrpc:"2.0",id:message.id ?? null,error:{code:-32601,message:"Method not found"}});
  try {
    const db = getDb(), args = message.params?.arguments ?? {};
    switch(message.params?.name) {
      case "read_reports": return reply(content(await db.select().from(dailyReports).orderBy(desc(dailyReports.date)).limit(10)));
      case "collect_hotlists": return reply(content(await collectAll()));
      case "read_hotlists": { const current=await readCurrentHotlists(); return reply(content({ observations:current.entries, statuses:current.statuses, sources:await db.select().from(storySources).limit(500), stories:await db.select().from(stories).orderBy(desc(stories.updatedAt)).limit(100) })); }
      case "prepare_curation": {
        const [current, existing] = await Promise.all([readCurrentHotlists(), db.select().from(stories).orderBy(desc(stories.updatedAt)).limit(100)]);
        const candidates=rankEvents(current.entries,current.statuses,Date.now()).slice(0,80);
        return reply(content({ candidates, statuses:current.statuses, stories:existing, warning:"候选分组只是标题匹配结果；必须核实是否是同一事件及事实来源，不能直接发表。" }));
      }
      case "save_stories": {
        const input = z.object({stories:z.array(storySchema).max(10)}).parse(args);
        for(const item of input.stories) {
          const found = await db.select({id:observations.id,storyId:observations.storyId}).from(observations).where(inArray(observations.id,item.observationIds));
          if(new Set(found.map(x=>x.id)).size !== new Set(item.observationIds).size) throw new Error("存在无法查证的热榜条目");
          if(found.some(x=>x.storyId && x.storyId !== item.id)) throw new Error("热榜条目已关联其他事件，不能自动覆盖");
        }
        const now = new Date().toISOString();
        for(const item of input.stories) {
          const value = {id:item.id,title:item.title,summary:item.summary,category:item.category,updatedAt:now,visible:1};
          await db.batch([
            db.insert(stories).values(value).onConflictDoUpdate({target:stories.id,set:value}),
            db.update(observations).set({storyId:item.id}).where(inArray(observations.id,item.observationIds)),
            ...item.sources.map(source => db.insert(storySources).values({id:`${item.id}:${source.url}`,storyId:item.id,title:source.title,url:source.url,publishedAt:source.publishedAt,accessedAt:now}).onConflictDoUpdate({target:storySources.id,set:{title:source.title,publishedAt:source.publishedAt,accessedAt:now}})),
          ]);
        }
        return reply(content({saved:input.stories.length}));
      }
      case "save_daily": {
        const input=z.object({date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),content:z.string().min(1).max(15000)}).parse(args);
        const value={...input,createdAt:new Date().toISOString()};
        await db.insert(dailyReports).values(value).onConflictDoUpdate({target:dailyReports.date,set:value});
        return reply(content({saved:input.date}));
      }
      default: return reply(content({error:"Unknown tool"},true));
    }
  } catch(e) { return reply(content({error:e instanceof Error ? e.message : "更新失败"},true)); }
}
