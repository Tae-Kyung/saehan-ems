import { db } from "@/lib/db";
import {
  emsEquipment,
  emsCriteria,
  emsReading,
  emsAnalysisResult,
  emsDowntimeEvent,
} from "@/lib/db/schema";
import { eq, and, gte, lte, asc } from "drizzle-orm";
import { classify, maxConsecutiveStop, type StatusLabel } from "./classify";
import { detectEvents, type DowntimeEventData } from "./detect-events";
import { NOPROD_STOP_MIN, DAY_MINUTES, ST_GOOD, ST_WARN } from "./constants";

export interface AnalyzeResult {
  date: string;
  factory: string | null;
  equipmentResults: EquipmentResult[];
  summary: Summary;
  warnings: string[];
}

export interface EquipmentResult {
  equipmentId: number;
  code: string;
  factory: string;
  group: string;
  runMinutes: number;
  idleMinutes: number;
  stopMinutes: number;
  utilizationRate: number;
  excluded: boolean;
  excludeReason?: string;
  events: DowntimeEventData[];
  statuses: StatusLabel[];
  current: number[];
}

interface Summary {
  totalEquipment: number;
  analyzedEquipment: number;
  excludedEquipment: number;
  avgUtilizationRate: number;
  totalIdleMinutes: number;
  totalStopMinutes: number;
  goodCount: number;
  badCount: number;
  status: "good" | "warn" | "bad";
}

export async function analyzeDay(
  dateStr: string,
  factory?: string
): Promise<AnalyzeResult> {
  const warnings: string[] = [];

  // 시간 범위: dateStr 07:00 ~ 다음날 07:00
  const startTime = new Date(`${dateStr}T07:00:00+09:00`);
  const endTime = new Date(startTime.getTime() + DAY_MINUTES * 60 * 1000);

  // 설비 + 기준 조회
  const equipments = await db.select().from(emsEquipment).orderBy(asc(emsEquipment.displayOrder));
  const criteria = await db.select().from(emsCriteria);
  const critMap = new Map(criteria.map((c) => [c.group, c]));

  // 해당 날짜 전류 데이터 조회
  const readings = await db
    .select()
    .from(emsReading)
    .where(and(gte(emsReading.recordedAt, startTime), lte(emsReading.recordedAt, endTime)))
    .orderBy(asc(emsReading.recordedAt));

  // 설비별로 전류 배열 구성
  const readingsByEq = new Map<number, { time: Date; value: number }[]>();
  for (const r of readings) {
    if (!readingsByEq.has(r.equipmentId)) readingsByEq.set(r.equipmentId, []);
    readingsByEq.get(r.equipmentId)!.push({
      time: new Date(r.recordedAt),
      value: parseFloat(r.currentValue),
    });
  }

  const results: EquipmentResult[] = [];

  for (const eq of equipments) {
    if (factory && eq.factory !== factory) continue;

    const eqReadings = readingsByEq.get(eq.id) || [];
    if (!eqReadings.length) continue;

    // 1분 단위 전류 배열 (최대 1441개 → 1440개 사용)
    const current = eqReadings.slice(0, DAY_MINUTES + 1).map((r) => r.value);
    const N = Math.min(current.length, DAY_MINUTES);
    const cur = current.slice(0, N);

    const crit = critMap.get(eq.group);
    if (!crit) {
      warnings.push(`${eq.code}: 그룹 '${eq.group}'의 판정 기준이 없습니다.`);
      continue;
    }

    const stopTh = parseFloat(crit.stopThreshold);
    const idleTh = parseFloat(crit.idleThreshold);
    const durMin = crit.durationMin;

    // 상태 분류
    const statuses = classify(cur, stopTh, idleTh, durMin);
    const run = statuses.filter((s) => s === "정상가동").length;
    const idle = statuses.filter((s) => s === "비가동").length;
    const stop = statuses.filter((s) => s === "완전정지").length;

    // 미가동 설비 제외 판별
    const maxStop = maxConsecutiveStop(statuses);
    const excluded = maxStop >= NOPROD_STOP_MIN;

    const result: EquipmentResult = {
      equipmentId: eq.id,
      code: eq.code,
      factory: eq.factory,
      group: eq.group,
      runMinutes: run,
      idleMinutes: idle,
      stopMinutes: stop,
      utilizationRate: N > 0 ? run / N : 0,
      excluded,
      excludeReason: excluded
        ? `완전정지 연속 ${maxStop}분 — 미가동 설비로 제외`
        : undefined,
      events: [],
      statuses,
      current: cur,
    };

    if (excluded) {
      warnings.push(
        `${eq.code}: 완전정지가 연속 ${maxStop}분이라 가동하지 않은 설비로 제외했습니다.`
      );
    } else if (run > 0) {
      // 구간 탐지
      result.events = detectEvents({
        equipmentCode: eq.code,
        factory: eq.factory,
        statuses,
        current: cur,
        perMin: 0, // MOLD 없으면 0
        orderCount: 0,
        itemCount: 0,
      });
    }

    results.push(result);
  }

  // 요약 (제외 설비 빼고 계산)
  const analyzed = results.filter((r) => !r.excluded && r.runMinutes + r.idleMinutes + r.stopMinutes > 0);
  const totalRun = analyzed.reduce((a, r) => a + r.runMinutes, 0);
  const totalN = analyzed.reduce((a, r) => a + r.runMinutes + r.idleMinutes + r.stopMinutes, 0);
  const avgRate = totalN > 0 ? totalRun / totalN : 0;

  const summary: Summary = {
    totalEquipment: results.length,
    analyzedEquipment: analyzed.length,
    excludedEquipment: results.filter((r) => r.excluded).length,
    avgUtilizationRate: avgRate,
    totalIdleMinutes: analyzed.reduce((a, r) => a + r.idleMinutes, 0),
    totalStopMinutes: analyzed.reduce((a, r) => a + r.stopMinutes, 0),
    goodCount: analyzed.filter((r) => r.utilizationRate >= ST_GOOD).length,
    badCount: analyzed.filter((r) => r.utilizationRate < ST_WARN).length,
    status: avgRate >= ST_GOOD ? "good" : avgRate >= ST_WARN ? "warn" : "bad",
  };

  // DB 저장
  await saveResults(dateStr, results);

  return { date: dateStr, factory: factory || null, equipmentResults: results, summary, warnings };
}

async function saveResults(dateStr: string, results: EquipmentResult[]) {
  // 기존 결과 삭제
  await db.delete(emsAnalysisResult).where(eq(emsAnalysisResult.analysisDate, dateStr));
  await db.delete(emsDowntimeEvent).where(eq(emsDowntimeEvent.analysisDate, dateStr));

  // 분석 결과 저장
  for (const r of results) {
    await db.insert(emsAnalysisResult).values({
      analysisDate: dateStr,
      equipmentId: r.equipmentId,
      runMinutes: r.runMinutes,
      idleMinutes: r.idleMinutes,
      stopMinutes: r.stopMinutes,
      utilizationRate: r.utilizationRate.toFixed(4),
      lostUnits: "0",
      resultJson: {
        excluded: r.excluded,
        excludeReason: r.excludeReason,
      },
    });

    // 비가동 구간 저장
    for (const ev of r.events) {
      await db.insert(emsDowntimeEvent).values({
        analysisDate: dateStr,
        equipmentId: r.equipmentId,
        state: ev.state,
        startMinute: ev.startMinute,
        endMinute: ev.endMinute,
        duration: ev.duration,
        avgCurrent: ev.avgCurrent.toFixed(3),
        minCurrent: ev.minCurrent.toFixed(3),
        maxCurrent: ev.maxCurrent.toFixed(3),
        lostUnits: ev.lostUnits.toFixed(1),
        tags: ev.tags,
      });
    }
  }
}
