"use client";

import { useMemo, useState } from "react";
import TrendChart from "./trend-chart";
import { deleteRoute } from "@/app/actions";

export type RouteWithHistory = {
  id: string;
  name: string;
  location: string;
  url: string;
  statsUrl: string;
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
  lastScrapedAt: Date | null;
  history: Array<{
    capturedAt: string;
    tickCount: number;
    commentCount: number;
    starRating: number;
    pageViews: number;
    todoCount: number;
    suggestedGradeNumeric: number;
    suggestedGrade: string;
    ratingCount: number;
  }>;
};

type SortKey =
  | "name"
  | "location"
  | "grade"
  | "tickCount"
  | "commentCount"
  | "starRating"
  | "pageViews"
  | "todoCount";
type SortDir = "asc" | "desc";

const columns: Array<{ key: SortKey; label: string; numeric?: boolean }> = [
  { key: "name", label: "Route" },
  { key: "location", label: "Location" },
  { key: "grade", label: "Grade" },
  { key: "tickCount", label: "Ticks", numeric: true },
  { key: "todoCount", label: "To-do", numeric: true },
  { key: "commentCount", label: "Comments", numeric: true },
  { key: "starRating", label: "Stars", numeric: true },
  { key: "pageViews", label: "Page views", numeric: true },
];

export default function RoutesTable({ rows }: { rows: RouteWithHistory[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      // Special case: sort the grade column by its numeric value, not lexicographically.
      if (sortKey === "grade") {
        const cmp = numericFromGrade(a.grade) - numericFromGrade(b.grade);
        return sortDir === "asc" ? cmp : -cmp;
      }
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp: number;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "name" || key === "location" ? "asc" : "desc");
    }
  }

  const lastScrape = rows
    .map((r) => r.lastScrapedAt)
    .filter((d): d is Date => d != null)
    .sort((a, b) => +b - +a)[0];

  return (
    <>
      <table className="routes">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                onClick={() => toggleSort(c.key)}
                style={{ textAlign: c.numeric ? "right" : "left" }}
              >
                {c.label}
                {sortKey === c.key && <span className="sort-indicator">{sortDir === "asc" ? "▲" : "▼"}</span>}
              </th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const expanded = expandedId === r.id;
            return (
              <RouteRow
                key={r.id}
                route={r}
                expanded={expanded}
                onToggle={() => setExpandedId(expanded ? null : r.id)}
                colSpan={columns.length + 1}
              />
            );
          })}
        </tbody>
      </table>
      {lastScrape && (
        <div className="last-updated">Last scrape: {new Date(lastScrape).toLocaleString()}</div>
      )}
    </>
  );
}

function RouteRow({
  route,
  expanded,
  onToggle,
  colSpan,
}: {
  route: RouteWithHistory;
  expanded: boolean;
  onToggle: () => void;
  colSpan: number;
}) {
  return (
    <>
      <tr className={`row ${expanded ? "expanded" : ""}`} onClick={onToggle}>
        <td>{route.name || "(unnamed)"}</td>
        <td className="muted" title={route.location}>{shortLocation(route.location)}</td>
        <td style={{ whiteSpace: "nowrap" }}>
          {route.grade || "—"}
          {route.ratingCount > 0 && (
            <span className="muted"> ({route.ratingCount})</span>
          )}
        </td>
        <td style={{ textAlign: "right" }}>{route.tickCount.toLocaleString()}</td>
        <td style={{ textAlign: "right" }}>{route.todoCount.toLocaleString()}</td>
        <td style={{ textAlign: "right" }}>{route.commentCount.toLocaleString()}</td>
        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
          {route.starRating.toFixed(1)} <span className="muted">({route.starVotes})</span>
        </td>
        <td style={{ textAlign: "right" }}>{route.pageViews.toLocaleString()}</td>
        <td style={{ textAlign: "right" }}>
          <button
            className="delete-btn"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Unsubscribe from "${route.name}"?`)) deleteRoute(route.id);
            }}
            title="Unsubscribe"
          >
            ×
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={colSpan} style={{ padding: 0 }}>
            <ExpandedPanel route={route} />
          </td>
        </tr>
      )}
    </>
  );
}

function ExpandedPanel({ route }: { route: RouteWithHistory }) {
  // Cumulative ticks by actual tick date (from MP's full tick history, not just our scrapes).
  const ticksOverTime = useMemo(() => {
    let running = 0;
    return route.tickHistory.map((h) => {
      running += h.count;
      return { capturedAt: `${h.date}T00:00:00Z`, value: running };
    });
  }, [route.tickHistory]);

  const stars = route.history.map((h) => ({ capturedAt: h.capturedAt, value: h.starRating }));
  const views = route.history.map((h) => ({ capturedAt: h.capturedAt, value: h.pageViews }));
  const todos = route.history.map((h) => ({ capturedAt: h.capturedAt, value: h.todoCount }));
  const comments = route.history.map((h) => ({ capturedAt: h.capturedAt, value: h.commentCount }));
  const grade = route.history
    .filter((h) => h.suggestedGradeNumeric > 0)
    .map((h) => ({ capturedAt: h.capturedAt, value: h.suggestedGradeNumeric }));

  return (
    <div className="expanded-content">
      <div className="expanded-links" style={{ marginBottom: 16 }}>
        <a href={route.url} target="_blank" rel="noreferrer">
          Open on Mountain Project ↗
        </a>
        <a href={route.statsUrl} target="_blank" rel="noreferrer">
          Open route stats page ↗
        </a>
      </div>
      <div className="expanded-grid">
        <ChartCard
          title="Ticks over time (by tick date)"
          data={ticksOverTime}
          yLabel="Cumulative ticks"
          color="#ff7a45"
          forceShow
        />
        <ChartCard
          title="Grade over time"
          data={grade}
          yLabel="Grade"
          color="#ffaa5c"
          valueFormatter={(v) => formatGradeNumeric(v)}
        />
        <ChartCard
          title="Star rating over time"
          data={stars}
          yLabel="Stars"
          color="#ffd166"
          domain={[0, 4]}
        />
        <ChartCard title="Comments over time" data={comments} yLabel="Comments" color="#4cc9f0" />
        <ChartCard title="To-do list adds over time" data={todos} yLabel="To-do" color="#b388eb" />
        <ChartCard title="Page views over time" data={views} yLabel="Views" color="#a3d977" />
      </div>
    </div>
  );
}

function ChartCard({
  title,
  data,
  yLabel,
  color,
  domain,
  forceShow,
  valueFormatter,
}: {
  title: string;
  data: Array<{ capturedAt: string; value: number }>;
  yLabel: string;
  color: string;
  domain?: [number, number];
  forceShow?: boolean;
  valueFormatter?: (v: number) => string;
}) {
  return (
    <div className="chart-card">
      <h4 className="chart-title">{title}</h4>
      {!forceShow && data.length < 2 ? (
        <div className="muted" style={{ padding: 24, textAlign: "center", fontSize: 12 }}>
          Need at least 2 scrapes for a trend. Check back tomorrow.
        </div>
      ) : data.length === 0 ? (
        <div className="muted" style={{ padding: 24, textAlign: "center", fontSize: 12 }}>
          No data yet.
        </div>
      ) : (
        <TrendChart
          data={data}
          yLabel={yLabel}
          color={color}
          domain={domain}
          valueFormatter={valueFormatter}
        />
      )}
    </div>
  );
}

function shortLocation(loc: string): string {
  if (!loc) return "—";
  const parts = loc.split(" > ").filter(Boolean);
  return parts.slice(-3).join(" > ");
}

function numericFromGrade(g: string): number {
  // Mirror lib/grade.ts here so this client component doesn't import server-side modules.
  if (!g) return 0;
  const m = g.match(/^5\.(\d+)\s*([abcd])?\s*([+-])?$/i);
  if (!m) return 0;
  const tens = parseInt(m[1], 10);
  let frac = 0;
  const letter = (m[2] || "").toLowerCase();
  if (letter === "a") frac = 0;
  else if (letter === "b") frac = 0.25;
  else if (letter === "c") frac = 0.5;
  else if (letter === "d") frac = 0.75;
  else if (m[3] === "+") frac = 0.75;
  return 5 + tens / 100 + frac / 100;
}

function formatGradeNumeric(v: number): string {
  if (v <= 0) return "—";
  const tens = Math.round((v - 5) * 100) % 100;
  const intTens = Math.floor((v - 5) * 100);
  const frac = (v - 5) * 100 - intTens;
  const letterIdx = Math.round(frac * 4);
  const letters = ["a", "b", "c", "d"];
  const letter = tens >= 10 ? letters[letterIdx] ?? "" : "";
  return `5.${intTens}${letter}`;
}
