/**
 * FE-233 / FE-234: Regression tests for ReadOnlyBanner and useAppToast.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { ReadOnlyBanner } from "../read-only-banner";

// ---------------------------------------------------------------------------
// ReadOnlyBanner
// ---------------------------------------------------------------------------

vi.mock("@devconsole/ui", () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="badge" className={className}>{children}</span>
  ),
}));

vi.mock("lucide-react", () => ({
  Eye: ({ className, ...rest }: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="eye-icon" className={className} {...rest} />
  ),
}));

describe("ReadOnlyBanner", () => {
  it("renders with role=status and read-only text", () => {
    render(<ReadOnlyBanner />);
    const banner = screen.getByRole("status");
    expect(banner).toBeTruthy();
    expect(banner.getAttribute("data-testid")).toBe("read-only-banner");
    expect(banner.textContent).toContain("Read-only");
  });

  it("does not show Expired badge when isExpired is false", () => {
    render(<ReadOnlyBanner isExpired={false} />);
    expect(screen.queryByTestId("badge")).toBeNull();
  });

  it("shows Expired badge when isExpired is true", () => {
    render(<ReadOnlyBanner isExpired />);
    const badge = screen.getByTestId("badge");
    expect(badge.textContent).toContain("Expired");
  });

  it("has aria-label describing the widget", () => {
    render(<ReadOnlyBanner />);
    const banner = screen.getByRole("status");
    expect(banner.getAttribute("aria-label")).toBe("Read-only workspace");
  });
});

// ---------------------------------------------------------------------------
// useAppToast
// ---------------------------------------------------------------------------

import { useAppToast } from "@/hooks/use-app-toast";
import * as sonner from "sonner";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

describe("useAppToast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("success calls toast.success with 4s duration", () => {
    const { result } = renderHook(() => useAppToast());
    result.current.success("Done!");
    expect(sonner.toast.success).toHaveBeenCalledWith("Done!", { duration: 4000 });
  });

  it("error calls toast.error with 6s duration", () => {
    const { result } = renderHook(() => useAppToast());
    result.current.error("Failed!");
    expect(sonner.toast.error).toHaveBeenCalledWith("Failed!", { duration: 6000 });
  });

  it("warning calls toast.warning with 5s duration", () => {
    const { result } = renderHook(() => useAppToast());
    result.current.warning("Careful!");
    expect(sonner.toast.warning).toHaveBeenCalledWith("Careful!", { duration: 5000 });
  });

  it("info calls toast.info with 4s duration", () => {
    const { result } = renderHook(() => useAppToast());
    result.current.info("FYI");
    expect(sonner.toast.info).toHaveBeenCalledWith("FYI", { duration: 4000 });
  });

  it("loading calls toast.loading", () => {
    const { result } = renderHook(() => useAppToast());
    result.current.loading("Loading…");
    expect(sonner.toast.loading).toHaveBeenCalledWith("Loading…", {});
  });

  it("success passes through description and id options", () => {
    const { result } = renderHook(() => useAppToast());
    result.current.success("Saved", { description: "All good", id: "t1" });
    expect(sonner.toast.success).toHaveBeenCalledWith("Saved", {
      duration: 4000,
      description: "All good",
      id: "t1",
    });
  });
});
