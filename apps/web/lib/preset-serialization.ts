import type { ContractArg } from "@devconsole/soroban-utils";
import type { OperationPreset } from "@/store/useSavedCallsStore";

// #1032: an argument whose accordion row is collapsible (nested vec/map args).
export const isAccordionArg = (a: ContractArg): boolean =>
  a.type === "vec" || a.type === "map";

// #1033: serialize a preset to JSON (round-trippable for local-storage persistence).
export const serializePreset = (preset: OperationPreset): string =>
  JSON.stringify(preset);

// #1032/#1033: rebuild the accordion arg list from a preset, regenerating ids so
// values are retained during an accordion toggle without key collisions.
export const prefillArgsFromPreset = (preset: OperationPreset): ContractArg[] =>
  preset.args.map((a) => ({ ...a, id: crypto.randomUUID() }));
