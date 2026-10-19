/**
 * Issue #1285: bulk contract addition via CSV or a pasted address list.
 *
 * Parsing and validation are pure functions so the import UI can highlight the
 * offending lines without touching the store or the network. Address validity
 * is delegated to `StrKey.isValidContract`, the same check the invocation forms
 * use, so anything accepted here can be called immediately.
 */

import { StrKey } from "@stellar/stellar-sdk";

/** Issue #1285: hard upper bound for a single bulk import. */
export const MAX_BULK_IMPORT_ADDRESSES = 100;

export interface ContractAddressParseResult {
  /** Valid, de-duplicated contract addresses, in input order. */
  valid: string[];
  /** Entries that could not be parsed or failed StrKey validation. */
  invalid: Array<{ line: number; value: string; reason: string }>;
  /** Entries skipped because they exceeded the import cap. */
  skipped: Array<{ line: number; value: string; reason: string }>;
}

/** True when `value` is a well-formed contract address. */
export function isValidContractAddress(value: string): boolean {
  try {
    return StrKey.isValidContract(value.trim());
  } catch {
    return false;
  }
}

/**
 * Split a CSV line into cells, honouring double-quoted values.
 * Kept intentionally small: it covers the quoting the export produces, which is
 * all a round-tripped workspace file contains.
 */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index++) {
    const char = line[index];

    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index++;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function isHeaderRow(cells: string[]): boolean {
  return cells.some((cell) => {
    const normalized = cell.trim().toLowerCase();
    return (
      normalized === "contract" ||
      normalized === "contractid" ||
      normalized === "address"
    );
  });
}

/**
 * Parse pasted text (one address per line) or CSV content into contract
 * addresses. Each non-empty line is treated as one entry; when a line contains
 * multiple CSV cells, the first cell holding an address wins and the rest are
 * only used as metadata (e.g. a label in column two).
 */
export function parseContractAddressList(
  input: string,
  options: { maxAddresses?: number } = {},
): ContractAddressParseResult {
  const maxAddresses = options.maxAddresses ?? MAX_BULK_IMPORT_ADDRESSES;
  const valid: string[] = [];
  const invalid: ContractAddressParseResult["invalid"] = [];
  const skipped: ContractAddressParseResult["skipped"] = [];

  const lines = input.split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) return;

    const cells = splitCsvLine(line);
    if (isHeaderRow(cells)) return;

    const candidate =
      cells.find((cell) => isValidContractAddress(cell)) ?? cells[0] ?? "";

    if (!isValidContractAddress(candidate)) {
      invalid.push({
        line: index + 1,
        value: candidate || line,
        reason: "Not a valid contract address",
      });
      return;
    }

    if (valid.includes(candidate)) return;

    if (valid.length >= maxAddresses) {
      skipped.push({
        line: index + 1,
        value: candidate,
        reason: `Exceeds the ${maxAddresses} address import limit`,
      });
      return;
    }

    valid.push(candidate);
  });

  return { valid, invalid, skipped };
}

/**
 * Issue #1285: parse the contents of an uploaded CSV file.
 *
 * Every row is flattened to its cells and each cell is checked individually, so
 * a single-column file (plain addresses) and a labelled export
 * (`address,label`) are both accepted.
 */
export function parseContractCsv(
  content: string,
  options: { maxAddresses?: number } = {},
): ContractAddressParseResult {
  return parseContractAddressList(content, options);
}
