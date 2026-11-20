import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContractMethodListSkeleton } from "./contract-method-list-skeleton";

describe("ContractMethodListSkeleton", () => {
  it("renders five method placeholders with responsive counts", () => {
    render(<ContractMethodListSkeleton />);

    expect(screen.getByRole("status", { name: "Loading contract methods" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getAllByTestId("method-skeleton-item")).toHaveLength(5);
    expect(screen.getAllByTestId("method-skeleton-item")[2]).not.toHaveClass("hidden");
    expect(screen.getAllByTestId("method-skeleton-item")[3]).toHaveClass("hidden", "sm:flex");
    expect(screen.getAllByTestId("method-skeleton-item")[4]).toHaveClass("hidden", "lg:flex");
  });
});
