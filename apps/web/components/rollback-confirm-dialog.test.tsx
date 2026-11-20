import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DeploymentLogEntry } from "@/store/useDeploymentLogStore";
import { RollbackConfirmDialog } from "./rollback-confirm-dialog";

const entry = (id: string, hash: string): DeploymentLogEntry => ({
  id,
  timestamp: 1_700_000_000_000,
  wasmFileName: `${id}.wasm`,
  wasmHash: hash.repeat(64),
  salt: null,
  contractId: "CABC",
  txHash: null,
  status: "success",
  network: "testnet",
});

const target = { current: entry("cur", "c"), previous: entry("prev", "b") };

describe("RollbackConfirmDialog", () => {
  it("shows the previous version details", () => {
    render(<RollbackConfirmDialog target={target} open onOpenChange={() => {}} onConfirm={() => {}} />);
    expect(screen.getByText(/Previous: b{64}/)).toBeInTheDocument();
    expect(screen.getByText(/Previous: prev\.wasm/)).toBeInTheDocument();
  });

  it("requires acknowledgement before confirming", () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(<RollbackConfirmDialog target={target} open onOpenChange={onOpenChange} onConfirm={onConfirm} />);
    const confirm = screen.getByRole("button", { name: /use previous version/i });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith(target);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders nothing without a rollback target", () => {
    const { container } = render(
      <RollbackConfirmDialog target={null} open onOpenChange={() => {}} onConfirm={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
