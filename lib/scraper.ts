import * as cheerio from "cheerio";
import { gradeToNumeric, mode } from "./grade";

const UA = "Mozilla/5.0 (compatible; MP-Tracker/1.0; personal route tracker)";
const BASE = "https://www.mountainproject.com";

export type Sample = { fingerprint: string; author: string; snippet: string };

export type ScrapedRoute = {
  routeId: string;
  name: string;
  location: string;
  url: string;
  grade: string;
  tickCount: number;
  commentCount: number;
  starRating: number;
  starVotes: number;
  pageViews: number;
  todoCount: number;
  suggestedGrade: string;
  suggestedGradeNumeric: number;
  ratingCount: number;
  tickHistory: Array<{ date: string; count: number }>;
  commentSamples: Sample[];
  tickSamples: Sample[];
  starSamples: Sample[];
  ratingSamples: Sample[];
};

export function parseRouteUrl(input: string): { routeId: string; canonicalUrl: string } | null {
  try {
    const u = new URL(input.trim());
    if (!u.hostname.includes("mountainproject.com")) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    const routeIdx = parts.indexOf("route");
    if (routeIdx === -1) return null;
    const rest = parts.slice(routeIdx + 1);
    const idCandidate = rest[0] === "stats" ? rest[1] : rest[0];
    if (!idCandidate || !/^\d+$/.test(idCandidate)) return null;
    const slug = rest[rest.length - 1] || idCandidate;
    return {
      routeId: idCandidate,
      canonicalUrl: `${BASE}/route/${idCandidate}/${slug}`,
    };
  } catch {
    return null;
  }
}

export function statsUrlFor(routeId: string, canonicalUrl: string): string {
  const slug = canonicalUrl.split("/").pop() || routeId;
  return `${BASE}/route/stats/${routeId}/${slug}`;
}

function parseIntSafe(text: string | undefined | null): number {
  if (!text) return 0;
  const m = text.replace(/,/g, "").match(/-?\d+/);
  return m ? parseInt(m[0], 10) : 0;
}
function parseFloatSafe(text: string | undefined | null): number {
  if (!text) return 0;
  const m = text.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : 0;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    redirect: "follow",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  return res.text();
}

type PaginatedApi<T> = { total: number; data: T[]; last_page?: number };

async function fetchJson<T>(url: string): Promise<PaginatedApi<T>> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API ${res.status} for ${url}`);
  return res.json();
}

function jsonLdBlocks(html: string): unknown[] {
  const matches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  const out: unknown[] = [];
  for (const m of matches) {
    try {
      out.push(JSON.parse(m[1]));
    } catch {
      // ignore malformed blocks
    }
  }
  return out;
}

function findAggregateRating(blocks: unknown[]): { rating: number; votes: number } {
  for (const obj of blocks) {
    const agg = (obj as { aggregateRating?: { ratingValue?: unknown; reviewCount?: unknown; ratingCount?: unknown } })
      ?.aggregateRating;
    if (agg?.ratingValue) {
      return {
        rating: parseFloatSafe(String(agg.ratingValue)),
        votes: parseIntSafe(String(agg.reviewCount ?? agg.ratingCount)),
      };
    }
  }
  return { rating: 0, votes: 0 };
}

function findBreadcrumb(blocks: unknown[]): string {
  type Item = { "@type"?: string; position?: number; name?: string };
  type List = { "@type"?: string; itemListElement?: Item[] };
  for (const obj of blocks) {
    const o = obj as List;
    if (o["@type"] === "BreadcrumbList" && Array.isArray(o.itemListElement)) {
      const names = o.itemListElement
        .slice()
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((i) => i.name)
        .filter((n): n is string => typeof n === "string" && n.toLowerCase() !== "all locations");
      return names.slice(0, -1).join(" > ");
    }
  }
  return "";
}

type TickItem = {
  id: number;
  date?: string;
  style?: string;
  leadStyle?: string;
  pitches?: number;
  text?: string;
  comment?: string | null;
  user?: { id: number; name: string } | false | null;
};

type StarItem = {
  id: number;
  score: number;
  user?: { id: number; name: string } | false | null;
  createdAt?: string;
};

type RatingItem = {
  id: number;
  allRatings?: string[];
  user?: { id: number; name: string } | false | null;
  createdAt?: string;
};

type TodoItem = { id: number };

// Fetch every page of a paginated endpoint, gently. Cap at a sane number of pages.
async function fetchAllPages<T>(urlFor: (page: number) => string, maxPages = 50): Promise<T[]> {
  const out: T[] = [];
  let page = 1;
  while (page <= maxPages) {
    const res = await fetchJson<T>(urlFor(page));
    out.push(...res.data);
    if (!res.last_page || page >= res.last_page) break;
    page += 1;
    // Be polite — 200ms between page fetches.
    await new Promise((r) => setTimeout(r, 200));
  }
  return out;
}

function tickHistogram(ticks: TickItem[]): Array<{ date: string; count: number }> {
  // Group by yyyy-mm-dd. Tick.date looks like "Jun 14, 2026, 12:00 am".
  const buckets = new Map<string, number>();
  for (const t of ticks) {
    if (!t.date) continue;
    const d = new Date(t.date);
    if (isNaN(d.getTime())) continue;
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, count]) => ({ date, count }));
}

function parseOfficialGrade($: cheerio.CheerioAPI): string {
  // Header shows: <span class='rateYDS'>5.6 <a>...<span class="small">YDS</span>...</a></span>
  const ydsText = $(".rateYDS").first().text() || "";
  const m = ydsText.match(/5\.\d+[abcd+\-]?/i);
  return m ? m[0] : "";
}

function tickSnippet(t: TickItem): string {
  const text = (t.text || "").replace(/&middot;/g, "·").replace(/\s+/g, " ").trim();
  const style = [t.leadStyle, t.style].filter(Boolean).join(" / ");
  const parts: string[] = [];
  if (t.date) parts.push(t.date.split(",").slice(0, 2).join(",").trim());
  if (style) parts.push(style);
  // The API's "text" field often duplicates style + comment. Strip the leading "· Style. " prefix.
  const cleaned = text.replace(/^·\s*[A-Za-z/ ]+\.?\s*/, "").trim();
  if (cleaned) parts.push(cleaned);
  else if (t.comment) parts.push(t.comment);
  return parts.join(" — ").slice(0, 280);
}

export async function scrapeRoute(routeId: string, canonicalUrl: string): Promise<ScrapedRoute> {
  // Fetch everything in parallel where possible.
  const [html, ticksPage1, starsPage1, ratingsAll, todosPage1, commentsHtml] = await Promise.all([
    fetchHtml(canonicalUrl),
    fetchJson<TickItem>(`${BASE}/api/v2/routes/${routeId}/ticks?per_page=20&page=1`),
    fetchJson<StarItem>(`${BASE}/api/v2/routes/${routeId}/stars?per_page=20&page=1`),
    fetchAllPages<RatingItem>(
      (p) => `${BASE}/api/v2/routes/${routeId}/ratings?per_page=250&page=${p}`,
    ),
    fetchJson<TodoItem>(`${BASE}/api/v2/routes/${routeId}/todos?per_page=1&page=1`),
    fetchHtml(`${BASE}/comments/forObject/Climb-Lib-Models-Route/${routeId}?per_page=20&sortOrder=most_recent`),
  ]);

  // Now fetch ALL ticks (for the date histogram). Often the same first page; if more pages
  // exist, paginate. Reuses page 1's data so we don't double-fetch it.
  const allTicks: TickItem[] = [...ticksPage1.data];
  if ((ticksPage1.last_page ?? 1) > 1) {
    const rest = await fetchAllPages<TickItem>(
      (p) => `${BASE}/api/v2/routes/${routeId}/ticks?per_page=250&page=${p}`,
    );
    allTicks.splice(0, allTicks.length, ...rest);
  }

  const $ = cheerio.load(html);

  const name = ($("h1").first().text() || "").trim().replace(/\s+/g, " ");
  const ldBlocks = jsonLdBlocks(html);
  const location = findBreadcrumb(ldBlocks);
  const { rating: starRating, votes: ldVotes } = findAggregateRating(ldBlocks);
  const starVotes = starsPage1.total || ldVotes;
  const grade = parseOfficialGrade($);

  // Page Views
  let pageViews = 0;
  $("td").each((_, td) => {
    if ($(td).text().trim().toLowerCase().startsWith("page views")) {
      pageViews = parseIntSafe($(td).next("td").text());
    }
  });

  // Comment count
  let commentCount = parseIntSafe($("h2.comment-count").first().text());
  if (!commentCount) {
    const m = html.match(/initializeComments\(\s*(?:false|true)\s*,\s*(\d+)\s*\)/);
    if (m) commentCount = parseInt(m[1], 10);
  }

  const tickCount = ticksPage1.total;
  const todoCount = todosPage1.total;

  // Consensus suggested grade — mode of allRatings[0] across all rating records.
  const allSuggested = ratingsAll
    .flatMap((r) => r.allRatings ?? [])
    .filter((g): g is string => typeof g === "string" && g.length > 0);
  const suggestedGrade = mode(allSuggested) ?? "";
  const suggestedGradeNumeric = gradeToNumeric(suggestedGrade);
  const ratingCount = ratingsAll.length;

  // Date histogram of every tick ever.
  const tickHistory = tickHistogram(allTicks);

  // Samples for "new since last scrape" emails. All use stable MP IDs.
  const tickSamples: Sample[] = ticksPage1.data.map((t) => ({
    fingerprint: `mp-tick-${t.id}`,
    author: t.user && typeof t.user === "object" ? t.user.name : "Anonymous",
    snippet: tickSnippet(t),
  }));

  const starSamples: Sample[] = starsPage1.data.map((s) => ({
    fingerprint: `mp-star-${s.id}`,
    author: s.user && typeof s.user === "object" ? s.user.name : "Anonymous",
    snippet: `${s.score} star${s.score === 1 ? "" : "s"}`,
  }));

  const ratingSamples: Sample[] = ratingsAll.slice(0, 20).map((r) => ({
    fingerprint: `mp-rating-${r.id}`,
    author: r.user && typeof r.user === "object" ? r.user.name : "Anonymous",
    snippet: (r.allRatings ?? []).join(", "),
  }));

  // Comments — HTML, but every <table id="Comment-N"> is stable.
  const $c = cheerio.load(commentsHtml);
  const commentSamples: Sample[] = [];
  $c("[id^='Comment-']").each((_, el) => {
    if (commentSamples.length >= 20) return;
    const id = $c(el).attr("id");
    if (!id) return;
    const author = $c(el).find("a[href*='/user/']").first().text().trim();
    const body =
      $c(el).find(".comment-body, .max-height-md").text().replace(/\s+/g, " ").trim() ||
      $c(el).text().replace(/\s+/g, " ").trim();
    commentSamples.push({
      fingerprint: `mp-${id}`,
      author,
      snippet: body.slice(0, 280),
    });
  });

  return {
    routeId,
    name,
    location,
    url: canonicalUrl,
    grade,
    tickCount,
    commentCount,
    starRating,
    starVotes,
    pageViews,
    todoCount,
    suggestedGrade,
    suggestedGradeNumeric,
    ratingCount,
    tickHistory,
    commentSamples,
    tickSamples,
    starSamples,
    ratingSamples,
  };
}
