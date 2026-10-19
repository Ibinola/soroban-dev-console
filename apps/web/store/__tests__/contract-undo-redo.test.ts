import { describe, it, expect, beforeEach, vi } from "vitest";
import { CONTRACT_UNDO_LIMIT, useContractStore } from "../useContractStore";

function contract(id: string, index = 0) {
  return { id, name: `Contract ${index}`, network: "testnet", addedAt: index };
}

describe("workspace contract undo/redo (#1269)", () => {
  beforeEach(() => {
    useContractStore.setState({ contracts: [], undoStack: [], redoStack: [] });
  });

  it("undoes a removal and restores the contract", () => {
    const { addContract } = useContractStore.getState();
    addContract("C1", "testnet");
    addContract("C2", "testnet");

    useContractStore.getState().removeContract("C1");
    expect(useContractStore.getState().contracts.map((c) => c.id)).toEqual([
      "C2",
    ]);
    expect(useContractStore.getState().canUndo()).toBe(true);

    expect(useContractStore.getState().undo()).toBe("removed contract");
    // Contracts are prepended on add, so the restored order is C2, C1.
    expect(useContractStore.getState().contracts.map((c) => c.id)).toEqual([
      "C2",
      "C1",
    ]);
  });

  it("redoes the removal that was undone", () => {
    const { addContract } = useContractStore.getState();
    addContract("C1", "testnet");

    useContractStore.getState().removeContract("C1");
    useContractStore.getState().undo();
    expect(useContractStore.getState().canRedo()).toBe(true);

    expect(useContractStore.getState().redo()).toBe("removed contract");
    expect(useContractStore.getState().contracts).toEqual([]);
  });

  it("reports the action labels for the shortcuts' tooltips", () => {
    useContractStore.getState().addContract("C1", "testnet");
    expect(useContractStore.getState().peekUndoLabel()).toBe("added contract");
    expect(useContractStore.getState().peekRedoLabel()).toBeNull();

    useContractStore.getState().undo();
    expect(useContractStore.getState().peekUndoLabel()).toBeNull();
    expect(useContractStore.getState().peekRedoLabel()).toBe("added contract");
  });

  it("returns null when there is nothing to undo or redo", () => {
    expect(useContractStore.getState().undo()).toBeNull();
    expect(useContractStore.getState().redo()).toBeNull();
    expect(useContractStore.getState().canUndo()).toBe(false);
    expect(useContractStore.getState().canRedo()).toBe(false);
  });

  it(`only keeps the last ${CONTRACT_UNDO_LIMIT} actions`, () => {
    const { addContract } = useContractStore.getState();

    for (let index = 0; index < CONTRACT_UNDO_LIMIT + 5; index++) {
      addContract(`C${index}`, "testnet");
    }

    expect(useContractStore.getState().undoStack).toHaveLength(
      CONTRACT_UNDO_LIMIT,
    );
    expect(CONTRACT_UNDO_LIMIT).toBe(20);
  });

  it("clears the redo stack once a new modification happens", () => {
    const { addContract } = useContractStore.getState();
    addContract("C1", "testnet");
    useContractStore.getState().undo();
    expect(useContractStore.getState().canRedo()).toBe(true);

    addContract("C2", "testnet");
    expect(useContractStore.getState().canRedo()).toBe(false);
  });

  it("resets history when the workspace is saved", () => {
    useContractStore.getState().addContract("C1", "testnet");
    expect(useContractStore.getState().canUndo()).toBe(true);

    useContractStore.getState().clearHistory();

    expect(useContractStore.getState().undoStack).toEqual([]);
    expect(useContractStore.getState().redoStack).toEqual([]);
    expect(useContractStore.getState().contracts).toHaveLength(1);
  });

  it("does not record a no-op add twice", () => {
    const { addContract } = useContractStore.getState();
    addContract("C1", "testnet");
    addContract("C1", "testnet");

    expect(useContractStore.getState().undoStack).toHaveLength(1);
  });

  it("reorders contracts and can undo the reorder", () => {
    useContractStore.setState({
      contracts: [contract("C1", 0), contract("C2", 1), contract("C3", 2)],
      undoStack: [],
      redoStack: [],
    });

    useContractStore.getState().moveContract("C1", "down");
    expect(useContractStore.getState().contracts.map((c) => c.id)).toEqual([
      "C2",
      "C1",
      "C3",
    ]);

    expect(useContractStore.getState().undo()).toBe("moved contract down");
    expect(useContractStore.getState().contracts.map((c) => c.id)).toEqual([
      "C1",
      "C2",
      "C3",
    ]);
  });

  it("ignores a reorder that would leave the list", () => {
    useContractStore.setState({
      contracts: [contract("C1", 0), contract("C2", 1)],
      undoStack: [],
      redoStack: [],
    });

    useContractStore.getState().moveContract("C1", "up");
    useContractStore.getState().moveContract("C9", "down");

    expect(useContractStore.getState().contracts.map((c) => c.id)).toEqual([
      "C1",
      "C2",
    ]);
    expect(useContractStore.getState().canUndo()).toBe(false);
  });
});
