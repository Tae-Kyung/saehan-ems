import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emsEquipment, emsReading } from "@/lib/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { mapEmsColumn } from "@/lib/analysis/constants";

interface EmsRow {
  index: number;
  time: string;
  [key: string]: unknown;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rows: EmsRow[] = Array.isArray(body) ? body : body.data;

    if (!rows || !rows.length) {
      return NextResponse.json({ error: "빈 데이터입니다." }, { status: 400 });
    }

    // 설비 매핑: EMS 컬럼명 → equipment code → equipment id
    const equipments = await db.select().from(emsEquipment);
    const eqMap = new Map(equipments.map((e) => [e.code, e.id]));

    const columns = Object.keys(rows[0]).filter((k) => k !== "index" && k !== "time");
    const colMapping: { col: string; equipmentId: number }[] = [];
    const unmapped: string[] = [];

    for (const col of columns) {
      const code = mapEmsColumn(col);
      if (code && eqMap.has(code)) {
        colMapping.push({ col, equipmentId: eqMap.get(code)! });
      } else {
        unmapped.push(col);
      }
    }

    if (!colMapping.length) {
      return NextResponse.json(
        { error: "매핑 가능한 설비 컬럼이 없습니다.", unmapped },
        { status: 400 }
      );
    }

    // 날짜 추출
    const firstTime = rows[0].time;
    const dateStr = firstTime.slice(0, 10); // "2026-10-13"

    // 기존 데이터 삭제 (해당 시간 범위 + 매핑된 설비)
    const startTime = new Date(firstTime);
    const endTime = new Date(rows[rows.length - 1].time);

    for (const { equipmentId } of colMapping) {
      await db
        .delete(emsReading)
        .where(
          and(
            eq(emsReading.equipmentId, equipmentId),
            gte(emsReading.recordedAt, startTime),
            lte(emsReading.recordedAt, endTime),
          )
        );
    }

    // 배치 삽입 (설비별로 upsert)
    let insertCount = 0;
    const BATCH_SIZE = 500;

    for (const { col, equipmentId } of colMapping) {
      const values: { equipmentId: number; recordedAt: Date; currentValue: string }[] = [];

      for (const row of rows) {
        const v = parseFloat(row[col] as string);
        if (isNaN(v)) continue;
        values.push({
          equipmentId,
          recordedAt: new Date(row.time),
          currentValue: v.toFixed(3),
        });
      }

      // 배치 삽입
      for (let i = 0; i < values.length; i += BATCH_SIZE) {
        const batch = values.slice(i, i + BATCH_SIZE);
        await db
          .insert(emsReading)
          .values(batch)
          .onConflictDoUpdate({
            target: [emsReading.equipmentId, emsReading.recordedAt],
            set: { currentValue: sql`excluded.current_value` },
          });
        insertCount += batch.length;
      }
    }

    return NextResponse.json({
      data: {
        date: dateStr,
        rows: rows.length,
        equipmentCount: colMapping.length,
        insertCount,
        unmapped: unmapped.length ? unmapped : undefined,
        mappedEquipment: colMapping.map((c) => {
          const eq = equipments.find((e) => e.id === c.equipmentId);
          return eq?.code;
        }),
      },
      message: `${dateStr} EMS 데이터 업로드 완료 (${colMapping.length}대 설비, ${insertCount}건)`,
    });
  } catch (err) {
    console.error("EMS upload error:", err);
    return NextResponse.json(
      { error: "업로드 처리 중 오류가 발생했습니다.", detail: String(err) },
      { status: 500 }
    );
  }
}
