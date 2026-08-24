"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface TrendChartProps {
  data: readonly {
    label: string;
    finalized: number;
    reviewCycles: number;
    completionCycles: number;
    reopenedCycles: number;
  }[];
  finalizedLabel: string;
  reviewCyclesLabel: string;
  completionCyclesLabel: string;
  reopenedCyclesLabel: string;
}

export function TrendChart({
  data,
  finalizedLabel,
  reviewCyclesLabel,
  completionCyclesLabel,
  reopenedCyclesLabel,
}: TrendChartProps) {
  return (
    <div className="w-full h-[280px] pt-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data as unknown as Record<string, unknown>[]}
          margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
        >
          <XAxis
            dataKey="label"
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
            contentStyle={{
              backgroundColor: "var(--color-card, #fff)",
              borderColor: "var(--color-border, #e5e7eb)",
              borderRadius: "0.5rem",
              fontSize: "0.75rem",
              color: "var(--color-foreground, #000)",
            }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            wrapperStyle={{ fontSize: "0.75rem", paddingBottom: "10px" }}
          />
          <Bar
            dataKey="finalized"
            name={finalizedLabel}
            fill="#10b981"
            radius={[3, 3, 0, 0]}
          />
          <Bar
            dataKey="reviewCycles"
            name={reviewCyclesLabel}
            fill="#8b5cf6"
            radius={[3, 3, 0, 0]}
          />
          <Bar
            dataKey="completionCycles"
            name={completionCyclesLabel}
            fill="#3b82f6"
            radius={[3, 3, 0, 0]}
          />
          <Bar
            dataKey="reopenedCycles"
            name={reopenedCyclesLabel}
            fill="#f43f5e"
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
