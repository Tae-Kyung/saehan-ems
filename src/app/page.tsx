"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { VerdictBanner } from "@/components/dashboard/verdict-banner";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { EquipmentBars } from "@/components/dashboard/equipment-bars";
import { TopEvents } from "@/components/dashboard/top-events";
import { formatPercent } from "@/lib/format";
import { fetchJson } from "@/lib/fetch-safe";

interface DashboardData {
  date: string;
  factory: string;
  summary: {
    totalEquipment: number;
    analyzedEquipment: number;
    excludedEquipment: number;
    avgUtilizationRate: number;
    totalIdleMinutes: number;
    totalStopMinutes: number;
    goodCount: number;
    badCount: number;
    status: "good" | "warn" | "bad";
  };
  equipment: {
    code: string;
    factory: string;
    group: string;
    runMinutes: number;
    idleMinutes: number;
    stopMinutes: number;
    utilizationRate: number;
  }[];
  topEvents: {
    id: number;
    code: string;
    factory: string;
    state: string;
    startMinute: number;
    endMinute: number;
    duration: number;
    tags: { k: string; t: string; h: string }[] | null;
    cause: string | null;
  }[];
}

export default function Home() {
  const [date, setDate] = useState("2026-10-13");
  const [factory, setFactory] = useState<string>("");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noData, setNoData] = useState(false);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNoData(false);
    try {
      const params = factory ? `?factory=${encodeURIComponent(factory)}` : "";
      const res = await fetchJson<{ data: DashboardData | null }>(`/api/dashboard/${date}${params}`);
      if (res.ok && res.data?.data) {
        setData(res.data.data);
      } else if (res.error) {
        setError(res.error);
        setNoData(true);
      } else {
        setData(null);
        setNoData(true);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [date, factory]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const res = await fetchJson("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, factory: factory || undefined }),
      });
      if (!res.ok) {
        setError(res.error || "분석 실패");
        return;
      }
      await fetchDashboard();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  // 요약 문장 생성
  const buildSentence = (d: DashboardData) => {
    const worst = [...d.equipment].sort((a, b) => a.utilizationRate - b.utilizationRate);
    if (!worst.length) return "분석할 설비가 없습니다.";
    const totalLost = d.summary.totalIdleMinutes + d.summary.totalStopMinutes;
    let s = `가동율이 가장 낮은 설비는 <b>${worst[0].code}</b>(${formatPercent(worst[0].utilizationRate, 0)})입니다.`;
    if (totalLost > 0) {
      const h = (totalLost / 60).toFixed(1);
      s += ` 비가동·정지는 설비 합계 <b>${h}시간</b>입니다.`;
    }
    return s;
  };

  const dateLabel = (() => {
    const m = date.match(/(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${+m[2]}월 ${+m[3]}일자` : date;
  })();

  return (
    <div className="max-w-5xl mx-auto py-6 px-4">
      {/* 날짜/공장 필터 */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm bg-background"
        />
        <select
          value={factory}
          onChange={(e) => setFactory(e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm bg-background"
        >
          <option value="">전체</option>
          <option value="1공장">1공장</option>
          <option value="2공장">2공장</option>
        </select>
        <Button variant="outline" size="sm" onClick={runAnalysis} disabled={loading}>
          {loading ? "분석 중..." : "분석 실행"}
        </Button>
        {data && (
          <a
            href={`/api/export/${date}${factory ? `?factory=${encodeURIComponent(factory)}` : ""}`}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border text-sm font-medium hover:bg-accent/50 transition-colors"
          >
            엑셀 다운로드
          </a>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="text-center py-16 text-muted-foreground">불러오는 중...</div>
      )}

      {noData && !loading && (
        <Card>
          <CardHeader>
            <CardTitle>데이터 없음</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {date}의 분석 결과가 없습니다.
              EMS 데이터를 업로드한 후 &ldquo;분석 실행&rdquo; 버튼을 누르세요.
            </p>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              데이터 업로드
            </Link>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          <VerdictBanner
            avgRate={data.summary.avgUtilizationRate}
            status={data.summary.status}
            sentence={buildSentence(data)}
            analyzedCount={data.summary.analyzedEquipment}
            excludedCount={data.summary.excludedEquipment}
            dateLabel={`${dateLabel} ${data.factory}`}
          />

          <KpiCards
            totalIdleMinutes={data.summary.totalIdleMinutes}
            totalStopMinutes={data.summary.totalStopMinutes}
            badCount={data.summary.badCount}
            analyzedCount={data.summary.analyzedEquipment}
            goodCount={data.summary.goodCount}
          />

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
            <div className="lg:col-span-3">
              <EquipmentBars equipment={data.equipment} />
            </div>
            <div className="lg:col-span-2">
              <TopEvents events={data.topEvents} />
            </div>
          </div>

          <div className="text-xs text-muted-foreground border-t pt-2">
            가동율 표시 기준:
            <span className="text-green-600 dark:text-green-400 font-bold ml-2">✔ 양호 95% 이상</span>
            <span className="mx-1">·</span>
            <span className="text-amber-600 dark:text-amber-400 font-bold">▲ 주의 80~95%</span>
            <span className="mx-1">·</span>
            <span className="text-red-600 dark:text-red-400 font-bold">✖ 점검 80% 미만</span>
          </div>
        </>
      )}
    </div>
  );
}
