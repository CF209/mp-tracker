"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type Point = { capturedAt: string; value: number };

export default function TrendChart({
  data,
  yLabel,
  color = "#ff7a45",
  domain,
  valueFormatter,
}: {
  data: Point[];
  yLabel: string;
  color?: string;
  domain?: [number, number];
  valueFormatter?: (v: number) => string;
}) {
  const points = data.map((d) => ({
    t: new Date(d.capturedAt).getTime(),
    v: d.value,
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#2a2f3d" strokeDasharray="3 3" />
        <XAxis
          dataKey="t"
          type="number"
          domain={["dataMin", "dataMax"]}
          scale="time"
          tickFormatter={(t) =>
            new Date(t).toLocaleDateString(undefined, { month: "short", year: "2-digit" })
          }
          stroke="#8a92a6"
          fontSize={11}
        />
        <YAxis
          stroke="#8a92a6"
          fontSize={11}
          domain={domain ?? ["auto", "auto"]}
          width={50}
          tickFormatter={valueFormatter}
        />
        <Tooltip
          contentStyle={{ background: "#161a22", border: "1px solid #2a2f3d", fontSize: 12 }}
          labelFormatter={(t) => new Date(t as number).toLocaleDateString()}
          formatter={(v) => [valueFormatter ? valueFormatter(v as number) : v, yLabel]}
        />
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
