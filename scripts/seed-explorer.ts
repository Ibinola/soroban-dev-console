import { readFileSync, existsSync } from "fs";

interface SeedRecord {
  id: string;
  type: string;
  payload: unknown;
}

function loadSeedData(path: string): SeedRecord[] {
  if (!existsSync(path)) {
    console.warn(`Seed file not found: ${path}`);
    return [];
  }
  return JSON.parse(readFileSync(path, "utf-8")) as SeedRecord[];
}

function exploreSeed(path: string, typeFilter?: string): void {
  const records = loadSeedData(path);
  const filtered = typeFilter ? records.filter((r) => r.type === typeFilter) : records;
  const types = [...new Set(records.map((r) => r.type))];

  console.log(`Seed Explorer — ${path}`);
  console.log(`  Total records : ${records.length}`);
  console.log(`  Types         : ${types.join(", ")}`);
  console.log(`  Showing       : ${filtered.length} record(s) [${typeFilter ?? "all"}]`);
  for (const r of filtered) {
    console.log(`    [${r.type}] ${r.id}`);
  }
}

const [, , seedPath = "seed.json", typeFilter] = process.argv;
exploreSeed(seedPath, typeFilter);
