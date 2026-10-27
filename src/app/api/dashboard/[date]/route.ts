import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  emsAnalysisResult,
  emsEquipment,
  emsDowntimeEvent,
} from "@/lib/db/schema";
import { eq, and, asc, desc } from "drizzle-orm";
import { ST_GOOD, ST_WARN } from "@/lib/analysis/constants";

// GET /api/dashboard/:date — 대시보드 데이터 조회
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "잘못된 날짜 형식" }, { status: 400 });
  }

  const factory = _req.nextUrl.searchParams.get("factory");

  // 분석 결과 조회
  const results = await db
    .select({
      analysisDate: emsAnalysisResult.analysisDate,
      equipmentId: emsAnalysisResult.equipmentId,
      runMinutes: emsAnalysisResult.runMinutes,
      idleMinutes: emsAnalysisResult.idleMinutes,
      stopMinutes: emsAnalysisResult.stopMinutes,
      utilizationRate: emsAnalysisResult.utilizationRate,
      resultJson: emsAnalysisResult.resultJson,
      code: emsEquipment.code,
      factory: emsEquipment.factory,
      group: emsEquipment.group,
    })
    .from(emsAnalysisResult)
    .innerJoin(emsEquipment, eq(emsAnalysisResult.equipmentId, emsEquipment.id))
    .where(
      factory
        ? and(eq(emsAnalysisResult.analysisDate, date), eq(emsEquipment.factory, factory))
        : eq(emsAnalysisResult.analysisDate, date)
    )
    .orderBy(asc(emsEquipment.displayOrder));

  if (!results.length) {
    return NextResponse.json({
      data: null,
      message: `${date} 분석 결과가 없습니다. 먼저 분석을 실행하세요.`,
    });
  }

  // 제외 설비 판별
  const analyzed = results.filter((r) => {
    const json = r.resultJson as Record<string, unknown> | null;
    return !json?.excluded;
  });

  const totalRun = analyzed.reduce((a, r) => a + r.runMinutes, 0);
  const totalIdle = analyzed.reduce((a, r) => a + r.idleMinutes, 0);
  const totalStop = analyzed.reduce((a, r) => a + r.stopMinutes, 0);
  const totalN = totalRun + totalIdle + totalStop;
  const avgRate = totalN > 0 ? totalRun / totalN : 0;

  // TOP 5 비가동 구간
  const topEvents = await db
    .select({
      id: emsDowntimeEvent.id,
      state: emsDowntimeEvent.state,
      startMinute: emsDowntimeEvent.startMinute,
      endMinute: emsDowntimeEvent.endMinute,
      duration: emsDowntimeEvent.duration,
      avgCurrent: emsDowntimeEvent.avgCurrent,
      tags: emsDowntimeEvent.tags,
      cause: emsDowntimeEvent.cause,
      code: emsEquipment.code,
      factory: emsEquipment.factory,
    })
    .from(emsDowntimeEvent)
    .innerJoin(emsEquipment, eq(emsDowntimeEvent.equipmentId, emsEquipment.id))
    .where(
      factory
        ? and(eq(emsDowntimeEvent.analysisDate, date), eq(emsEquipment.factory, factory))
        : eq(emsDowntimeEvent.analysisDate, date)
    )
    .orderBy(desc(emsDowntimeEvent.duration))
    .limit(5);

  const goodCount = analyzed.filter((r) => parseFloat(r.utilizationRate!) >= ST_GOOD).length;
  const badCount = analyzed.filter((r) => parseFloat(r.utilizationRate!) < ST_WARN).length;

  return NextResponse.json({
    data: {
      date,
      factory: factory || "전체",
      summary: {
        totalEquipment: results.length,
        analyzedEquipment: analyzed.length,
        excludedEquipment: results.length - analyzed.length,
        avgUtilizationRate: avgRate,
        totalIdleMinutes: totalIdle,
        totalStopMinutes: totalStop,
        goodCount,
        badCount,
        status: avgRate >= ST_GOOD ? "good" : avgRate >= ST_WARN ? "warn" : "bad",
      },
      equipment: analyzed.map((r) => ({
        code: r.code,
        factory: r.factory,
        group: r.group,
        runMinutes: r.runMinutes,
        idleMinutes: r.idleMinutes,
        stopMinutes: r.stopMinutes,
        utilizationRate: parseFloat(r.utilizationRate!),
      })),
      topEvents: topEvents.map((ev) => ({
        id: ev.id,
        code: ev.code,
        factory: ev.factory,
        state: ev.state,
        startMinute: ev.startMinute,
        endMinute: ev.endMinute,
        duration: ev.duration,
        tags: ev.tags,
        cause: ev.cause,
      })),
    },
  });
}
