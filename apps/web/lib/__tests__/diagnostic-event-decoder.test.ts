import { describe, expect, it } from "vitest";
import {
  DIAGNOSTIC_SEVERITY_REGEX,
  classifyDiagnosticSeverity,
  decodeDiagnosticEvents,
} from "../diagnostic-event-decoder";

describe("diagnostic-event-decoder severity classification", () => {
  it("classifies failed contract call events as ERROR", () => {
    expect(
      classifyDiagnosticSeverity({
        topics: ["debug"],
        data: "anything",
        inSuccessfulContractCall: false,
      }),
    ).toBe("ERROR");
  });

  it("matches ERROR level by regex", () => {
    expect(DIAGNOSTIC_SEVERITY_REGEX.ERROR.test("fatal panic occurred")).toBe(true);
    expect(
      classifyDiagnosticSeverity({
        topics: ["contract", "exception thrown"],
        data: null,
        inSuccessfulContractCall: true,
      }),
    ).toBe("ERROR");
  });

  it("matches WARN level by regex", () => {
    expect(DIAGNOSTIC_SEVERITY_REGEX.WARN.test("warning: low budget")).toBe(true);
    expect(
      classifyDiagnosticSeverity({
        topics: ["warn"],
        data: "retry recommended",
        inSuccessfulContractCall: true,
      }),
    ).toBe("WARN");
  });

  it("matches INFO level by regex", () => {
    expect(DIAGNOSTIC_SEVERITY_REGEX.INFO.test("info event emitted")).toBe(true);
    expect(
      classifyDiagnosticSeverity({
        topics: ["log"],
        data: "hello",
        inSuccessfulContractCall: true,
      }),
    ).toBe("INFO");
  });

  it("matches DEBUG level by regex", () => {
    expect(DIAGNOSTIC_SEVERITY_REGEX.DEBUG.test("trace details")).toBe(true);
    expect(
      classifyDiagnosticSeverity({
        topics: ["debug"],
        data: { verbose: true },
        inSuccessfulContractCall: true,
      }),
    ).toBe("DEBUG");
  });

  it("decodes events with severity tags", () => {
    const decoded = decodeDiagnosticEvents([
      { topics: ["info"], data: "ok", inSuccessfulContractCall: true },
      { topics: ["debug"], data: "details", inSuccessfulContractCall: true },
    ]);
    expect(decoded.map((d) => d.severity)).toEqual(["INFO", "DEBUG"]);
    expect(decoded[0].isError).toBe(false);
  });
});
