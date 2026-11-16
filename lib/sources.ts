export type Platform = "微博" | "抖音" | "知乎" | "B站";
export type Observation = {
  id: string; platform: Platform; title: string; url: string; rank: number;
  observedAt: string; publishedAt: string | null; sourceUpdatedAt?: string | null;
};
type JsonObject = Record<string, unknown>;
const record = (v: unknown): JsonObject => v && typeof v === "object" ? v as JsonObject : {};
const list = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const string = (v: unknown): string => typeof v === "string" ? v.trim() : "";

export function parseSource(platform: Platform, body: unknown, observedAt: string): Observation[] {
  const root = record(body), data = record(root.data), result = record(root.result);
  const rows = platform === "微博" ? list(result.list) : platform === "抖音" ? list(root.word_list)
    : platform === "知乎" ? list(root.data) : list(data.list);
  const output: Observation[] = [];
  rows.forEach((row, index) => {
    const item = record(row), target = record(item.target);
    const title = platform === "微博" ? string(item.hotword) : platform === "抖音" ? string(item.word)
      : platform === "知乎" ? string(record(target.title_area).text) : string(item.title);
    const url = platform === "微博" ? `https://s.weibo.com/weibo?q=${encodeURIComponent(title)}`
      : platform === "抖音" ? `https://www.douyin.com/search/${encodeURIComponent(title)}`
      : platform === "知乎" ? string(record(target.link).url)
      : string(item.bvid) ? `https://www.bilibili.com/video/${encodeURIComponent(string(item.bvid))}` : "";
    if (!title || !url) return;
    const rawDate = platform === "B站" && typeof item.pubdate === "number" ? new Date(item.pubdate * 1000) : null;
    const publishedAt = rawDate && !Number.isNaN(rawDate.valueOf()) ? rawDate.toISOString() : null;
    output.push({ id: `${platform}:${url}`, platform, title, url, rank: index + 1, observedAt, publishedAt });
  });
  if (!output.length) throw new Error(`${platform}榜单为空或数据格式已变化`);
  return output;
}


export function parseWeiboSnapshot(body: unknown, now: number): Observation[] {
    const snapshot = record(body);
    const board = list(snapshot.boards).map(record).find(item => item.platform === "weibo");
    if (!board || board.ok !== true) throw new Error("微博免费信源本次采集失败");
    const updatedAt = string(board.fetched_at);
    const parsed = Date.parse(updatedAt);
    if (!Number.isFinite(parsed) || parsed > now + 5 * 60_000 || now - parsed > 3 * 60 * 60_000) throw new Error("微博免费信源数据过期，请稍后重试");
    const items = list(board.items).map(record).map((item, index) => {
      const title = string(item.title);
      const rank = typeof item.rank === "number" && Number.isInteger(item.rank) && item.rank > 0 ? item.rank : index + 1;
      const url = `https://s.weibo.com/weibo?q=${encodeURIComponent(title)}`;
      return {id:`微博:${url}`,platform:"微博" as const,title,url,rank,observedAt:new Date().toISOString(),publishedAt:null,sourceUpdatedAt:new Date(parsed).toISOString()};
    }).filter(item => item.title);
    if (!items.length) throw new Error("微博免费信源没有返回榜单");
    return items;
}

export function parseBilibiliSnapshot(body: string, now: number): Observation[] {
  const section = body.match(/<!-- BEGIN BILIBILI -->([\s\S]*?)<!-- END BILIBILI -->/i)?.[1];
  const timestamp = section?.match(/最后更新时间\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+([+-]\d{4})/);
  if (!section || !timestamp) throw new Error("B站备用信源格式已变化");
  const parsed = Date.parse(`${timestamp[1]}T${timestamp[2]}${timestamp[3].slice(0, 3)}:${timestamp[3].slice(3)}`);
  if (!Number.isFinite(parsed) || parsed > now + 5 * 60_000 || now - parsed > 6 * 60 * 60_000) throw new Error("B站备用信源数据过期，请稍后重试");
  const observedAt = new Date(now).toISOString();
  const sourceUpdatedAt = new Date(parsed).toISOString();
  const rows = [...section.matchAll(/^\s*\d+\. \[(.+?)\]\(https:\/\/b23\.tv\/(BV[a-zA-Z0-9]+)\)\s*$/gm)];
  const items: Observation[] = rows.map((match, index) => {
    const url = `https://www.bilibili.com/video/${match[2]}`;
    return { id: `B站:${url}`, platform: "B站" as const, title: match[1].trim(), url, rank: index + 1, observedAt, publishedAt: null, sourceUpdatedAt };
  }).filter(item => item.title);
  if (!items.length) throw new Error("B站备用信源没有返回榜单");
  return items;
}

export function parseBilibiliFreeApi(body: unknown, now: number): Observation[] {
  const root = record(body), data = record(root.data), board = record(record(data.sources).bilibili);
  const timestamp = typeof board.cached_at === "number" ? board.cached_at * 1000 : NaN;
  if (root.code !== 1 || board.stale !== false || data.stale !== false || string(board.error)) throw new Error("B站备用信源采集失败");
  if (!Number.isFinite(timestamp) || timestamp > now + 300_000 || now - timestamp > 3 * 3600_000) throw new Error("B站备用信源数据过期");
  const sourceUpdatedAt = new Date(timestamp).toISOString(), observedAt = new Date(now).toISOString();
  const items: Observation[] = list(board.items).map((value, index) => {
    const item = record(value), title = string(item.title), sourceUrl = string(item.url);
    const id = sourceUrl.match(/^https:\/\/b23\.tv\/(BV[a-zA-Z0-9]+)$/)?.[1];
    const url = id ? `https://www.bilibili.com/video/${id}` : "";
    const rank = typeof item.rank === "number" && Number.isInteger(item.rank) && item.rank > 0 ? item.rank : index + 1;
    return {id:`B站:${url}`,platform:"B站" as const,title,url,rank,observedAt,publishedAt:null,sourceUpdatedAt};
  }).filter(item => item.title && item.url);
  if (!items.length) throw new Error("B站备用信源没有返回榜单");
  return items;
}

async function fetchBilibiliFreeApi(): Promise<Observation[]> {
  const response = await fetch("https://api.vsaa.cn/api/toolbox/hot/hot.php?source=bilibili&limit=20", {signal: AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error(`B站备用信源不可用（HTTP ${response.status}）`);
  return parseBilibiliFreeApi(await response.json(), Date.now());
}

async function fetchBilibiliSnapshot(): Promise<Observation[]> {
  const response = await fetch("https://api.github.com/repos/cxyfreedom/website-hot-hub/contents/README.md", {
    headers: { Accept: "application/vnd.github.raw+json", "User-Agent": "Daily-News-Hotlist/1.0" }, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`B站备用信源不可用（HTTP ${response.status}）`);
  return parseBilibiliSnapshot(await response.text(), Date.now());
}

export async function fetchSource(platform: Platform): Promise<Observation[]> {
  if (platform === "微博") {
    // Public third-party snapshot. Never mistake its collection time for the platform update time.
    const snapshotResponse = await fetch("https://solarhell.github.io/hot-search-crawler/latest.json", {signal: AbortSignal.timeout(15000)});
    if (!snapshotResponse.ok) throw new Error(`微博免费信源不可用（HTTP ${snapshotResponse.status}）`);
    return parseWeiboSnapshot(await snapshotResponse.json(), Date.now());
  }
  const urls: Record<Platform, string> = {
    "微博": "https://solarhell.github.io/hot-search-crawler/latest.json",
    "抖音": "https://www.iesdouyin.com/web/api/v2/hotsearch/billboard/word/",
    "知乎": "https://www.zhihu.com/api/v3/feed/topstory/hot-list-web?limit=20&desktop=true",
    "B站": "https://api.bilibili.com/x/web-interface/popular",
  };
  try {
    const response = await fetch(urls[platform], { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`${platform}请求失败（HTTP ${response.status}）`);
    const body: unknown = await response.json();
    return parseSource(platform, body, new Date().toISOString());
  } catch (error) {
    if (platform !== "B站") throw error;
    try { return await fetchBilibiliFreeApi(); }
    catch { /* Try the independent public snapshot as a last resort. */ }
    try { return await fetchBilibiliSnapshot(); }
    catch (fallbackError) {
      const reason = fallbackError instanceof Error ? fallbackError.message : "未知错误";
      throw new Error(`B站更新失败：${reason}`);
    }
  }
}
