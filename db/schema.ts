import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const stories = sqliteTable("stories", {
  id: text("id").primaryKey(), title: text("title").notNull(),
  summary: text("summary"), category: text("category"),
  updatedAt: text("updated_at").notNull(), visible: integer("visible").notNull().default(1),
});
export const observations = sqliteTable("observations", {
  id: text("id").primaryKey(), platform: text("platform").notNull(), title: text("title").notNull(),
  url: text("url").notNull(), rank: integer("rank").notNull(), observedAt: text("observed_at").notNull(),
  publishedAt: text("published_at"), storyId: text("story_id").references(() => stories.id),
});
export const sourceStatus = sqliteTable("source_status", {
  platform: text("platform").primaryKey(), lastAttemptAt: text("last_attempt_at"),
  lastSuccessAt: text("last_success_at"), sourceUpdatedAt: text("source_updated_at"), error: text("error"),
});
export const dailyReports = sqliteTable("daily_reports", {
  date: text("date").primaryKey(), content: text("content").notNull(), createdAt: text("created_at").notNull(),
});
export const storySources = sqliteTable("story_sources", {
  id: text("id").primaryKey(), storyId: text("story_id").notNull().references(() => stories.id),
  title: text("title").notNull(), url: text("url").notNull(),
  publishedAt: text("published_at"), accessedAt: text("accessed_at").notNull(),
});

export const hotlistSnapshots = sqliteTable("hotlist_snapshots", {
  id: text("id").primaryKey(),
  observationId: text("observation_id").notNull(),
  platform: text("platform").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  rank: integer("rank").notNull(),
  observedAt: text("observed_at").notNull(),
  sourceUpdatedAt: text("source_updated_at"),
}, table => [index("hotlist_snapshots_observed_at_idx").on(table.observedAt)]);
