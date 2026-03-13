"use client";

import { Bar, BarChart, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface DeviceData {
  device: string;
  spend: number;
  impressions: number;
  clicks: number;
  cv: number;
  cpa: number;
  ctr: number;
}

const COLORS = ["#2C5282", "#38A169", "#D69E2E", "#E53E3E", "#805AD5"];

function formatCurrency(value: number): string {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

export default function DeviceBreakdown({ data }: { data: DeviceData[] }) {
  if (data.length === 0) {
    return (
      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-[#1a365d]">デバイス別分析</h3>
        <p className="mt-6 text-sm text-gray-500">データがありません</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-[#1a365d]">デバイス別分析</h3>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="spend" nameKey="device" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {data.map((entry, index) => (
                  <Cell key={entry.device} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip formatter={(value: number | string | undefined) => [formatCurrency(Number(value) || 0), "費用"]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 12, right: 12 }}>
              <XAxis type="number" tick={{ fill: "#64748B", fontSize: 12 }} tickFormatter={(value) => formatCurrency(Number(value))} />
              <YAxis type="category" dataKey="device" width={90} tick={{ fill: "#64748B", fontSize: 12 }} />
              <Tooltip formatter={(value: number | string | undefined) => [formatCurrency(Number(value) || 0), "CPA"]} />
              <Bar dataKey="cpa" radius={[0, 6, 6, 0]} fill="#2C5282" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
