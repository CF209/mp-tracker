import {
  pgTable,
  text,
  integer,
  real,
  timestamp,
  serial,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const routes = pgTable("routes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location").notNull().default(""),
  url: text("url").notNull(),
  grade: text("grade").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastScrapedAt: timestamp("last_scraped_at", { withTimezone: true }),
  tickCount: integer("tick_count").notNull().default(0),
  commentCount: integer("comment_count").notNull().default(0),
  starRating: real("star_rating").notNull().default(0),
  starVotes: integer("star_votes").notNull().default(0),
  pageViews: integer("page_views").notNull().default(0),
  todoCount: integer("todo_count").notNull().default(0),
  suggestedGrade: text("suggested_grade").notNull().default(""),
  suggestedGradeNumeric: real("suggested_grade_numeric").notNull().default(0),
  ratingCount: integer("rating_count").notNull().default(0),
  // Daily histogram of all ticks ever recorded on this route: [{ date: "YYYY-MM-DD", count: N }, ...].
  // Recomputed each scrape from the ticks API. Lets us draw a real ticks-over-time curve, not
  // just the few scrape points we've collected.
  tickHistory: jsonb("tick_history").$type<Array<{ date: string; count: number }>>().notNull().default([]),
});

export const snapshots = pgTable(
  "snapshots",
  {
    id: serial("id").primaryKey(),
    routeId: text("route_id")
      .notNull()
      .references(() => routes.id, { onDelete: "cascade" }),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
    tickCount: integer("tick_count").notNull(),
    commentCount: integer("comment_count").notNull(),
    starRating: real("star_rating").notNull(),
    starVotes: integer("star_votes").notNull(),
    pageViews: integer("page_views").notNull(),
    todoCount: integer("todo_count").notNull().default(0),
    suggestedGradeNumeric: real("suggested_grade_numeric").notNull().default(0),
    suggestedGrade: text("suggested_grade").notNull().default(""),
    ratingCount: integer("rating_count").notNull().default(0),
  },
  (t) => ({
    routeCapturedIdx: index("snapshots_route_captured_idx").on(t.routeId, t.capturedAt),
  }),
);

export const seenComments = pgTable(
  "seen_comments",
  {
    id: serial("id").primaryKey(),
    routeId: text("route_id")
      .notNull()
      .references(() => routes.id, { onDelete: "cascade" }),
    fingerprint: text("fingerprint").notNull(),
    author: text("author").notNull().default(""),
    snippet: text("snippet").notNull().default(""),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("seen_comments_route_fp_idx").on(t.routeId, t.fingerprint),
  }),
);

export const seenTicks = pgTable(
  "seen_ticks",
  {
    id: serial("id").primaryKey(),
    routeId: text("route_id")
      .notNull()
      .references(() => routes.id, { onDelete: "cascade" }),
    fingerprint: text("fingerprint").notNull(),
    author: text("author").notNull().default(""),
    snippet: text("snippet").notNull().default(""),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("seen_ticks_route_fp_idx").on(t.routeId, t.fingerprint),
  }),
);

export const seenStars = pgTable(
  "seen_stars",
  {
    id: serial("id").primaryKey(),
    routeId: text("route_id")
      .notNull()
      .references(() => routes.id, { onDelete: "cascade" }),
    fingerprint: text("fingerprint").notNull(),
    author: text("author").notNull().default(""),
    snippet: text("snippet").notNull().default(""),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("seen_stars_route_fp_idx").on(t.routeId, t.fingerprint),
  }),
);

export const seenRatings = pgTable(
  "seen_ratings",
  {
    id: serial("id").primaryKey(),
    routeId: text("route_id")
      .notNull()
      .references(() => routes.id, { onDelete: "cascade" }),
    fingerprint: text("fingerprint").notNull(),
    author: text("author").notNull().default(""),
    snippet: text("snippet").notNull().default(""),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("seen_ratings_route_fp_idx").on(t.routeId, t.fingerprint),
  }),
);

export type Route = typeof routes.$inferSelect;
export type Snapshot = typeof snapshots.$inferSelect;
