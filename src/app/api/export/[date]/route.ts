import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  emsAnalysisResult,
  emsEquipment,
  emsDowntimeEvent,
  emsCriteria,
} from "@/lib/db/schema";
import { eq, and, asc, desc } from "drizzle-orm";
import ExcelJS from "exceljs";
import { minuteToTime } from "@/lib/format";

// GET /api/export/:date — Excel 보고서 다운로드
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params;
  const factory = _req.nextUrl.searchParams.get("factory");

  // 데이터 조회
  const analysisRows = await db
    .select({
      code: emsEquipment.code,
      factory: emsEquipment.factory,
      group: emsEquipment.group,
      runMinutes: emsAnalysisResult.runMinutes,
      idleMinutes: emsAnalysisResult.idleMinutes,
      stopMinutes: emsAnalysisResult.stopMinutes,
      utilizationRate: emsAnalysisResult.utilizationRate,
      resultJson: emsAnalysisResult.resultJson,
    })
    .from(emsAnalysisResult)
    .innerJoin(emsEquipment, eq(emsAnalysisResult.equipmentId, emsEquipment.id))
    .where(
      factory
        ? and(eq(emsAnalysisResult.analysisDate, date), eq(emsEquipment.factory, factory))
        : eq(emsAnalysisResult.analysisDate, date)
    )
    .orderBy(asc(emsEquipment.displayOrder));

  const eventRows = await db
    .select({
      code: emsEquipment.code,
      factory: emsEquipment.factory,
      state: emsDowntimeEvent.state,
      startMinute: emsDowntimeEvent.startMinute,
      endMinute: emsDowntimeEvent.endMinute,
      duration: emsDowntimeEvent.duration,
      avgCurrent: emsDowntimeEvent.avgCurrent,
      minCurrent: emsDowntimeEvent.minCurrent,
      maxCurrent: emsDowntimeEvent.maxCurrent,
      tags: emsDowntimeEvent.tags,
      cause: emsDowntimeEvent.cause,
      memo: emsDowntimeEvent.memo,
    })
    .from(emsDowntimeEvent)
    .innerJoin(emsEquipment, eq(emsDowntimeEvent.equipmentId, emsEquipment.id))
    .where(
      factory
        ? and(eq(emsDowntimeEvent.analysisDate, date), eq(emsEquipment.factory, factory))
        : eq(emsDowntimeEvent.analysisDate, date)
    )
    .orderBy(asc(emsEquipment.displayOrder), asc(emsDowntimeEvent.startMinute));

  if (!analysisRows.length) {
    return NextResponse.json({ error: "분석 결과가 없습니다." }, { status: 404 });
  }

  // Excel 생성
  const wb = new ExcelJS.Workbook();
  wb.creator = "세한 EMS 비가동 분석";
  wb.created = new Date();

  const FONT = "맑은 고딕";
  const thin: ExcelJS.Border = { style: "thin", color: { argb: "FFBFBFBF" } };
  const BD: Partial<ExcelJS.Borders> = { top: thin, left: thin, bottom: thin, right: thin };
  const HFILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3864" } };
  const HFONT: Partial<ExcelJS.Font> = { name: FONT, bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  const F10: Partial<ExcelJS.Font> = { name: FONT, size: 10 };
  const FB: Partial<ExcelJS.Font> = { name: FONT, size: 10, bold: true };

  const hdr = (c: ExcelJS.Cell) => {
    c.fill = HFILL;
    c.font = HFONT;
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = BD;
  };

  // Sheet 1: 설비별 일요약
  const ws = wb.addWorksheet("설비별_일요약");
  ws.getCell("A1").value = `설비별 일 요약 — ${date}`;
  ws.getCell("A1").font = { name: FONT, bold: true, size: 12 };

  const headers = ["생산일자", "공장", "설비", "정상가동(분)", "비가동(분)", "완전정지(분)", "가동율"];
  headers.forEach((h, i) => {
    const cell = ws.getCell(3, i + 1);
    cell.value = h;
    hdr(cell);
  });
  ws.getRow(3).height = 30;
  ws.columns = [
    { width: 12 }, { width: 8 }, { width: 10 },
    { width: 14 }, { width: 12 }, { width: 14 }, { width: 10 },
  ];

  analysisRows.forEach((r, i) => {
    const row = i + 4;
    const json = r.resultJson as Record<string, unknown> | null;
    const excluded = json?.excluded;
    ws.getCell(row, 1).value = date;
    ws.getCell(row, 2).value = r.factory;
    ws.getCell(row, 3).value = r.code;
    ws.getCell(row, 3).font = FB;
    ws.getCell(row, 4).value = r.runMinutes;
    ws.getCell(row, 5).value = r.idleMinutes;
    ws.getCell(row, 6).value = r.stopMinutes;
    ws.getCell(row, 7).value = parseFloat(r.utilizationRate!);
    ws.getCell(row, 7).numFmt = "0.0%";
    for (let c = 1; c <= 7; c++) {
      ws.getCell(row, c).font = ws.getCell(row, c).font || F10;
      ws.getCell(row, c).border = BD;
    }
    if (excluded) {
      for (let c = 1; c <= 7; c++) {
        ws.getCell(row, c).font = { ...F10, color: { argb: "FF999999" } };
      }
    }
  });

  // Sheet 2: 비가동 구간상세
  const ws2 = wb.addWorksheet("비가동_구간상세");
  ws2.getCell("A1").value = `비가동/정지 구간 상세 — ${date}`;
  ws2.getCell("A1").font = { name: FONT, bold: true, size: 12 };

  const headers2 = ["공장", "설비", "상태", "시작", "종료", "지속(분)", "평균전류(A)", "최소전류(A)", "최대전류(A)", "태그", "원인", "메모"];
  headers2.forEach((h, i) => {
    const cell = ws2.getCell(3, i + 1);
    cell.value = h;
    hdr(cell);
  });
  ws2.columns = [
    { width: 8 }, { width: 10 }, { width: 10 }, { width: 12 }, { width: 12 },
    { width: 10 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 20 }, { width: 18 }, { width: 20 },
  ];

  eventRows.forEach((ev, i) => {
    const row = i + 4;
    ws2.getCell(row, 1).value = ev.factory;
    ws2.getCell(row, 2).value = ev.code;
    ws2.getCell(row, 2).font = FB;
    ws2.getCell(row, 3).value = ev.state === "stop" ? "완전정지" : "비가동";
    ws2.getCell(row, 4).value = minuteToTime(ev.startMinute);
    ws2.getCell(row, 5).value = minuteToTime(ev.endMinute);
    ws2.getCell(row, 6).value = ev.duration;
    ws2.getCell(row, 7).value = ev.avgCurrent ? parseFloat(ev.avgCurrent) : 0;
    ws2.getCell(row, 7).numFmt = "0.0";
    ws2.getCell(row, 8).value = ev.minCurrent ? parseFloat(ev.minCurrent) : 0;
    ws2.getCell(row, 8).numFmt = "0.0";
    ws2.getCell(row, 9).value = ev.maxCurrent ? parseFloat(ev.maxCurrent) : 0;
    ws2.getCell(row, 9).numFmt = "0.0";
    const tags = ev.tags as { t: string }[] | null;
    ws2.getCell(row, 10).value = tags?.map((t) => t.t).join(", ") || "";
    ws2.getCell(row, 11).value = ev.cause || "";
    ws2.getCell(row, 12).value = ev.memo || "";
    for (let c = 1; c <= 12; c++) {
      ws2.getCell(row, c).font = ws2.getCell(row, c).font || F10;
      ws2.getCell(row, c).border = BD;
    }
  });

  // 버퍼 생성
  const buffer = await wb.xlsx.writeBuffer();

  const filename = `비가동현황_${date.replace(/-/g, "")}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
