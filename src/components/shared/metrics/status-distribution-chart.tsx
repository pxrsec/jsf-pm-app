"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface StatusChartDataPoint {
  statusKey: string;
  label: string;
  count: number;
  color: string;
}

interface StatusDistributionChartProps {
  data: readonly StatusChartDataPoint[];
  yAxisLabel?: string;
}

export function StatusDistributionChart({
  data,
  yAxisLabel,
}: StatusDistributionChartProps) {
  const chartData = data.map((d) => ({
    name: d.label,
    count: d.count,
    color: d.color,
  }));

  return (
    <div className="w-full h-[220px] pt-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
        >
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "currentColor" }}
            interval={0}
            angle={-25}
            textAnchor="end"
            height={40}
            className="text-muted-foreground"
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "currentColor" }}
            className="text-muted-foreground"
          />
          <Tooltip
            formatter={(value) => [
              value !== undefined ? String(value) : "0",
              yAxisLabel ?? "Total",
            ]}
            contentStyle={{
              backgroundColor: "var(--color-card, #fff)",
              borderColor: "var(--color-border, #e5e7eb)",
              borderRadius: "0.5rem",
              fontSize: "0.75rem",
              color: "var(--color-foreground, #000)",
            }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
