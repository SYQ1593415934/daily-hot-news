import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSource, parseWeiboSnapshot, parseBilibiliSnapshot, parseBilibiliFreeApi, fetchSource } from "./sources.ts";
const now = "2026-11-15T00:00:00.000Z";
test("parses each platform without inventing publication dates", () => {
  const cases = [
    ["微博", { result: { list: [{ hotword: "热点一" }] } }],
    ["抖音", { word_list: [{ word: "热点二" }] }],
    ["知乎", { data: [{ target: { title_area: { text: "热点三" }, link: { url: "https://www.zhihu.com/question/1" } } }] }],
    ["B站", { data: { list: [{ title: "热点四", bvid: "BV1", pubdate: 1760000000 }] } }],
  ] as const;
  for (const [platform, data] of cases) {
    const [item] = parseSource(platform, data, now);
    assert.equal(item.platform, platform);
    assert.equal(item.rank, 1);
    assert.equal(item.observedAt, now);
    assert.match(item.url, /^https:\/\//);
    assert.equal(item.publishedAt === null, platform !== "B站");
  }
});
test("rejects empty or changed source responses", () => {
  assert.throws(() => parseSource("抖音", {}, now));
});

test("free Weibo snapshots expose source time and reject stale or failed boards", () => {
  const now = Date.parse("2026-11-15T00:00:00Z");
  const board = { boards: [{ platform: "weibo", ok: true, fetched_at: "2026-11-14T23:45:00Z", items: [{rank: 1, title: "热点"}] }] };
  const [entry] = parseWeiboSnapshot(board, now);
  assert.equal(entry.sourceUpdatedAt, "2026-11-14T23:45:00.000Z");
  assert.equal(entry.rank, 1);
  assert.throws(() => parseWeiboSnapshot(board, now + 4 * 3600_000));
  assert.throws(() => parseWeiboSnapshot({boards:[{platform:"weibo",ok:false}]}, now));
});

test("Bilibili fallback keeps source time and rejects stale or invalid snapshots", () => {
  const snapshot = `<!-- BEGIN BILIBILI -->
<!-- 最后更新时间 2026-11-15 19:02:03 +0800 -->
1. [视频一](https://b23.tv/BV15es76gEgL)
1. [视频二](https://b23.tv/BV1kZWX62ENY)
<!-- END BILIBILI -->`;
  const time = Date.parse("2026-11-15T14:00:00Z");
  const entries = parseBilibiliSnapshot(snapshot, time);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].sourceUpdatedAt, "2026-11-15T11:02:03.000Z");
  assert.equal(entries[1].rank, 2);
  assert.equal(entries[0].url, "https://www.bilibili.com/video/BV15es76gEgL");
  assert.throws(() => parseBilibiliSnapshot(snapshot, time + 6 * 3600_000));
  assert.throws(() => parseBilibiliSnapshot("invalid", time));
});

test("Bilibili retries with identified public snapshot when official source fails", async () => {
  const original = globalThis.fetch;
  const snapshot = `<!-- BEGIN BILIBILI -->\n<!-- 最后更新时间 ${new Date().toISOString().slice(0,10)} 00:00:00 +0000 -->\n1. [视频一](https://b23.tv/BV15es76gEgL)\n<!-- END BILIBILI -->`;
  try {
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).includes("api.bilibili.com")) return new Response("blocked", {status:412});
      if (String(url).includes("api.vsaa.cn")) return new Response("unavailable", {status:503});
      assert.equal(new Headers(init?.headers).get("user-agent"), "Daily-News-Hotlist/1.0");
      return new Response(snapshot.replace(/\d{4}-\d{2}-\d{2} 00:00:00 \+0000/, new Date().toISOString().replace("T", " ").slice(0,19) + " +0000"));
    }) as typeof fetch;
    const items = await fetchSource("B站");
    assert.equal(items[0].title, "视频一");
    assert.ok(items[0].sourceUpdatedAt);
  } finally { globalThis.fetch = original; }
});

test("Bilibili free API validates freshness, source status and video links", () => {
  const now = Date.parse("2026-11-15T14:44:30Z");
  const body = {code:1,data:{stale:false,sources:{bilibili:{stale:false,error:"",cached_at:now/1000,items:[{rank:2,title:"视频",url:"https://b23.tv/BV15es76gEgL"}]}}}};
  const [item] = parseBilibiliFreeApi(body, now);
  assert.equal(item.rank, 2);
  assert.equal(item.sourceUpdatedAt, new Date(now).toISOString());
  assert.equal(item.url, "https://www.bilibili.com/video/BV15es76gEgL");
  assert.throws(() => parseBilibiliFreeApi(body, now + 4 * 3600_000));
  assert.throws(() => parseBilibiliFreeApi({...body, data:{...body.data,stale:true}}, now));
});
