import { describe, expect, it } from "vitest";
import { getBreadcrumbItems } from "./breadcrumb-utils";

describe("getBreadcrumbItems", () => {
  it("builds linked trails for nested contract, deploy, tool, and transaction routes", () => {
    expect(getBreadcrumbItems("/contracts/CA1234567890ABCDEFGH")).toEqual([
      { label: "Home", href: "/" },
      { label: "Contracts", href: "/contracts" },
      {
        label: "CA1234...EFGH",
        accessibleLabel: "CA1234567890ABCDEFGH",
        href: "/contracts/CA1234567890ABCDEFGH",
      },
    ]);
    expect(
      getBreadcrumbItems("/deploy/wasm")?.map(({ label }) => label),
    ).toEqual(["Home", "Deploy", "WASM Registry"]);
    expect(
      getBreadcrumbItems("/tools/xdr")?.map(({ label }) => label),
    ).toEqual(["Home", "Tools", "XDR Decoder"]);
    expect(getBreadcrumbItems("/tx/abc123")?.map(({ href }) => href)).toEqual([
      "/",
      "/tx",
      "/tx/abc123",
    ]);
  });

  it("keeps short contract identifiers intact and ignores unsupported routes", () => {
    expect(getBreadcrumbItems("/contracts/short")?.at(-1)?.label).toBe("short");
    expect(getBreadcrumbItems("/contracts/a/b")).toBeNull();
    expect(getBreadcrumbItems("/")).toBeNull();
  });
});
