"use server";

import { db } from "@/lib/db";
import { routes } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { parseRouteUrl, scrapeRoute } from "@/lib/scraper";
import { revalidatePath } from "next/cache";

export type AddResult = { ok: true } | { ok: false; error: string };

export async function addRoute(formData: FormData): Promise<AddResult> {
  const raw = String(formData.get("url") || "");
  const parsed = parseRouteUrl(raw);
  if (!parsed) return { ok: false, error: "That doesn't look like a Mountain Project route URL." };

  const existing = await db.select().from(routes).where(eq(routes.id, parsed.routeId));
  if (existing.length > 0) return { ok: false, error: "You're already subscribed to that route." };

  let scraped;
  try {
    scraped = await scrapeRoute(parsed.routeId, parsed.canonicalUrl);
  } catch (e) {
    return { ok: false, error: `Couldn't fetch route: ${e instanceof Error ? e.message : "unknown"}` };
  }

  await db.insert(routes).values({
    id: parsed.routeId,
    name: scraped.name || "Unknown route",
    location: scraped.location,
    url: parsed.canonicalUrl,
    grade: scraped.grade,
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
  });

  revalidatePath("/");
  return { ok: true };
}

export async function deleteRoute(routeId: string): Promise<void> {
  await db.delete(routes).where(eq(routes.id, routeId));
  revalidatePath("/");
}
