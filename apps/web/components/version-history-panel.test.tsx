import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { NormalizedContractSpec } from "@devconsole/soroban-utils";
import { VersionHistoryPanel } from "./version-history-panel";
import { useContractVersionStore } from "@/store/useContractVersionStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";

const fn = (name: string, type = "u32") => ({
  name,
  inputs: [{ name: "x", type: type as never, required: true }],
  outputs: [],
});
const spec = (...fns: ReturnType<typeof fn>[]): NormalizedContractSpec => ({
  source: "json",
  rawSpec: "",
  ingestedAt: 1,
  functions: fns,
});

describe("VersionHistoryPanel (#1292)", () => {
  const workspaceId = () => useWorkspaceStore.getState().activeWorkspaceId;

  beforeEach(() => {
    useContractVersionStore.setState({ snapshots: [] });
  });

  it("explains how versions get recorded when there are none", () => {
    render(<VersionHistoryPanel contractId="C1" currentSpec={undefined} />);
    expect(screen.getByText(/no versions recorded yet/i)).toBeInTheDocument();
  });

  it("lists recorded versions and shows the ABI of the selected one", () => {
    useContractVersionStore.getState().recordSnapshot({ workspaceId: workspaceId(), contractId: "C1", spec: spec(fn("old_fn")) });
    render(<VersionHistoryPanel contractId="C1" currentSpec={spec(fn("new_fn"))} />);

    expect(screen.getByText("Version history (1)")).toBeInTheDocument();
    // "Current" is shown first.
    expect(screen.getByText("new_fn(x: u32)")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("View ABI of"), {
      target: { value: screen.getAllByRole("option").find((o) => o.textContent?.startsWith("v1"))!.getAttribute("value") },
    });
    expect(screen.getByText("old_fn(x: u32)")).toBeInTheDocument();
  });

  it("diffs any two versions", () => {
    const { recordSnapshot } = useContractVersionStore.getState();
    recordSnapshot({ workspaceId: workspaceId(), contractId: "C1", spec: spec(fn("keep"), fn("gone")) });
    render(<VersionHistoryPanel contractId="C1" currentSpec={spec(fn("keep", "i128"), fn("fresh"))} />);

    const diff = within(screen.getByLabelText("ABI differences"));
    expect(diff.getByText(/gone/)).toBeInTheDocument();
    expect(diff.getByText(/fresh/)).toBeInTheDocument();
    expect(diff.getByText("removed")).toBeInTheDocument();
    expect(diff.getByText("added")).toBeInTheDocument();
    expect(diff.getByText("changed")).toBeInTheDocument();
    expect(diff.getByText(/input "x": u32 -> i128/)).toBeInTheDocument();
  });

  it("only shows snapshots for the given contract in the active workspace", () => {
    const { recordSnapshot } = useContractVersionStore.getState();
    recordSnapshot({ workspaceId: workspaceId(), contractId: "C1", spec: spec(fn("a")) });
    recordSnapshot({ workspaceId: workspaceId(), contractId: "C2", spec: spec(fn("b")) });
    recordSnapshot({ workspaceId: "another-workspace", contractId: "C1", spec: spec(fn("c")) });
    render(<VersionHistoryPanel contractId="C1" currentSpec={undefined} />);
    expect(screen.getByText("Version history (1)")).toBeInTheDocument();
  });
});
