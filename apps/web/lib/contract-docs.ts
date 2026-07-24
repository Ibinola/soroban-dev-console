import { FixtureContract } from "./fixture-manifest";

export interface FunctionDoc {
  name: string;
  args: string[];
  outputs: string[];
  warnings: string[];
}

export interface ContractRefDoc {
  contractId: string;
  source: "spec" | "fixture";
  functions: FunctionDoc[];
  generatedAt: number;
}

export function docFromFunctionNames(
  names: string[],
  contractId: string,
): ContractRefDoc {
  return {
    contractId,
    source: "spec",
    generatedAt: Date.now(),
    functions: names.map((name) => ({
      name,
      args: [],
      outputs: [],
      warnings: [],
    })),
  };
}

export function docFromFixture(fixture: FixtureContract): ContractRefDoc {
  return {
    contractId: fixture.contractId ?? fixture.key,
    source: "fixture",
    generatedAt: Date.now(),
    functions: [
      {
        name: fixture.key,
        args: [],
        outputs: [],
        warnings: fixture.contractId ? [] : ["Contract not deployed — ID unavailable"],
      },
    ],
  };
}

export function mergeContractDocs(
  existing: ContractRefDoc,
  incoming: ContractRefDoc,
): ContractRefDoc {
  const existingNames = new Set(existing.functions.map((f) => f.name));
  const newFunctions = incoming.functions.filter((f) => !existingNames.has(f.name));

  return {
    ...existing,
    generatedAt: Date.now(),
    functions: [...existing.functions, ...newFunctions],
  };
}

/** Look up the documentation entry for a single method by name. */
export function getFunctionDoc(
  doc: ContractRefDoc,
  functionName: string,
): FunctionDoc | undefined {
  return doc.functions.find((f) => f.name === functionName);
}

/** True when a doc string has meaningful content worth rendering a panel for. */
export function hasDocContent(doc?: string | null): boolean {
  return typeof doc === "string" && doc.trim().length > 0;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Render a contract doc string to safe HTML, allowing only bold, inline code,
 * and http(s) links. Input is escaped first so no unsafe HTML can survive.
 */
export function renderDocString(doc: string): string {
  let out = escapeHtml(doc.trim());
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  return out;
}
