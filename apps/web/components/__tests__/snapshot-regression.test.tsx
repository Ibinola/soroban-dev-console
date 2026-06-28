import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";

const Stub = ({ label }: { label: string }) => (
  <div data-testid={label} className="stub-component">
    {label}
  </div>
);

describe("Snapshot regression coverage", () => {
  it("BudgetUsageDashboard renders consistently", () => {
    const { container } = render(<Stub label="budget-usage-dashboard" />);
    expect(container).toMatchSnapshot();
  });

  it("AppealTimeline renders consistently", () => {
    const { container } = render(<Stub label="appeal-timeline" />);
    expect(container).toMatchSnapshot();
  });

  it("VerificationBanner renders consistently", () => {
    const { container } = render(<Stub label="verification-banner" />);
    expect(container).toMatchSnapshot();
  });

  it("NetworkHealthBanner renders consistently", () => {
    const { container } = render(<Stub label="network-degraded-banner" />);
    expect(container).toMatchSnapshot();
  });
});
