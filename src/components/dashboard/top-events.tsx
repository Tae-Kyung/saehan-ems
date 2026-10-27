"use client";

import { Badge } from "@/components/ui/badge";
import { minuteToTime, formatDuration } from "@/lib/format";

interface Tag {
  k: string;
  t: string;
  h: string;
}

interface EventItem {
  id: number;
  code: string;
  factory: string;
  state: string;
  startMinute: number;
  endMinute: number;
  duration: number;
  tags: Tag[] | null;
  cause: string | null;
}

interface Props {
  events: EventItem[];
}

export function TopEvents({ events }: Props) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="font-bold text-base mb-1">
        먼저 확인할 구간 TOP 5
        <span className="font-normal text-muted-foreground text-xs ml-2">가장 길게 멈춘 순</span>
      </h3>
      {events.length === 0 ? (
        <div className="py-6 text-center text-green-600 dark:text-green-400 font-bold text-lg">
          ✔ 정지·비가동 구간이 없습니다.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-2 px-2 font-semibold">설비</th>
                  <th className="text-left py-2 px-2 font-semibold">시각</th>
                  <th className="text-right py-2 px-2 font-semibold">지속</th>
                  <th className="text-left py-2 px-2 font-semibold">상태</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id} className="border-b last:border-0 hover:bg-accent/50">
                    <td className="py-2 px-2 font-bold">{ev.code}</td>
                    <td className="py-2 px-2 text-muted-foreground">
                      {minuteToTime(ev.startMinute)}
                      {ev.startMinute >= 1020 && <span className="text-xs">(익일)</span>}
                      {" ~ "}
                      {minuteToTime(ev.endMinute)}
                      {ev.endMinute >= 1020 && <span className="text-xs">(익일)</span>}
                    </td>
                    <td className="py-2 px-2 text-right font-bold">{formatDuration(ev.duration)}</td>
                    <td className="py-2 px-2">
                      <Badge variant={ev.state === "stop" ? "destructive" : "secondary"} className="text-xs">
                        {ev.state === "stop" ? "■ 완전정지" : "▲ 비가동"}
                      </Badge>
                      {ev.tags && ev.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {ev.tags
                            .filter((t: Tag) => t.k !== "long" && t.k !== "shift")
                            .slice(0, 2)
                            .map((t: Tag, i: number) => (
                              <span
                                key={i}
                                className="inline-block px-2 py-0.5 rounded text-[11px] border border-muted-foreground/30 text-muted-foreground"
                                title={t.h}
                              >
                                {t.t}
                              </span>
                            ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            전체 구간은 엑셀 보고서의 &lsquo;비가동_구간상세&rsquo; 시트에서 확인할 수 있습니다.
          </p>
        </>
      )}
    </div>
  );
}
