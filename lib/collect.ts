import { getDb } from "@/db";
import { observations, sourceStatus, hotlistSnapshots } from "@/db/schema";
import { fetchSource, type Platform } from "./sources";

const platforms: Platform[] = ["微博", "抖音", "知乎", "B站"];

/** A failure is recorded per platform and never deletes its previous observations. */
export async function collectAll() {
  const db = getDb();
  return Promise.all(platforms.map(async platform => {
    const attempt = new Date().toISOString();
    try {
      const rows = (await fetchSource(platform)).map(row => ({ ...row, observedAt: attempt }));
      const sourceUpdatedAt = rows[0]?.sourceUpdatedAt ?? null;
      await db.batch([
        db.insert(sourceStatus).values({ platform, lastAttemptAt: attempt, lastSuccessAt: attempt, sourceUpdatedAt, error: null })
          .onConflictDoUpdate({ target: sourceStatus.platform, set: { lastAttemptAt: attempt, lastSuccessAt: attempt, sourceUpdatedAt, error: null } }),
        ...rows.map(row => db.insert(hotlistSnapshots).values({
          id: `${attempt}:${row.id}`, observationId: row.id, platform: row.platform,
          title: row.title, url: row.url, rank: row.rank, observedAt: attempt,
          sourceUpdatedAt: row.sourceUpdatedAt ?? null,
        }).onConflictDoNothing()),
        ...rows.map(row => db.insert(observations).values({id:row.id,platform:row.platform,title:row.title,url:row.url,rank:row.rank,observedAt:row.observedAt,publishedAt:row.publishedAt}).onConflictDoUpdate({
          target: observations.id,
          set: { title: row.title, rank: row.rank, observedAt: row.observedAt, publishedAt: row.publishedAt },
        })),
      ]);
      return { platform, count: rows.length, ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 200) : "采集失败";
      await db.insert(sourceStatus).values({ platform, lastAttemptAt: attempt, error: message })
        .onConflictDoUpdate({ target: sourceStatus.platform, set: { lastAttemptAt: attempt, error: message } });
      return { platform, count: 0, ok: false, error: message };
    }
  }));
}
