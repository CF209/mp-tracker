import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

// Lazy-init so importing this module during `next build` (when env vars may not be set)
// doesn't crash. We only require DATABASE_URL when something actually queries.
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!_db) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
    const sql = neon(process.env.DATABASE_URL);
    _db = drizzle(sql, { schema });
  }
  return _db;
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_t, prop) {
    return Reflect.get(getDb(), prop);
  },
});
