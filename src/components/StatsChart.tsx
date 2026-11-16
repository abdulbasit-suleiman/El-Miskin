"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { lastWeekKeys, weekLabel } from "@/lib/code-utils";

/** Bar chart of scans per week (last 8 weeks), from the product's weeklyScans map. */
export default function StatsChart({ weeklyScans }: { weeklyScans: Record<string, number> }) {
  const keys = lastWeekKeys(8);
  const data = keys.map((k) => ({
    week: weekLabel(k),
    scans: weeklyScans[k] ?? 0,
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="week" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value) => [`${value} scan(s)`, "Scans"]}
            labelFormatter={(label) => `Week ${label}`}
          />
          <Bar dataKey="scans" fill="#059669" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
