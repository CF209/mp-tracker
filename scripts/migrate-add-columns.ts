import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const sql = neon(process.env.DATABASE_URL);

async function run() {
  // routes: add new columns
  await sql`ALTER TABLE routes ADD COLUMN IF NOT EXISTS grade text NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE routes ADD COLUMN IF NOT EXISTS todo_count integer NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE routes ADD COLUMN IF NOT EXISTS suggested_grade text NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE routes ADD COLUMN IF NOT EXISTS suggested_grade_numeric real NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE routes ADD COLUMN IF NOT EXISTS tick_history jsonb NOT NULL DEFAULT '[]'::jsonb`;

  // snapshots: add new columns
  await sql`ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS todo_count integer NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS suggested_grade_numeric real NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS suggested_grade text NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE routes ADD COLUMN IF NOT EXISTS rating_count integer NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS rating_count integer NOT NULL DEFAULT 0`;

  // seen_ticks: rename climber → author if needed
  await sql`ALTER TABLE seen_ticks RENAME COLUMN climber TO author`.catch(() => {});

  // seen_stars, seen_ratings: create from scratch
  await sql`
    CREATE TABLE IF NOT EXISTS seen_stars (
      id serial PRIMARY KEY,
      route_id text NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
      fingerprint text NOT NULL,
      author text NOT NULL DEFAULT '',
      snippet text NOT NULL DEFAULT '',
      first_seen_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS seen_stars_route_fp_idx ON seen_stars (route_id, fingerprint)`;

  await sql`
    CREATE TABLE IF NOT EXISTS seen_ratings (
      id serial PRIMARY KEY,
      route_id text NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
      fingerprint text NOT NULL,
      author text NOT NULL DEFAULT '',
      snippet text NOT NULL DEFAULT '',
      first_seen_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS seen_ratings_route_fp_idx ON seen_ratings (route_id, fingerprint)`;

  console.log("Migration complete.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
