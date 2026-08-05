"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";

const tooltipStyle = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "8px",
  fontSize: 12,
} as const;

export function BucketBarChart({
  data,
  color = "#6C83FF",
  xKey = "range",
}: {
  data: Record<string, string | number>[];
  color?: string;
  xKey?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TurnoverByDeptChart({
  data,
}: {
  data: { name: string; departures: number; rate: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} />
        <YAxis tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} unit="%" />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${v}%`} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="rate" fill="#F87171" radius={[4, 4, 0, 0]} name="Turnover %" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function EngagementTrendChart({
  data,
}: {
  data: { name: string; avgMood: number; participation: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="name" tick={{ fontSize: 9, fill: "var(--color-text-muted)" }} />
        <YAxis yAxisId="mood" domain={[0, 5]} tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
        <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line yAxisId="mood" type="monotone" dataKey="avgMood" stroke="#6C83FF" strokeWidth={2} dot={{ r: 4 }} name="Avg mood (1-5)" />
        <Line yAxisId="pct" type="monotone" dataKey="participation" stroke="#34D399" strokeWidth={2} dot={{ r: 4 }} name="Participation %" />
      </LineChart>
    </ResponsiveContainer>
  );
}
