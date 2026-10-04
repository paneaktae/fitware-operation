"use client";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
export default function TrendChart({
  data,
  metric = "spend",
}: {
  data: {
    date: string;
    spend: number;
    leads: number;
    revenue: number;
    qualified: number;
    cpl: number | null;
    roas: number | null;
  }[];
  metric?: "spend" | "leads" | "revenue" | "qualified" | "cpl" | "roas";
}) {
  return (
    <div
      className="chart"
      role="img"
      aria-label={`${metric} by day, with values available on hover`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 12, right: 12, bottom: 0, left: -20 }}
        >
          <defs>
            <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#538565" stopOpacity={0.24} />
              <stop offset="100%" stopColor="#538565" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 5"
            vertical={false}
            stroke="var(--border)"
          />
          <XAxis
            dataKey="date"
            tickFormatter={(v) => v.slice(5)}
            minTickGap={35}
            tickLine={false}
            axisLine={false}
            fontSize={11}
          />
          <YAxis tickLine={false} axisLine={false} fontSize={11} />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              color: "#172b22",
              border: "1px solid #ddd",
            }}
            formatter={(v) =>
              typeof v === "number"
                ? v.toLocaleString(undefined, { maximumFractionDigits: 1 })
                : v
            }
          />
          <Area
            type="monotone"
            dataKey={metric}
            stroke="#538565"
            strokeWidth={2.5}
            fill="url(#chartFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function ComparisonChart({
  data,
}: {
  data: { name: string; revenue: number; spend: number }[];
}) {
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 20 }}>
          <XAxis type="number" fontSize={11} />
          <YAxis type="category" dataKey="name" width={100} fontSize={11} />
          <Tooltip />
          <Bar dataKey="revenue" fill="#538565" radius={[0, 4, 4, 0]} />
          <Bar dataKey="spend" fill="#d2ab63" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
