import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { emsEquipment, emsCriteria } from "./schema";

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client);

const EQUIPMENT: { code: string; factory: string; group: string }[] = [];

// 1공장 PET-1~18
for (let i = 1; i <= 18; i++) EQUIPMENT.push({ code: `PET-${i}`, factory: "1공장", group: "PET" });
// 1공장 PE-1~4
for (let i = 1; i <= 4; i++) EQUIPMENT.push({ code: `PE-${i}`, factory: "1공장", group: "PE" });
// 1공장 사출기, 블로우기
EQUIPMENT.push({ code: "A-1", factory: "1공장", group: "사출기" });
EQUIPMENT.push({ code: "B-1", factory: "1공장", group: "B-1" });
EQUIPMENT.push({ code: "B-2", factory: "1공장", group: "B-2" });
// 2공장 프리폼 사출기 P-1~5
for (let i = 1; i <= 5; i++) EQUIPMENT.push({ code: `P-${i}`, factory: "2공장", group: "사출기" });
// 2공장 블로우 성형기 S-1~7
const S_GROUPS: Record<number, string> = { 1: "S-1", 2: "S-2", 3: "S-3,5", 4: "S-4", 5: "S-3,5", 6: "S-6", 7: "S-7" };
for (let i = 1; i <= 7; i++) EQUIPMENT.push({ code: `S-${i}`, factory: "2공장", group: S_GROUPS[i] });

const CRITERIA = [
  { group: "PET", stopThreshold: "5", idleThreshold: "60", durationMin: 5 },
  { group: "PE", stopThreshold: "5", idleThreshold: "50", durationMin: 3 },
  { group: "사출기", stopThreshold: "5", idleThreshold: "50", durationMin: 5 },
  { group: "B-1", stopThreshold: "5", idleThreshold: "50", durationMin: 3 },
  { group: "B-2", stopThreshold: "5", idleThreshold: "29", durationMin: 3 },
  { group: "S-1", stopThreshold: "5", idleThreshold: "40", durationMin: 3 },
  { group: "S-2", stopThreshold: "5", idleThreshold: "35", durationMin: 3 },
  { group: "S-3,5", stopThreshold: "5", idleThreshold: "60", durationMin: 3 },
  { group: "S-4", stopThreshold: "5", idleThreshold: "25", durationMin: 3 },
  { group: "S-6", stopThreshold: "5", idleThreshold: "50", durationMin: 3 },
  { group: "S-7", stopThreshold: "10", idleThreshold: "100", durationMin: 3 },
];

async function seed() {
  console.log("Seeding equipment...");
  for (let i = 0; i < EQUIPMENT.length; i++) {
    const eq = EQUIPMENT[i];
    await db
      .insert(emsEquipment)
      .values({ code: eq.code, factory: eq.factory, group: eq.group, displayOrder: i })
      .onConflictDoNothing();
  }
  console.log(`  ${EQUIPMENT.length} equipment records`);

  console.log("Seeding criteria...");
  for (const c of CRITERIA) {
    await db.insert(emsCriteria).values(c).onConflictDoNothing();
  }
  console.log(`  ${CRITERIA.length} criteria records`);

  console.log("Seed complete.");
  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
