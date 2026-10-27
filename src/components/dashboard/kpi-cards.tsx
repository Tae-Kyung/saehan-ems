"use client";

import { formatDuration } from "@/lib/format";

interface Props {
  totalIdleMinutes: number;
  totalStopMinutes: number;
  badCount: number;
  analyzedCount: number;
  goodCount: number;
}

export function KpiCards({ totalIdleMinutes, totalStopMinutes, badCount, analyzedCount, goodCount }: Props) {
  const totalLostHours = ((totalIdleMinutes + totalStopMinutes) / 60);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
      <div className="rounded-xl border bg-card p-4">
        <div className="text-sm font-bold text-muted-foreground">비가동 + 완전정지</div>
        <div className="text-3xl font-extrabold tracking-tight mt-1">
          {totalLostHours.toFixed(1)}<span className="text-lg font-bold text-muted-foreground ml-1">시간</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-400 mr-1 align-middle" />
          비가동 {formatDuration(totalIdleMinutes)}
          <span className="mx-1">·</span>
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-400 mr-1 align-middle" />
          정지 {formatDuration(totalStopMinutes)}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="text-sm font-bold text-muted-foreground">못 만든 수량 (추정)</div>
        <div className="text-3xl font-extrabold tracking-tight mt-1 text-muted-foreground">
          —
        </div>
        <div className="text-xs text-muted-foreground mt-1">MOLD 파일을 올리면 표시</div>
      </div>

      <div className={`rounded-xl border p-4 ${badCount > 0 ? "bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-800" : "bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-800"}`}>
        <div className="text-sm font-bold text-muted-foreground">점검 필요 설비</div>
        <div className={`text-3xl font-extrabold tracking-tight mt-1 ${badCount > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
          {badCount}<span className="text-lg font-bold text-muted-foreground ml-1">/ {analyzedCount}대</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          가동율 80% 미만 · 양호(95%↑) {goodCount}대
        </div>
      </div>
    </div>
  );
}
