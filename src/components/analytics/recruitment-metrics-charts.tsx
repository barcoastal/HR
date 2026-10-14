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
  LabelList,
} from "recharts";

const tooltipStyle = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "8px",
  fontSize: 12,
};
const tick = { fontSize: 11, fill: "var(--color-text-muted)" };

export function FunnelBarChart({ data }: { data: { label: string; count: number; conversionFromPrevious: number | null }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={tick} />
        <YAxis type="category" dataKey="label" width={90} tick={tick} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-border)", opacity: 0.3 }} />
        <Bar dataKey="count" name="Candidates" fill="#6C83FF" radius={[0, 4, 4, 0]}>
          <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: "var(--color-text-primary)" }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ApplicantsHiresChart({ data }: { data: { label: string; applicants: number; hires: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="label" tick={{ ...tick, fontSize: 10 }} minTickGap={12} />
        <YAxis allowDecimals={false} tick={tick} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="applicants" stroke="#6C83FF" strokeWidth={2} dot={{ r: 3 }} name="Applicants" />
        <Line type="monotone" dataKey="hires" stroke="#34D399" strokeWidth={2} dot={{ r: 3 }} name="Hires" />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function RejectionReasonsChart({ data }: { data: { label: string; count: number }[] }) {
  const rows = data.filter((r) => r.count > 0);
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, rows.length * 32 + 30)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={tick} />
        <YAxis type="category" dataKey="label" width={150} tick={tick} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-border)", opacity: 0.3 }} />
        <Bar dataKey="count" name="Rejections" fill="#F87171" radius={[0, 4, 4, 0]}>
          <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: "var(--color-text-primary)" }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
