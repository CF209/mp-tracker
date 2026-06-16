import { db } from "../lib/db";
import { routes } from "../lib/schema";

async function main() {
  const all = await db.select().from(routes);
  for (const r of all) {
    console.log({
      name: r.name,
      grade: r.grade,
      suggestedGrade: r.suggestedGrade,
      suggestedGradeNumeric: r.suggestedGradeNumeric,
      todoCount: r.todoCount,
      tickHistoryLen: r.tickHistory.length,
      tickHistorySample: r.tickHistory.slice(0, 3),
    });
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
