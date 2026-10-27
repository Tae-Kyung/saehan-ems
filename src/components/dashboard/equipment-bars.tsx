"use client";

import Link from "next/link";
import { formatPercent, formatDuration } from "@/lib/format";

interface EquipmentItem {
  code: string;
  factory: string;
  runMinutes: number;
  idleMinutes: number;
  stopMinutes: number;
  utilizationRate: number;
}

interface Props {
  equipment: EquipmentItem[];
}

function statusStyle(rate: number) {
  if (rate >= 0.95) return { icon: "✔", cls: "text-green-600 dark:text-green-400" };
  if (rate >= 0.80) return { icon: "▲", cls: "text-amber-600 dark:text-amber-400" };
  return { icon: "✖", cls: "text-red-600 dark:text-red-400" };
}

export function EquipmentBars({ equipment }: Props) {
  const sorted = [...equipment].sort((a, b) => a.utilizationRate - b.utilizationRate);
  const twoCol = sorted.length > 12;

  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="font-bold text-base mb-1">
        설비별 가동 구성
        <span className="font-normal text-muted-foreground text-xs ml-2">가동율 낮은 순</span>
      </h3>
      <div className="flex gap-4 text-xs text-muted-foreground mb-3 flex-wrap">
        <span className="flex items-center gap-1.5">
          <i className="inline-block w-3.5 h-3.5 rounded-sm bg-blue-500" />정상가동
        </span>
        <span className="flex items-center gap-1.5">
          <i className="inline-block w-3.5 h-3.5 rounded-sm bg-amber-400" />비가동
        </span>
        <span className="flex items-center gap-1.5">
          <i className="inline-block w-3.5 h-3.5 rounded-sm bg-red-400" />완전정지
        </span>
      </div>
      <div className={`grid gap-1.5 ${twoCol ? "grid-cols-2" : "grid-cols-1"}`}>
        {sorted.map((eq) => {
          const total = eq.runMinutes + eq.idleMinutes + eq.stopMinutes;
          const pRun = total > 0 ? (eq.runMinutes / total) * 100 : 0;
          const pIdle = total > 0 ? (eq.idleMinutes / total) * 100 : 0;
          const pStop = total > 0 ? (eq.stopMinutes / total) * 100 : 0;
          const st = statusStyle(eq.utilizationRate);
          return (
            <Link
              href={`/equipment/${eq.code}`}
              key={eq.code}
              className="grid items-center gap-2 rounded-md hover:bg-accent/50 px-1 py-0.5 no-underline text-inherit"
              style={{ gridTemplateColumns: "70px 1fr 65px" }}
              title={`${eq.code} 가동율 ${formatPercent(eq.utilizationRate)}\n정상 ${formatDuration(eq.runMinutes)} · 비가동 ${formatDuration(eq.idleMinutes)} · 정지 ${formatDuration(eq.stopMinutes)}`}
            >
              <span className="font-bold text-sm truncate">{eq.code}</span>
              <div className="flex gap-0.5 h-5 bg-muted rounded-md overflow-hidden">
                {pRun > 0 && <div className="bg-blue-500 rounded-l-md" style={{ width: `${pRun}%` }} />}
                {pIdle > 0 && <div className="bg-amber-400" style={{ width: `${pIdle}%` }} />}
                {pStop > 0 && <div className="bg-red-400 rounded-r-md" style={{ width: `${pStop}%` }} />}
              </div>
              <span className={`text-right text-sm font-extrabold ${st.cls}`}>
                <span className="mr-0.5">{st.icon}</span>
                {formatPercent(eq.utilizationRate, 0)}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
