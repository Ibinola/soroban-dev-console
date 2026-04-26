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
