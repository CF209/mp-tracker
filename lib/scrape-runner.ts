import { db } from "./db";
import { routes, snapshots, seenComments, seenTicks, seenStars, seenRatings } from "./schema";
import { eq } from "drizzle-orm";
import { scrapeRoute, statsUrlFor, type Sample } from "./scraper";
import { sendDigest, type RouteChange } from "./notify";

export type RunResult = {
  scanned: number;
  errors: Array<{ routeId: string; error: string }>;
  notified: number;
};

export async function runScrape(): Promise<RunResult> {
  const all = await db.select().from(routes);
  const errors: RunResult["errors"] = [];
  const changes: RouteChange[] = [];

  for (const r of all) {
    try {
      const scraped = await scrapeRoute(r.id, r.url);

      await db.insert(snapshots).values({
        routeId: r.id,
        tickCount: scraped.tickCount,
        commentCount: scraped.commentCount,
        starRating: scraped.starRating,
        starVotes: scraped.starVotes,
        pageViews: scraped.pageViews,
        todoCount: scraped.todoCount,
        suggestedGradeNumeric: scraped.suggestedGradeNumeric,
        suggestedGrade: scraped.suggestedGrade,
        ratingCount: scraped.ratingCount,
      });

      const newTicks = Math.max(0, scraped.tickCount - r.tickCount);
      const newComments = Math.max(0, scraped.commentCount - r.commentCount);
      const newStars = Math.max(0, scraped.starVotes - r.starVotes);
      const newTodos = Math.max(0, scraped.todoCount - r.todoCount);

      const freshComments = await pickNew(r.id, scraped.commentSamples, seenComments);
      const freshTicks = await pickNew(r.id, scraped.tickSamples, seenTicks);
      const freshStars = await pickNew(r.id, scraped.starSamples, seenStars);
      const freshRatings = await pickNew(r.id, scraped.ratingSamples, seenRatings);

      await db
        .update(routes)
        .set({
          name: scraped.name || r.name,
          location: scraped.location || r.location,
          grade: scraped.grade || r.grade,
          tickCount: scraped.tickCount,
          commentCount: scraped.commentCount,
          starRating: scraped.starRating,
          starVotes: scraped.starVotes,
          pageViews: scraped.pageViews,
          todoCount: scraped.todoCount,
          suggestedGrade: scraped.suggestedGrade,
          suggestedGradeNumeric: scraped.suggestedGradeNumeric,
          ratingCount: scraped.ratingCount,
          tickHistory: scraped.tickHistory,
          lastScrapedAt: new Date(),
        })
        .where(eq(routes.id, r.id));

      if (newTicks > 0 || newComments > 0 || newStars > 0 || newTodos > 0 || freshRatings.length > 0) {
        changes.push({
          routeName: scraped.name || r.name,
          routeUrl: scraped.url,
          statsUrl: statsUrlFor(r.id, scraped.url),
          newTicks,
          newComments,
          newStars,
          newTodos,
          newRatings: freshRatings.length,
          commentSamples: freshComments,
          tickSamples: freshTicks,
          starSamples: freshStars,
          ratingSamples: freshRatings,
        });
      }
    } catch (e) {
      errors.push({ routeId: r.id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  if (changes.length > 0) {
    await sendDigest(changes);
  }
  return { scanned: all.length, errors, notified: changes.length };
}

// Insert samples whose fingerprints we haven't seen for this route; return only the new ones.
// All four "seen_*" tables have identical shape so we accept any of them.
type SeenTable = typeof seenComments | typeof seenTicks | typeof seenStars | typeof seenRatings;

async function pickNew(
  routeId: string,
  samples: Sample[],
  table: SeenTable,
): Promise<Sample[]> {
  const fresh: Sample[] = [];
  for (const s of samples) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inserted = await (db.insert(table as any) as any)
      .values({
        routeId,
        fingerprint: s.fingerprint,
        author: s.author,
        snippet: s.snippet,
      })
      .onConflictDoNothing()
      .returning();
    if (inserted.length > 0) fresh.push(s);
  }
  return fresh;
}
