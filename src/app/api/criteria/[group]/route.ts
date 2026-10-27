import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emsCriteria } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// PUT /api/criteria/:group — 판정 기준 수정
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ group: string }> }
) {
  const { group } = await params;
  const body = await req.json();
  const { stopThreshold, idleThreshold, durationMin } = body as {
    stopThreshold: number;
    idleThreshold: number;
    durationMin: number;
  };

  if (stopThreshold == null || idleThreshold == null || durationMin == null) {
    return NextResponse.json({ error: "모든 필드를 입력하세요." }, { status: 400 });
  }

  await db
    .update(emsCriteria)
    .set({
      stopThreshold: String(stopThreshold),
      idleThreshold: String(idleThreshold),
      durationMin,
      updatedAt: new Date(),
    })
    .where(eq(emsCriteria.group, group));

  return NextResponse.json({ message: `${group} 기준 업데이트 완료` });
}
