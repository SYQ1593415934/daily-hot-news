import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { observations, sourceStatus } from "@/db/schema";

/** Load each platform's last complete snapshot without a global historical-row limit. */
export async function readCurrentHotlists() {
  const db = getDb();
  const statuses = await db.select().from(sourceStatus);
  const snapshots = await Promise.all(statuses.filter(s => s.lastSuccessAt).map(s =>
    db.select().from(observations).where(and(eq(observations.platform, s.platform), eq(observations.observedAt, s.lastSuccessAt!)))
  ));
  return { statuses, entries: snapshots.flat() };
}
