import { existsSync } from "fs";
import { join } from "path";

interface BuildOutput {
  path: string;
  exists: boolean;
}

const expectedOutputs = [
  "apps/web/.next",
  "apps/api/dist",
  "contracts/target/wasm32-unknown-unknown/release",
];

export function captureBuildOutputs(root = "."): BuildOutput[] {
  return expectedOutputs.map((rel) => ({
    path: rel,
    exists: existsSync(join(root, rel)),
  }));
}

export function assertBuildOutputs(root = "."): void {
  const outputs = captureBuildOutputs(root);
  const missing = outputs.filter((o) => !o.exists);
  for (const o of outputs) {
    console.log(`  [${o.exists ? "found  " : "MISSING"}] ${o.path}`);
  }
  if (missing.length) {
    throw new Error(`Missing build outputs: ${missing.map((o) => o.path).join(", ")}`);
  }
  console.log("All build outputs captured.");
}
