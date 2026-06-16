import { db } from "@/lib/db";
import { routes, snapshots } from "@/lib/schema";
import { desc } from "drizzle-orm";
import RoutesTable, { type RouteWithHistory } from "@/components/routes-table";
import AddRouteForm from "@/components/add-route-form";
import { statsUrlFor } from "@/lib/scraper";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const allRoutes = await db.select().from(routes);
  const allSnapshots = await db.select().from(snapshots).orderBy(desc(snapshots.capturedAt));

  const byRoute = new Map<string, typeof allSnapshots>();
  for (const s of allSnapshots) {
    const list = byRoute.get(s.routeId) ?? [];
    list.push(s);
    byRoute.set(s.routeId, list);
  }

  const rows: RouteWithHistory[] = allRoutes.map((r) => ({
    ...r,
    statsUrl: statsUrlFor(r.id, r.url),
    history: (byRoute.get(r.id) ?? [])
      .slice()
      .reverse()
      .map((s) => ({
        capturedAt: s.capturedAt.toISOString(),
        tickCount: s.tickCount,
        commentCount: s.commentCount,
        starRating: s.starRating,
        pageViews: s.pageViews,
        todoCount: s.todoCount,
        suggestedGradeNumeric: s.suggestedGradeNumeric,
        suggestedGrade: s.suggestedGrade,
        ratingCount: s.ratingCount,
      })),
  }));

  return (
    <main className="container">
      <h1>Mountain Project Tracker</h1>
      <p className="subtitle">Routes you're watching. Click a row to see trends.</p>

      <AddRouteForm />

      {rows.length === 0 ? (
        <div className="empty">
          No routes yet. Paste a Mountain Project route URL above to get started.
        </div>
      ) : (
        <RoutesTable rows={rows} />
      )}
    </main>
  );
}
