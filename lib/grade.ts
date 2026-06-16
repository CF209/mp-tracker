// Convert YDS-ish climbing grades to a sortable/plottable number.
//
// 5.0–5.9                     → 5.0–5.9
// 5.10                         → 5.10
// 5.10a / 5.10-                → 5.10 + 0.00
// 5.10b                        → 5.10 + 0.25
// 5.10c                        → 5.10 + 0.50
// 5.10d / 5.10+                → 5.10 + 0.75
//
// Bouldering V grades and aid grades are not standardized into this scale; we just return 0
// for non-YDS grades and let the UI show the label as-is.

const LETTER: Record<string, number> = { a: 0, b: 0.25, c: 0.5, d: 0.75 };

export function gradeToNumeric(grade: string): number {
  if (!grade) return 0;
  const g = grade.trim().toLowerCase();
  const m = g.match(/^5\.(\d+)\s*([abcd])?\s*([+-])?$/i);
  if (!m) return 0;
  const tens = parseInt(m[1], 10);
  let frac = 0;
  if (m[2]) frac = LETTER[m[2]] ?? 0;
  else if (m[3] === "+") frac = 0.75;
  else if (m[3] === "-") frac = 0;
  return 5 + tens / 100 + frac / 100;
}

export function mode<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  const counts = new Map<T, number>();
  for (const x of items) counts.set(x, (counts.get(x) ?? 0) + 1);
  let best: T | null = null;
  let bestN = 0;
  for (const [k, v] of counts) {
    if (v > bestN) {
      bestN = v;
      best = k;
    }
  }
  return best;
}
