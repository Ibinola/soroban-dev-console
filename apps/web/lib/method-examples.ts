import { SavedCall } from "../store/useSavedCallsStore";
import { FixtureContract } from "./fixture-manifest";

export interface MethodExample {
  id: string;
  contractId: string;
  fnName: string;
  args: unknown[];
  source: "saved-call" | "fixture";
  label: string;
  stale: boolean;
}

export function exampleFromSavedCall(call: SavedCall): MethodExample {
  return {
    id: call.id,
    contractId: call.contractId,
    fnName: call.fnName,
    args: call.args,
    source: "saved-call",
    label: call.name || `${call.fnName} example`,
    stale: false,
  };
}

export function examplesFromFixture(
  fixture: FixtureContract,
  fnNames: string[],
): MethodExample[] {
  return fnNames.map((fn) => ({
    id: `${fixture.key}:${fn}`,
    contractId: fixture.contractId ?? "",
    fnName: fn,
    args: [],
    source: "fixture",
    label: `${fixture.label} — ${fn}`,
    stale: fixture.contractId === null,
  }));
}

export function getExamplesForContract(
  contractId: string,
  savedCalls: SavedCall[],
): MethodExample[] {
  return savedCalls
    .filter((c) => c.contractId === contractId)
    .map(exampleFromSavedCall);
}

export function markStaleExamples(
  examples: MethodExample[],
  activeContractIds: Set<string>,
): MethodExample[] {
  return examples.map((ex) => ({
    ...ex,
    stale: ex.stale || !activeContractIds.has(ex.contractId),
  }));
}
