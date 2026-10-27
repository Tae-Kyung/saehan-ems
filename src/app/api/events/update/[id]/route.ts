import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emsDowntimeEvent } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// PATCH /api/events/update/:id — 비가동 구간에 원인/메모 기록
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const eventId = parseInt(id);

  if (isNaN(eventId)) {
    return NextResponse.json({ error: "잘못된 ID" }, { status: 400 });
  }

  const body = await req.json();
  const { cause, memo } = body as { cause?: string; memo?: string };

  const updates: Record<string, unknown> = {};
  if (cause !== undefined) updates.cause = cause;
  if (memo !== undefined) updates.memo = memo;

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "변경할 내용이 없습니다." }, { status: 400 });
  }

  await db
    .update(emsDowntimeEvent)
    .set(updates)
    .where(eq(emsDowntimeEvent.id, eventId));

  return NextResponse.json({ message: "업데이트 완료" });
}
