"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type SpendVsHiresData = {
  month: string;
  spend: number;
  hires: number;
};

export function SpendVsHiresChart({ data }: { data: SpendVsHiresData[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
          tickFormatter={(v) => `$${v}`}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
        />
        <Tooltip
          contentStyle={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            fontSize: 12,
          }}
          formatter={((value: number, name: string) =>
            name === "Spend" ? [`$${value.toLocaleString()}`, name] : [value, name]
          ) as never}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar
          yAxisId="left"
          dataKey="spend"
          fill="#F87171"
          radius={[4, 4, 0, 0]}
          name="Spend"
          opacity={0.8}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="hires"
          stroke="#34D399"
          strokeWidth={2}
          dot={{ r: 4 }}
          name="Hires"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
