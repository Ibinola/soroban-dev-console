import { describe, it, expect } from "vitest";
import { parseTraceData, toggleNode, flattenTrace } from "@/lib/invocation-trace";
import type { TraceNode } from "@/lib/invocation-trace";

describe("invocation-trace", () => {
  const mockTrace: TraceNode = {
    id: "root",
    contractId: "CABC12345678901234567890123456789012345678901234567890AB",
    functionName: "transfer",
    args: ["addr1", "addr2", "100"],
    result: "Ok",
    expanded: true,
    children: [
      {
        id: "child1",
        contractId: "CDEF12345678901234567890123456789012345678901234567890AB",
        functionName: "balance",
        args: ["addr1"],
        result: "1000",
        expanded: true,
        children: [],
      },
      {
        id: "child2",
        contractId: "CABC12345678901234567890123456789012345678901234567890AB",
        functionName: "debit",
        args: ["addr1", "100"],
        expanded: true,
        children: [
          {
            id: "grandchild",
            contractId: "CXYZ12345678901234567890123456789012345678901234567890AB",
            functionName: "log",
            args: ["transfer_event"],
            result: "Ok",
            expanded: true,
            children: [],
          },
        ],
      },
    ],
  };

  describe("parseTraceData", () => {
    it("parses valid trace data", () => {
      const raw = {
        contract_id: "CABC12345678901234567890123456789012345678901234567890AB",
        function: "transfer",
        args: ["addr1", "addr2"],
        sub_invocations: [],
      };

      const result = parseTraceData(raw);
      expect(result).not.toBeNull();
      expect(result?.functionName).toBe("transfer");
      expect(result?.args).toEqual(["addr1", "addr2"]);
    });

    it("returns null for invalid data", () => {
      expect(parseTraceData(null)).toBeNull();
      expect(parseTraceData("string")).toBeNull();
      expect(parseTraceData(123)).toBeNull();
    });

    it("parses nested sub_invocations", () => {
      const raw = {
        contract_id: "CABC12345678901234567890123456789012345678901234567890AB",
        function: "transfer",
        args: [],
        sub_invocations: [
          {
            contract_id: "CDEF12345678901234567890123456789012345678901234567890AB",
            function: "balance",
            args: ["addr1"],
            sub_invocations: [],
          },
        ],
      };

      const result = parseTraceData(raw);
      expect(result?.children).toHaveLength(1);
      expect(result?.children[0].functionName).toBe("balance");
    });
  });

  describe("toggleNode", () => {
    it("toggles expanded state of target node", () => {
      const toggled = toggleNode(mockTrace, "child1");
      expect(toggled.children[0].expanded).toBe(false);
      expect(toggled.children[1].expanded).toBe(true);
    });

    it("toggles nested nodes", () => {
      const toggled = toggleNode(mockTrace, "grandchild");
      const grandchild = toggled.children[1].children[0];
      expect(grandchild.expanded).toBe(false);
    });

    it("does not mutate original", () => {
      toggleNode(mockTrace, "child1");
      expect(mockTrace.children[0].expanded).toBe(true);
    });
  });

  describe("flattenTrace", () => {
    it("flattens expanded tree", () => {
      const flat = flattenTrace(mockTrace);
      expect(flat).toHaveLength(4);
      expect(flat.map((f) => f.node.id)).toEqual([
        "root",
        "child1",
        "child2",
        "grandchild",
      ]);
    });

    it("respects collapsed nodes", () => {
      const collapsed = toggleNode(mockTrace, "child2");
      const flat = flattenTrace(collapsed);
      expect(flat).toHaveLength(3);
      expect(flat.map((f) => f.node.id)).toEqual(["root", "child1", "child2"]);
    });

    it("tracks depth", () => {
      const flat = flattenTrace(mockTrace);
      expect(flat[0].depth).toBe(0);
      expect(flat[1].depth).toBe(1);
      expect(flat[2].depth).toBe(1);
      expect(flat[3].depth).toBe(2);
    });
  });
});
