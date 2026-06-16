import { NextRequest, NextResponse } from "next/server";
import { runScrape } from "@/lib/scrape-runner";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  // Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` when CRON_SECRET is set.
  // We also accept the same secret in a `secret` query param for manual triggers.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    const query = req.nextUrl.searchParams.get("secret");
    if (auth !== `Bearer ${secret}` && query !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const result = await runScrape();
  return NextResponse.json(result);
}
