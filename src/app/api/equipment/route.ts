import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emsEquipment } from "@/lib/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  const data = await db
    .select()
    .from(emsEquipment)
    .orderBy(asc(emsEquipment.displayOrder));
  return NextResponse.json({ data });
}
