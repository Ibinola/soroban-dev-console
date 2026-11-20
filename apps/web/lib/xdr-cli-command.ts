/**
 * Issue #1107: generate a ready-to-run Stellar CLI command for the
 * currently-decoded XDR payload.
 *
 * Both commands read the XDR from stdin (`echo '<xdr>' | stellar ...`)
 * rather than a positional/flag argument, since that form is documented and
 * works across stellar-cli versions regardless of exact flag names for a
 * given subcommand.
 */

export type XdrCliCommandType = "xdr-decode" | "tx-submit";

export const XDR_CLI_COMMAND_LABELS: Record<XdrCliCommandType, string> = {
  "xdr-decode": "stellar xdr decode",
  "tx-submit": "stellar tx submit",
};

/** Shell-quote a value for safe embedding in a single-quoted string. */
function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export interface BuildCliCommandOptions {
  xdr: string;
  commandType: XdrCliCommandType;
  /** XDR type hint (e.g. "TransactionEnvelope"), passed as --type when decoding and not "auto". */
  typeHint?: string;
}

export function buildStellarCliCommand({ xdr, commandType, typeHint }: BuildCliCommandOptions): string {
  const piped = `echo ${shellQuote(xdr)} |`;

  if (commandType === "xdr-decode") {
    const typeFlag = typeHint && typeHint !== "auto" ? ` --type ${shellQuote(typeHint)}` : "";
    return `${piped} stellar xdr decode${typeFlag}`;
  }

  return `${piped} stellar tx submit`;
}
