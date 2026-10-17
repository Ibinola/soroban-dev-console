import { describe, expect, it } from "vitest";
import { MAX_ANNOTATION_LENGTH, transactionAnnotationId, validateAnnotation } from "./annotations";

describe("annotations (#1291)", () => {
  it("trims valid notes", () => {
    expect(validateAnnotation("  check this  ")).toEqual({ ok: true, value: "check this" });
  });

  it("rejects empty and whitespace-only notes", () => {
    expect(validateAnnotation("")).toMatchObject({ ok: false });
    expect(validateAnnotation("   \n ")).toMatchObject({ ok: false });
  });

  it("allows exactly 200 characters and rejects 201", () => {
    expect(validateAnnotation("x".repeat(MAX_ANNOTATION_LENGTH)).ok).toBe(true);
    const tooLong = validateAnnotation("x".repeat(MAX_ANNOTATION_LENGTH + 1));
    expect(tooLong).toMatchObject({ ok: false });
    expect((tooLong as { error: string }).error).toContain("200");
  });

  it("counts length after trimming", () => {
    expect(validateAnnotation(" ".repeat(50) + "x".repeat(200)).ok).toBe(true);
  });

  it("uses the transaction hash as the target id when there is one", () => {
    expect(transactionAnnotationId("abc", "local")).toBe("abc");
    expect(transactionAnnotationId(undefined, "local")).toBe("local");
    expect(transactionAnnotationId("", "local")).toBe("local");
  });
});
