import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const podcasts = sqliteTable("podcasts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  taddyId: text("taddy_id").notNull(),
  latestEpisodeTitle: text("latest_episode_title"),
  latestEpisodeDate: text("latest_episode_date"),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updated_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
}, t => [
  index("podcasts_taddy_id_idx").on(t.taddyId),
]);

export const episodes = sqliteTable("episodes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  podcastId: text("podcast_id").notNull().references(() => podcasts.id),
  title: text("title").notNull(),
  publishDate: text("publish_date").notNull(),
  transcript: text("transcript").notNull(),
  summary: text("summary"),
  keyInsights: text("key_insights", { mode: "json" }).$type<string[]>(),
  mainTopics: text("main_topics", { mode: "json" }).$type<string[]>(),
  actionableItems: text("actionable_items", { mode: "json" }).$type<string[]>(),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updated_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
}, t => [
  index("episodes_podcast_id_idx").on(t.podcastId),
  index("episodes_publish_date_idx").on(t.publishDate),
]);

export const summaryRequests = sqliteTable("summary_requests", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userEmail: text("user_email").notNull(),
  selectedPodcasts: text("selected_podcasts", { mode: "json" }).notNull().$type<string[]>(),
  episodeLimit: integer("episode_limit", { mode: "number" }).notNull(),
  sendEmail: integer("send_email", { mode: "boolean" }).notNull(),
  status: text("status", { enum: ["pending", "processing", "completed", "failed"] }).notNull().default("pending"),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  completedAt: text("completed_at"),
}, t => [
  index("summary_requests_user_email_idx").on(t.userEmail),
  index("summary_requests_status_idx").on(t.status),
  index("summary_requests_created_at_idx").on(t.createdAt),
]);

export const trendAnalyses = sqliteTable("trend_analyses", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  summaryRequestId: text("summary_request_id").notNull().references(() => summaryRequests.id),
  recurringThemes: text("recurring_themes", { mode: "json" }).notNull().$type<string[]>(),
  emergingTopics: text("emerging_topics", { mode: "json" }).notNull().$type<string[]>(),
  contradictions: text("contradictions", { mode: "json" }).notNull().$type<string[]>(),
  metaInsights: text("meta_insights").notNull(),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
}, t => [
  index("trend_analyses_summary_request_id_idx").on(t.summaryRequestId),
]);

export const podcastsRelations = relations(podcasts, ({ many }) => ({
  episodes: many(episodes),
}));

export const episodesRelations = relations(episodes, ({ one }) => ({
  podcast: one(podcasts, {
    fields: [episodes.podcastId],
    references: [podcasts.id],
  }),
}));

export const summaryRequestsRelations = relations(summaryRequests, ({ many }) => ({
  trendAnalyses: many(trendAnalyses),
}));

export const trendAnalysesRelations = relations(trendAnalyses, ({ one }) => ({
  summaryRequest: one(summaryRequests, {
    fields: [trendAnalyses.summaryRequestId],
    references: [summaryRequests.id],
  }),
}));