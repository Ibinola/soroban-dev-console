import { describe, it, expect } from "vitest";
import {
  isAccordionArg,
  serializePreset,
  prefillArgsFromPreset,
} from "./preset-serialization";

// #1032: collapse/expand must retain the edited values of nested args.
describe("preset prefilling (#1032 / #1033)", () => {
  describe("isAccordionArg", () => {
    it("treats vec and map args as accordion/collapsible", () => {
      expect(isAccordionArg({ type: "vec" } as never)).toBe(true);
      expect(isAccordionArg({ type: "map" } as never)).toBe(true);
    });

    it("does not treat scalar args as accordion/collapsible", () => {
      expect(isAccordionArg({ type: "u32" } as never)).toBe(false);
      expect(isAccordionArg({ type: "string" } as never)).toBe(false);
    });
  });

  describe("prefillArgsFromPreset (#1032 value retention)", () => {
    const preset = {
      id: "p1",
      name: "transfer preset",
      contractId: "c1",
      fnName: "transfer",
      network: "testnet",
      source: "custom" as const,
      createdAt: 1,
      args: [
        { id: "a1", name: "to", type: "address", value: "GABC" },
        { id: "a2", name: "opts", type: "vec", value: "[\"1\"]" },
        { id: "a3", name: "fee", type: "i128", value: "100" },
      ],
    };

    function toContractArg(
      a: { id: string; name: string; type: string; value: string },
    ) {
      return { id: a.id, name: a.name, type: a.type, value: a.value };
    }

    it("regenerates ids so toggling the accordion never collides keys", () => {
      const arg = toContractArg(preset.args[0]);
      const freshIds = prefillArgsFromPreset(preset as never);
      expect(freshIds.map((a) => a.id)).not.toContain(arg.id);
      expect(new Set(freshIds.map((a) => a.id)).size).toBe(freshIds.length);
    });

    it("preserves every arg's edited name/type/value during the toggle", () => {
      const freshIds = prefillArgsFromPreset(preset as never);
      freshIds.forEach((a, i) => {
        expect(a.name).toBe(preset.args[i].name);
        expect(a.type).toBe(preset.args[i].type);
        expect(a.value).toBe(preset.args[i].value);
      });
    });

    it("retains the vec/map nested values that keep the accordion expanded", () => {
      const freshIds = prefillArgsFromPreset(preset as never);
      const vec = freshIds.find((a) => a.type === "vec");
      expect(vec?.value).toBe("[\"1\"]");
    });
  });

  describe("serializePreset (#1033 round-trip)", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function deserialize(stored: string): any {
      return JSON.parse(stored);
    }

    it("serializes to stable JSON that deserializes back unchanged", () => {
      const preset = {
        id: "p9",
        name: "load-transfer",
        contractId: "c9",
        fnName: "transfer",
        network: "testnet",
        source: "admin" as const,
        createdAt: 2,
        args: [{ id: "x1", name: "to", type: "address", value: "GABC" }],
      };
      const stored = serializePreset(preset as never); // string (localStorage wire form)
      const back = deserialize(stored);
      expect(back.fnName).toBe("transfer");
      expect(back.contractId).toBe("c9");
      expect(back.args).toEqual([
        { id: "x1", name: "to", type: "address", value: "GABC" },
      ]);
    });
  });
});
