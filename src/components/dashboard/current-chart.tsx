"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { minuteToTime } from "@/lib/format";

interface Reading {
  time: string;
  value: number;
}

interface Props {
  readings: Reading[];
  idleThreshold?: number;
  stopThreshold?: number;
}

export function CurrentChart({ readings, idleThreshold, stopThreshold }: Props) {
  const data = readings.map((r, i) => ({
    minute: i,
    label: minuteToTime(i),
    value: r.value,
  }));

  const ticks = Array.from({ length: 25 }, (_, i) => i * 60);

  return (
    <div className="h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="minute"
            ticks={ticks}
            tickFormatter={(m) => minuteToTime(m)}
            tick={{ fontSize: 11 }}
            interval={0}
          />
          <YAxis tick={{ fontSize: 11 }} width={45} unit="A" />
          <Tooltip
            labelFormatter={(m) => minuteToTime(m as number)}
            formatter={(v) => [`${Number(v).toFixed(1)} A`, "전류"]}
          />
          {stopThreshold !== undefined && (
            <ReferenceLine y={stopThreshold} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "정지", position: "right", fontSize: 11 }} />
          )}
          {idleThreshold !== undefined && (
            <ReferenceLine y={idleThreshold} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "비가동", position: "right", fontSize: 11 }} />
          )}
          <Area
            type="monotone"
            dataKey="value"
            stroke="#3b82f6"
            fill="url(#colorCurrent)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
