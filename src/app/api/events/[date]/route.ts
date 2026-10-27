import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emsDowntimeEvent, emsEquipment } from "@/lib/db/schema";
import { eq, and, asc, desc } from "drizzle-orm";

// GET /api/events/:date — 비가동 구간 목록
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params;
  const equipment = _req.nextUrl.searchParams.get("equipment");

  const conditions = [eq(emsDowntimeEvent.analysisDate, date)];
  if (equipment) {
    const eq_ = await db
      .select({ id: emsEquipment.id })
      .from(emsEquipment)
      .where(eq(emsEquipment.code, equipment))
      .limit(1);
    if (eq_.length) {
      conditions.push(eq(emsDowntimeEvent.equipmentId, eq_[0].id));
    }
  }

  const events = await db
    .select({
      id: emsDowntimeEvent.id,
      state: emsDowntimeEvent.state,
      startMinute: emsDowntimeEvent.startMinute,
      endMinute: emsDowntimeEvent.endMinute,
      duration: emsDowntimeEvent.duration,
      avgCurrent: emsDowntimeEvent.avgCurrent,
      minCurrent: emsDowntimeEvent.minCurrent,
      maxCurrent: emsDowntimeEvent.maxCurrent,
      lostUnits: emsDowntimeEvent.lostUnits,
      tags: emsDowntimeEvent.tags,
      cause: emsDowntimeEvent.cause,
      memo: emsDowntimeEvent.memo,
      code: emsEquipment.code,
      factory: emsEquipment.factory,
    })
    .from(emsDowntimeEvent)
    .innerJoin(emsEquipment, eq(emsDowntimeEvent.equipmentId, emsEquipment.id))
    .where(and(...conditions))
    .orderBy(asc(emsDowntimeEvent.startMinute));

  return NextResponse.json({ data: events });
}
