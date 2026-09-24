/**
 * Issue #1107: build ready-to-run Stellar CLI snippets for an XDR string.
 *
 * Pure string building so it can be unit-tested and reused by the copy button.
 */

export type XdrCliTarget = "xdr-decode" | "tx-submit";

export interface XdrCliTargetSpec {
  id: XdrCliTarget;
  /** Menu label shown in the picker. */
  label: string;
  /** Short hint describing what the command does. */
  hint: string;
  /** Flag the XDR payload is passed through. */
  flag: string;
}

export const XDR_CLI_TARGETS: XdrCliTargetSpec[] = [
  {
    id: "xdr-decode",
    label: "stellar xdr decode",
    hint: "Decode the XDR and print the typed value",
    flag: "--input",
  },
  {
    id: "tx-submit",
    label: "stellar tx submit",
    hint: "Submit a signed transaction envelope to the network",
    flag: "--tx",
  },
];

export function getXdrCliTarget(id: XdrCliTarget): XdrCliTargetSpec {
  return XDR_CLI_TARGETS.find((target) => target.id === id) ?? XDR_CLI_TARGETS[0];
}

export interface BuildXdrCliCommandOptions {
  /** Passed as `--type` for `stellar xdr decode` (skipped for transactions). */
  type?: string;
  /** Passed as `--network` when the command needs one. */
  network?: string;
}

/** Single-quote a shell argument, escaping embedded quotes (`'\''`). */
export function quoteShellArg(value: string): string {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

/**
 * Build the command line for one target. Whitespace inside the XDR payload is
 * stripped first — CLI flags cannot carry newlines from a pasted blob.
 */
export function buildXdrCliCommand(
  id: XdrCliTarget,
  xdr: string,
  options: BuildXdrCliCommandOptions = {},
): string {
  const payload = (xdr ?? "").replace(/\s+/g, "");
  if (!payload) return "";
  const target = getXdrCliTarget(id);
  const parts = ["stellar", ...target.label.split(" ").slice(1), target.flag, quoteShellArg(payload)];

  const type = (options.type ?? "").trim();
  if (id === "xdr-decode" && type && type !== "auto") {
    parts.push("--type", type);
  }

  const network = (options.network ?? "").trim();
  if (network) {
    parts.push("--network", network);
  }

  return parts.join(" ");
}
