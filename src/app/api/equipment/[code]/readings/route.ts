import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emsEquipment, emsReading } from "@/lib/db/schema";
import { eq, and, gte, lte, asc } from "drizzle-orm";
import { DAY_MINUTES } from "@/lib/analysis/constants";

// GET /api/equipment/:code/readings?date=YYYY-MM-DD
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const date = req.nextUrl.searchParams.get("date");

  if (!date) {
    return NextResponse.json({ error: "date 파라미터가 필요합니다." }, { status: 400 });
  }

  const eqs = await db
    .select()
    .from(emsEquipment)
    .where(eq(emsEquipment.code, code))
    .limit(1);

  if (!eqs.length) {
    return NextResponse.json({ error: "설비를 찾을 수 없습니다." }, { status: 404 });
  }

  const equipment = eqs[0];
  const startTime = new Date(`${date}T07:00:00+09:00`);
  const endTime = new Date(startTime.getTime() + DAY_MINUTES * 60 * 1000);

  const readings = await db
    .select({
      recordedAt: emsReading.recordedAt,
      currentValue: emsReading.currentValue,
    })
    .from(emsReading)
    .where(
      and(
        eq(emsReading.equipmentId, equipment.id),
        gte(emsReading.recordedAt, startTime),
        lte(emsReading.recordedAt, endTime)
      )
    )
    .orderBy(asc(emsReading.recordedAt));

  return NextResponse.json({
    data: {
      equipment: { code: equipment.code, factory: equipment.factory, group: equipment.group },
      readings: readings.map((r) => ({
        time: r.recordedAt,
        value: parseFloat(r.currentValue),
      })),
    },
  });
}
