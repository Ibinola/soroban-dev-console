import type { SimulationExplanation } from "@devconsole/soroban-utils";

export type TerminalLevel = "info" | "warn" | "error";

export interface TerminalLine {
  level: TerminalLevel;
  text: string;
}

export interface TerminalSection {
  id: "auth" | "footprint" | "result";
  title: string;
  lines: TerminalLine[];
}

/** Turns a simulation explanation into terminal sections with log levels. */
export function buildTerminalSections(explanation: SimulationExplanation): TerminalSection[] {
  const auth: TerminalLine[] = [];
  if (explanation.authEntries.length === 0) {
    auth.push({ level: "warn", text: "no auth entries" });
  }
  for (const entry of explanation.authEntries) {
    auth.push({ level: "info", text: `require_auth ${entry.contractId} :: ${entry.fnName}` });
  }
  if (explanation.authEntries.length > 1) {
    auth.push({
      level: "warn",
      text: `${explanation.authEntries.length} separate authorizations required`,
    });
  }

  const footprint: TerminalLine[] = [
    { level: "info", text: `inclusion fee   ${explanation.fees.inclusionFee}` },
    { level: "info", text: `resource fee    ${explanation.fees.resourceFee}` },
    { level: "info", text: `total fee       ${explanation.fees.totalFee}` },
    ...explanation.stateChanges.map((c): TerminalLine => ({ level: "info", text: c })),
  ];

  const result: TerminalLine[] = [
    {
      level: explanation.success ? "info" : "error",
      text: explanation.outputSummary,
    },
    ...explanation.warnings.map((w): TerminalLine => ({
      level: /fail|error/i.test(w) ? "error" : "warn",
      text: w,
    })),
  ];

  return [
    { id: "auth", title: "auth", lines: auth },
    { id: "footprint", title: "footprint", lines: footprint },
    { id: "result", title: "result", lines: result },
  ];
}

/** Plain-text rendering of the whole output, used by "copy to clipboard". */
export function formatTerminalText(sections: TerminalSection[]): string {
  return sections
    .map(
      (s) =>
        `[${s.title}]\n` + s.lines.map((l) => `${l.level.toUpperCase().padEnd(5)} ${l.text}`).join("\n"),
    )
    .join("\n\n");
}
