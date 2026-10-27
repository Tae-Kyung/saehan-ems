import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emsCriteria } from "@/lib/db/schema";

export async function GET() {
  const data = await db.select().from(emsCriteria);
  return NextResponse.json({ data });
}
