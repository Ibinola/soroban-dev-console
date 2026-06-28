import { writeFileSync } from "fs";

interface FixtureScenario {
  name: string;
  contractId: string;
  method: string;
  args: unknown[];
  expectedOutcome: "success" | "failure";
}

const baseScenarios: FixtureScenario[] = [
  { name: "basic-invoke", contractId: "CONTRACT_ID_PLACEHOLDER", method: "increment", args: [], expectedOutcome: "success" },
  { name: "auth-required", contractId: "CONTRACT_ID_PLACEHOLDER", method: "transfer", args: ["addr1", "addr2", 100], expectedOutcome: "success" },
  { name: "invalid-args", contractId: "CONTRACT_ID_PLACEHOLDER", method: "increment", args: [-1], expectedOutcome: "failure" },
  { name: "empty-storage", contractId: "CONTRACT_ID_PLACEHOLDER", method: "get", args: ["missing-key"], expectedOutcome: "failure" },
];

export function generateFixtures(outputPath = "generated-fixtures.json"): void {
  const fixtures = { generatedAt: new Date().toISOString(), scenarios: baseScenarios };
  writeFileSync(outputPath, JSON.stringify(fixtures, null, 2), "utf-8");
  console.log(`Generated ${baseScenarios.length} fixture scenarios to ${outputPath}`);
}

generateFixtures(process.argv[2] ?? "generated-fixtures.json");
