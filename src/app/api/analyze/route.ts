import { NextRequest, NextResponse } from "next/server";
import { analyzeDay } from "@/lib/analysis/analyzer";

// POST /api/analyze — 지정일 분석 실행
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { date, factory } = body as { date: string; factory?: string };

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "날짜를 YYYY-MM-DD 형식으로 지정하세요." },
        { status: 400 }
      );
    }

    const result = await analyzeDay(date, factory);

    // statuses, current 배열은 응답에서 제외 (너무 큼)
    const equipmentResults = result.equipmentResults.map((r) => ({
      equipmentId: r.equipmentId,
      code: r.code,
      factory: r.factory,
      group: r.group,
      runMinutes: r.runMinutes,
      idleMinutes: r.idleMinutes,
      stopMinutes: r.stopMinutes,
      utilizationRate: r.utilizationRate,
      excluded: r.excluded,
      excludeReason: r.excludeReason,
      eventCount: r.events.length,
    }));

    return NextResponse.json({
      data: {
        date: result.date,
        factory: result.factory,
        summary: result.summary,
        equipmentResults,
        warnings: result.warnings,
      },
      message: `${date} 분석 완료 (${result.summary.analyzedEquipment}대 분석, ${result.summary.excludedEquipment}대 제외)`,
    });
  } catch (err) {
    console.error("Analyze error:", err);
    return NextResponse.json(
      { error: "분석 중 오류가 발생했습니다.", detail: String(err) },
      { status: 500 }
    );
  }
}
