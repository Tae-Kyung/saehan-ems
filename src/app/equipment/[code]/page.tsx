"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CurrentChart } from "@/components/dashboard/current-chart";
import { minuteToTime, formatDuration, formatPercent } from "@/lib/format";
import { CAUSES } from "@/lib/analysis/constants";
import Link from "next/link";

interface Tag { k: string; t: string; h: string }

interface EventItem {
  id: number;
  state: string;
  startMinute: number;
  endMinute: number;
  duration: number;
  avgCurrent: string;
  minCurrent: string;
  maxCurrent: string;
  tags: Tag[] | null;
  cause: string | null;
  memo: string | null;
  code: string;
  factory: string;
}

interface Reading { time: string; value: number }
interface EquipmentInfo { code: string; factory: string; group: string }
interface AnalysisInfo {
  runMinutes: number;
  idleMinutes: number;
  stopMinutes: number;
  utilizationRate: number;
}

export default function EquipmentDetailPage() {
  return (
    <Suspense fallback={<div className="text-center py-16 text-muted-foreground">불러오는 중...</div>}>
      <EquipmentDetailContent />
    </Suspense>
  );
}

function EquipmentDetailContent() {
  const { code } = useParams<{ code: string }>();
  const [date, setDate] = useState("2026-10-13");
  const [equipment, setEquipment] = useState<EquipmentInfo | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisInfo | null>(null);
  const [criteria, setCriteria] = useState<{ stop: number; idle: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [readRes, evRes, critRes, dashRes] = await Promise.all([
        fetch(`/api/equipment/${code}/readings?date=${date}`),
        fetch(`/api/events/${date}?equipment=${code}`),
        fetch("/api/criteria"),
        fetch(`/api/dashboard/${date}`),
      ]);

      const readJson = await readRes.json();
      if (readJson.data) {
        setEquipment(readJson.data.equipment);
        setReadings(readJson.data.readings);
      }

      const evJson = await evRes.json();
      setEvents(evJson.data || []);

      const critJson = await critRes.json();
      if (critJson.data && readJson.data) {
        const group = readJson.data.equipment.group;
        const crit = critJson.data.find((c: { group: string }) => c.group === group);
        if (crit) {
          setCriteria({ stop: parseFloat(crit.stopThreshold), idle: parseFloat(crit.idleThreshold) });
        }
      }

      const dashJson = await dashRes.json();
      if (dashJson.data) {
        const eq = dashJson.data.equipment.find((e: { code: string }) => e.code === code);
        if (eq) setAnalysis(eq);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [code, date]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateCause = async (eventId: number, cause: string) => {
    await fetch(`/api/events/update/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cause }),
    });
    setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, cause } : e)));
  };

  return (
    <div className="max-w-5xl mx-auto py-6 px-4">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Link href="/" className="text-sm text-muted-foreground hover:underline">&larr; 대시보드</Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-xl font-extrabold">{code}</h1>
        {equipment && (
          <span className="text-sm text-muted-foreground">{equipment.factory} · {equipment.group}</span>
        )}
        <div className="flex-1" />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm bg-background"
        />
      </div>

      {loading && <div className="text-center py-16 text-muted-foreground">불러오는 중...</div>}

      {!loading && analysis && (
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="rounded-xl border bg-card p-3 text-center">
            <div className="text-xs text-muted-foreground font-semibold">가동율</div>
            <div className="text-2xl font-extrabold mt-1">{formatPercent(analysis.utilizationRate)}</div>
          </div>
          <div className="rounded-xl border bg-card p-3 text-center">
            <div className="text-xs text-muted-foreground font-semibold">정상가동</div>
            <div className="text-2xl font-extrabold text-blue-600 mt-1">{formatDuration(analysis.runMinutes)}</div>
          </div>
          <div className="rounded-xl border bg-card p-3 text-center">
            <div className="text-xs text-muted-foreground font-semibold">비가동</div>
            <div className="text-2xl font-extrabold text-amber-600 mt-1">{formatDuration(analysis.idleMinutes)}</div>
          </div>
          <div className="rounded-xl border bg-card p-3 text-center">
            <div className="text-xs text-muted-foreground font-semibold">완전정지</div>
            <div className="text-2xl font-extrabold text-red-600 mt-1">{formatDuration(analysis.stopMinutes)}</div>
          </div>
        </div>
      )}

      {!loading && readings.length > 0 && (
        <div className="rounded-xl border bg-card p-4 mb-4">
          <h3 className="font-bold text-base mb-2">전류 그래프 (1분 단위)</h3>
          <CurrentChart
            readings={readings}
            stopThreshold={criteria?.stop}
            idleThreshold={criteria?.idle}
          />
        </div>
      )}

      {!loading && events.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <h3 className="font-bold text-base mb-3">
            비가동/정지 구간
            <span className="text-muted-foreground font-normal text-xs ml-2">{events.length}건</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-2 px-2 font-semibold">시각</th>
                  <th className="text-right py-2 px-2 font-semibold">지속</th>
                  <th className="text-left py-2 px-2 font-semibold">상태</th>
                  <th className="text-right py-2 px-2 font-semibold">평균 전류</th>
                  <th className="text-left py-2 px-2 font-semibold">태그</th>
                  <th className="text-left py-2 px-2 font-semibold">원인</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id} className="border-b last:border-0 hover:bg-accent/50">
                    <td className="py-2 px-2 whitespace-nowrap">
                      {minuteToTime(ev.startMinute)} ~ {minuteToTime(ev.endMinute)}
                    </td>
                    <td className="py-2 px-2 text-right font-bold">{formatDuration(ev.duration)}</td>
                    <td className="py-2 px-2">
                      <Badge variant={ev.state === "stop" ? "destructive" : "secondary"} className="text-xs">
                        {ev.state === "stop" ? "정지" : "비가동"}
                      </Badge>
                    </td>
                    <td className="py-2 px-2 text-right">{parseFloat(ev.avgCurrent).toFixed(1)}A</td>
                    <td className="py-2 px-2">
                      {ev.tags?.map((t, i) => (
                        <span key={i} className="inline-block px-1.5 py-0.5 mr-1 rounded text-[11px] border text-muted-foreground" title={t.h}>
                          {t.t}
                        </span>
                      ))}
                    </td>
                    <td className="py-2 px-2">
                      <select
                        value={ev.cause || ""}
                        onChange={(e) => updateCause(ev.id, e.target.value)}
                        className="border rounded px-2 py-1 text-xs bg-background min-w-[120px]"
                      >
                        <option value="">선택...</option>
                        {CAUSES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && events.length === 0 && readings.length > 0 && (
        <div className="rounded-xl border bg-card p-6 text-center text-green-600 dark:text-green-400 font-bold">
          ✔ 비가동/정지 구간이 없습니다.
        </div>
      )}
    </div>
  );
}
