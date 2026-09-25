import { describe, it, expect } from "vitest";
import { isAcceptedXdrFile, readXdrFileAsText } from "./xdr-file-reader";

describe("isAcceptedXdrFile (issue #1102)", () => {
  it("accepts .xdr, .base64, and .txt extensions", () => {
    expect(isAcceptedXdrFile("payload.xdr")).toBe(true);
    expect(isAcceptedXdrFile("payload.base64")).toBe(true);
    expect(isAcceptedXdrFile("payload.txt")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isAcceptedXdrFile("PAYLOAD.XDR")).toBe(true);
  });

  it("rejects unsupported extensions", () => {
    expect(isAcceptedXdrFile("payload.json")).toBe(false);
    expect(isAcceptedXdrFile("payload.exe")).toBe(false);
    expect(isAcceptedXdrFile("payload")).toBe(false);
  });
});

describe("readXdrFileAsText (issue #1102)", () => {
  it("resolves with the trimmed text contents of the file", async () => {
    const file = new File(["  AAAAAgAAAAB7v2dX  \n"], "payload.xdr", {
      type: "text/plain",
    });
    const text = await readXdrFileAsText(file);
    expect(text).toBe("AAAAAgAAAAB7v2dX");
  });
});
