"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import type { PieLabelRenderProps } from "recharts";

function pieLabel(props: PieLabelRenderProps) {
  return `${props.name ?? ""}: ${props.value ?? 0}`;
}

const COLORS = ["#6C83FF", "#34D399", "#FBBF24", "#F87171", "#A78BFA", "#38BDF8", "#F472B6"];

export function DepartmentBarChart({ data }: { data: { name: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
        <YAxis tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
        <Tooltip
          contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: 12 }}
          labelStyle={{ color: "var(--color-text-primary)" }}
        />
        <Bar dataKey="count" fill="#6C83FF" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TenureBarChart({ data }: { data: { range: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="range" tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} />
        <YAxis tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
        <Tooltip contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: 12 }} />
        <Bar dataKey="count" fill="#34D399" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PipelinePieChart({ data }: { data: { status: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={90} label={pieLabel} labelLine={false} style={{ fontSize: 10 }}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TurnoverLineChart({ data }: { data: { month: string; departures: number; hires: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} />
        <YAxis tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
        <Tooltip contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="hires" stroke="#34D399" strokeWidth={2} dot={{ r: 4 }} name="Hires" />
        <Line type="monotone" dataKey="departures" stroke="#F87171" strokeWidth={2} dot={{ r: 4 }} name="Departures" />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function SourceROIChart({ data }: { data: { source: string; totalCandidates: number; hired: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="source" tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} />
        <YAxis tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
        <Tooltip contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="totalCandidates" fill="#6C83FF" radius={[4, 4, 0, 0]} name="Total" />
        <Bar dataKey="hired" fill="#34D399" radius={[4, 4, 0, 0]} name="Hired" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DietaryPieChart({ data }: { data: { type: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={90} label={pieLabel} labelLine={false} style={{ fontSize: 10 }}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
