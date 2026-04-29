"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/**
 * @param {{ data: { label: string; value: number }[] }} props
 */
export default function MiniEarningsChart({ data }) {
  const safe = Array.isArray(data) && data.length ? data : [{ label: "—", value: 0 }];

  return (
    <div className="mt-3 h-[112px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={safe} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="earnFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(16, 185, 129)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 9 }} axisLine={false} tickLine={false} />
          <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
          <Tooltip
            contentStyle={{
              background: "rgba(15, 22, 41, 0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              fontSize: 12,
            }}
            labelStyle={{ color: "#9ca3af" }}
            formatter={(v) => [`$${Number(v).toFixed(2)}`, "Activity"]}
          />
          <Area type="monotone" dataKey="value" stroke="rgb(16, 185, 129)" strokeWidth={2} fill="url(#earnFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
