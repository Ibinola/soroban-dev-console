import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReadOnlyBanner } from "./read-only-banner";

describe("<ReadOnlyBanner /> (issue #1118)", () => {
  it("renders the read-only preview messaging", () => {
    render(<ReadOnlyBanner />);
    expect(screen.getByTestId("read-only-banner")).toBeInTheDocument();
    expect(
      screen.getByText(/Read-Only Shared Workspace Preview/i),
    ).toBeInTheDocument();
  });

  it("does not render a fork button when no onFork handler is given", () => {
    render(<ReadOnlyBanner />);
    expect(
      screen.queryByTestId("read-only-banner-fork-button"),
    ).not.toBeInTheDocument();
  });

  it("renders a prominent Fork CTA that invokes onFork when clicked", () => {
    const onFork = vi.fn();
    render(<ReadOnlyBanner onFork={onFork} />);

    const button = screen.getByTestId("read-only-banner-fork-button");
    expect(button).toBeInTheDocument();
    expect(button).toBeEnabled();

    fireEvent.click(button);
    expect(onFork).toHaveBeenCalledTimes(1);
  });

  it("disables the fork CTA and shows an Expired badge for expired links", () => {
    const onFork = vi.fn();
    render(<ReadOnlyBanner isExpired onFork={onFork} />);

    expect(screen.getByText("Expired")).toBeInTheDocument();
    expect(screen.getByTestId("read-only-banner-fork-button")).toBeDisabled();

    fireEvent.click(screen.getByTestId("read-only-banner-fork-button"));
    expect(onFork).not.toHaveBeenCalled();
  });
});
