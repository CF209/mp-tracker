# MP Tracker

A personal Mountain Project route tracker. Paste an MP route URL, and it scrapes
ticks, comments, star rating, suggested grade, to-do count, and page views on a
daily schedule, stores time-series snapshots, emails you when anything new shows
up, and renders sortable trends.

## What it tracks (per route)

- **Route name + location** (last 3 areas in the breadcrumb; full path in tooltip)
- **Official grade** (e.g. `5.9`)
- **Suggested-grade consensus** + count of grade suggestions (e.g. `5.9 (29)`)
- **Tick count** (and a per-tick-date histogram, so trend graphs start with years of
  data instead of waiting for daily scrapes to accumulate)
- **To-do list count**
- **Comment count**
- **Star rating + vote count** (e.g. `2.9 (44)`)
- **Page views**

## The email digest

Sent once per scrape that finds new activity. Per route, it includes:

- Direct links to the **route page** and **stats page** on Mountain Project
- Counts: new ticks, comments, star ratings, grade suggestions, to-do adds
- Inline samples for each: the climber's name and the actual tick text /
  comment / grade suggestion / star score

## Stack

- **Next.js (App Router)** deployed on **Vercel**
- **Neon Postgres** + **Drizzle ORM** for storage
- **Vercel Cron** runs the scraper once a day (13:00 UTC by default ≈ 6 AM Pacific)
- **Resend** for the activity email
- **Recharts** for trend graphs

## Data sources

The scraper uses Mountain Project's **public JSON endpoints** wherever possible
(no auth required, stable item IDs for dedup):

- `GET /api/v2/routes/{id}/ticks` — tick total + per-tick metadata
- `GET /api/v2/routes/{id}/stars` — star vote total + individual votes
- `GET /api/v2/routes/{id}/ratings` — suggested grades (used for consensus)
- `GET /api/v2/routes/{id}/todos` — to-do list count

For things not exposed via API (name, location, official grade, page views,
comment count) it falls back to parsing the route page HTML. The official grade
comes from the `.rateYDS` element; location uses the JSON-LD `BreadcrumbList`;
star rating average uses the JSON-LD `aggregateRating`.

## Setup

### 1. Install

```bash
npm install
```

### 2. Provision a Neon database

Create a Neon project at https://neon.tech, copy the connection string into
`.env.local`:

```bash
cp .env.example .env.local
# Edit .env.local
```

Push the initial schema (this uses Drizzle Kit; for additive changes the SQL
in `scripts/migrate-add-columns.ts` is run directly):

```bash
npm run db:push
```

If `db:push` prompts about column renames you've already applied, run the
direct SQL migration instead:

```bash
npx tsx --env-file=.env.local scripts/migrate-add-columns.ts
```

### 3. Resend (email notifications)

- Create a Resend account.
- Put the API key in `RESEND_API_KEY`.
- Set `NOTIFY_EMAIL` to your inbox.
- Set `NOTIFY_FROM` either to a verified-domain sender, or to
  `onboarding@resend.dev` (only delivers to the email you signed up with —
  fine for personal use).

### 4. Local dev

```bash
npm run dev
# open http://localhost:3000
```

Paste any MP route URL like
`https://www.mountainproject.com/route/201171367/i-cant-believe-its-not-butte-r`
into the form. It scrapes immediately, stores the first snapshot, and shows
up in the table.

### 5. Deploy to Vercel

```bash
npx vercel
```

Set the same env vars in the Vercel dashboard (Project → Settings →
Environment Variables) for Production. Generate a long random string for
`CRON_SECRET` — Vercel Cron will send it automatically as a `Bearer` token,
and we reject requests without it:

```bash
openssl rand -hex 32
```

The cron is declared in `vercel.json` and runs at **13:00 UTC daily**. Change
the schedule string there if you want different timing.

You can force a scrape any time:

```bash
curl "https://your-app.vercel.app/api/cron/scrape?secret=YOUR_CRON_SECRET"
```

Note: Vercel's Hobby plan limits cron jobs to once-per-day max. For more
frequent runs you'd need Pro.

### 6. (Optional) Lock down access

By default the URL is public. To keep it private: Vercel dashboard → Project
→ Settings → Deployment Protection → **Vercel Authentication**. That gates
the whole site behind your Vercel login — no auth code needed.

## How it tracks "new" comments, ticks, stars, and grade suggestions

Every item from the public API has a stable MP ID. We store a fingerprint
(`mp-tick-{id}`, `mp-star-{id}`, etc.) in a `seen_*` table per route, and
anything whose fingerprint isn't there yet gets flagged as "new" and quoted
in the digest email. Comments are parsed from HTML but each `<table id="Comment-N">`
also has a stable ID, so the same scheme works.

This means deltas are exact, not heuristic — if 50 new ticks land in a day,
all 50 are detected as new (though only the first ~20 from the API's recent
page get inline samples in the email; the rest are summarized as "50 new ticks").

## Files of note

- `lib/scraper.ts` — fetches the route HTML + the four JSON APIs, returns one
  unified `ScrapedRoute`.
- `lib/grade.ts` — YDS-grade-to-numeric conversion (for plotting + sorting).
- `lib/scrape-runner.ts` — per-route scrape → snapshot → diff → email digest.
- `lib/notify.ts` — Resend email rendering.
- `app/api/cron/scrape/route.ts` — the cron handler.
- `app/page.tsx` + `components/routes-table.tsx` — main UI: sortable table,
  expandable rows, charts.
- `scripts/migrate-add-columns.ts` — direct-SQL migration script for the
  additive schema changes that `db:push` finds ambiguous.

## Caveats

- The HTML scraper relies on MP's current markup. The JSON APIs are more
  stable, but if MP changes the route page structure, the grade / page views /
  comment-count parsing in `lib/scraper.ts` will need updating.
- Be polite to MP's servers. The default once-daily cadence is fine. Don't
  crank this up to every minute.
- This is single-user. There's no auth model — see step 6 above.
