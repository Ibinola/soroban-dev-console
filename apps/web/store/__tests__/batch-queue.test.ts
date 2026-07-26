import { describe, it, expect } from "vitest";
import type { ContractArg } from "@devconsole/soroban-utils";

// Mirror the BatchCallItem type from contract-call-form.tsx
interface BatchCallItem {
  id: string;
  fnName: string;
  args: ContractArg[];
  status: "pending" | "running" | "success" | "error";
  result?: string;
  error?: string;
}

// Pure batch queue operations (mirrors the state updates in contract-call-form.tsx)
function addToBatch(queue: BatchCallItem[], item: Omit<BatchCallItem, "status">): BatchCallItem[] {
  return [...queue, { ...item, status: "pending" }];
}

function removeFromBatch(queue: BatchCallItem[], id: string): BatchCallItem[] {
  return queue.filter((item) => item.id !== id);
}

function moveBatchItem(
  queue: BatchCallItem[],
  id: string,
  direction: "up" | "down",
): BatchCallItem[] {
  const idx = queue.findIndex((item) => item.id === id);
  if (idx < 0) return queue;
  const newIdx = direction === "up" ? idx - 1 : idx + 1;
  if (newIdx < 0 || newIdx >= queue.length) return queue;
  const next = [...queue];
  [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
  return next;
}

function updateStatus(
  queue: BatchCallItem[],
  id: string,
  status: BatchCallItem["status"],
  extra: { result?: string; error?: string } = {},
): BatchCallItem[] {
  return queue.map((item) => item.id === id ? { ...item, status, ...extra } : item);
}

function makeArg(overrides: Partial<ContractArg> = {}): ContractArg {
  return { id: "arg-1", name: "amount", type: "i128", value: "100", ...overrides } as ContractArg;
}

function makeItem(id: string, fnName: string): Omit<BatchCallItem, "status"> {
  return { id, fnName, args: [makeArg()] };
}

describe("batch queue state management (#688)", () => {
  it("starts with empty queue", () => {
    const queue: BatchCallItem[] = [];
    expect(queue).toHaveLength(0);
  });

  it("adds items to queue with pending status", () => {
    let queue: BatchCallItem[] = [];
    queue = addToBatch(queue, makeItem("1", "transfer"));
    queue = addToBatch(queue, makeItem("2", "approve"));
    expect(queue).toHaveLength(2);
    expect(queue[0].status).toBe("pending");
    expect(queue[1].status).toBe("pending");
  });

  it("removes an item by id", () => {
    let queue: BatchCallItem[] = [
      { ...makeItem("1", "transfer"), status: "pending" },
      { ...makeItem("2", "approve"), status: "pending" },
    ];
    queue = removeFromBatch(queue, "1");
    expect(queue).toHaveLength(1);
    expect(queue[0].id).toBe("2");
  });

  it("moves an item up", () => {
    let queue: BatchCallItem[] = [
      { ...makeItem("1", "transfer"), status: "pending" },
      { ...makeItem("2", "approve"), status: "pending" },
      { ...makeItem("3", "mint"), status: "pending" },
    ];
    queue = moveBatchItem(queue, "2", "up");
    expect(queue[0].id).toBe("2");
    expect(queue[1].id).toBe("1");
  });

  it("moves an item down", () => {
    let queue: BatchCallItem[] = [
      { ...makeItem("1", "transfer"), status: "pending" },
      { ...makeItem("2", "approve"), status: "pending" },
    ];
    queue = moveBatchItem(queue, "1", "down");
    expect(queue[0].id).toBe("2");
    expect(queue[1].id).toBe("1");
  });

  it("does not move first item up", () => {
    const queue: BatchCallItem[] = [
      { ...makeItem("1", "transfer"), status: "pending" },
      { ...makeItem("2", "approve"), status: "pending" },
    ];
    const result = moveBatchItem(queue, "1", "up");
    expect(result[0].id).toBe("1");
  });

  it("does not move last item down", () => {
    const queue: BatchCallItem[] = [
      { ...makeItem("1", "transfer"), status: "pending" },
      { ...makeItem("2", "approve"), status: "pending" },
    ];
    const result = moveBatchItem(queue, "2", "down");
    expect(result[1].id).toBe("2");
  });

  it("updates status to running", () => {
    let queue: BatchCallItem[] = [
      { ...makeItem("1", "transfer"), status: "pending" },
    ];
    queue = updateStatus(queue, "1", "running");
    expect(queue[0].status).toBe("running");
  });

  it("updates status to success with result", () => {
    let queue: BatchCallItem[] = [
      { ...makeItem("1", "transfer"), status: "running" },
    ];
    queue = updateStatus(queue, "1", "success", { result: "OK" });
    expect(queue[0].status).toBe("success");
    expect(queue[0].result).toBe("OK");
  });

  it("updates status to error with error message", () => {
    let queue: BatchCallItem[] = [
      { ...makeItem("1", "transfer"), status: "running" },
    ];
    queue = updateStatus(queue, "1", "error", { error: "Simulation failed" });
    expect(queue[0].status).toBe("error");
    expect(queue[0].error).toBe("Simulation failed");
  });

  it("preserves order of unaffected items when updating status", () => {
    let queue: BatchCallItem[] = [
      { ...makeItem("1", "transfer"), status: "pending" },
      { ...makeItem("2", "approve"), status: "pending" },
      { ...makeItem("3", "mint"), status: "pending" },
    ];
    queue = updateStatus(queue, "2", "success", { result: "done" });
    expect(queue[0].id).toBe("1");
    expect(queue[1].id).toBe("2");
    expect(queue[2].id).toBe("3");
    expect(queue[1].status).toBe("success");
    expect(queue[0].status).toBe("pending");
  });
});
