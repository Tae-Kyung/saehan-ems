"use client";

import { formatPercent } from "@/lib/format";

interface Props {
  avgRate: number;
  status: "good" | "warn" | "bad";
  sentence: string;
  analyzedCount: number;
  excludedCount: number;
  dateLabel: string;
}

const STATUS_CONFIG = {
  good: { icon: "✔", label: "양호", bg: "bg-green-50 dark:bg-green-950", border: "border-green-600", text: "text-green-700 dark:text-green-400", chipBg: "bg-green-100 dark:bg-green-900" },
  warn: { icon: "▲", label: "주의", bg: "bg-amber-50 dark:bg-amber-950", border: "border-amber-500", text: "text-amber-700 dark:text-amber-400", chipBg: "bg-amber-100 dark:bg-amber-900" },
  bad:  { icon: "✖", label: "점검", bg: "bg-red-50 dark:bg-red-950", border: "border-red-500", text: "text-red-700 dark:text-red-400", chipBg: "bg-red-100 dark:bg-red-900" },
};

export function VerdictBanner({ avgRate, status, sentence, analyzedCount, excludedCount, dateLabel }: Props) {
  const cfg = STATUS_CONFIG[status];
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{dateLabel} 비가동 현황</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            분석 설비 {analyzedCount}대
            {excludedCount > 0 && ` · 미가동 ${excludedCount}대 제외`}
          </p>
        </div>
        <div className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-xl font-extrabold ${cfg.chipBg} ${cfg.text}`}>
          <span>{cfg.icon}</span>
          {cfg.label}
        </div>
      </div>
      <div className={`flex items-center gap-6 ${cfg.bg} border-l-8 ${cfg.border} rounded-xl px-6 py-4`}>
        <div className={`text-6xl font-extrabold tracking-tighter leading-none ${cfg.text}`}>
          {formatPercent(avgRate, 0)}
        </div>
        <div>
          <div className="text-sm font-bold text-muted-foreground">평균 가동율</div>
          <div className="text-lg font-semibold mt-0.5" dangerouslySetInnerHTML={{ __html: sentence }} />
        </div>
      </div>
    </div>
  );
}
