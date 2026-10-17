export interface ExportableEvent {
  id: string;
  /** ISO timestamp the ledger closed at. */
  ts: string;
  type: string;
  topic: unknown[];
  data: string;
  txHash?: string;
  ledger: number;
}

export type EventCsvColumn = "timestamp" | "topic" | "data" | "txHash" | "ledger";

export const EVENT_CSV_COLUMNS: { key: EventCsvColumn; label: string; header: string }[] = [
  { key: "timestamp", label: "Timestamp", header: "timestamp" },
  { key: "topic", label: "Topic", header: "topic" },
  { key: "data", label: "Data", header: "data" },
  { key: "txHash", label: "Transaction hash", header: "transaction_hash" },
  { key: "ledger", label: "Ledger sequence", header: "ledger_sequence" },
];

export const ALL_EVENT_CSV_COLUMNS: EventCsvColumn[] = EVENT_CSV_COLUMNS.map((c) => c.key);

/** RFC 4180 escaping, plus a leading quote on spreadsheet-formula prefixes. */
export function escapeCsvField(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  // Prevent CSV injection: cells starting with these are evaluated by spreadsheets.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function topicText(topic: unknown[]): string {
  return topic.map((t) => (typeof t === "string" ? t : JSON.stringify(t))).join("/");
}

/** Keeps events whose timestamp is within [from, to] (inclusive; date-only `to` covers the whole day). */
export function filterEventsByDate<T extends { ts: string }>(
  events: T[],
  range: { from?: string; to?: string },
): T[] {
  const from = range.from ? Date.parse(`${range.from}T00:00:00.000Z`) : Number.NEGATIVE_INFINITY;
  const to = range.to ? Date.parse(`${range.to}T23:59:59.999Z`) : Number.POSITIVE_INFINITY;
  return events.filter((e) => {
    const t = Date.parse(e.ts);
    return !Number.isNaN(t) && t >= from && t <= to;
  });
}

export function eventsToCsv(events: ExportableEvent[], columns: EventCsvColumn[] = ALL_EVENT_CSV_COLUMNS): string {
  const selected = EVENT_CSV_COLUMNS.filter((c) => columns.includes(c.key));
  const lines = [selected.map((c) => c.header).join(",")];
  for (const e of events) {
    const cells: Record<EventCsvColumn, unknown> = {
      timestamp: e.ts,
      topic: topicText(e.topic),
      data: e.data,
      txHash: e.txHash ?? "",
      ledger: e.ledger,
    };
    lines.push(selected.map((c) => escapeCsvField(cells[c.key])).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

/** `{contractId}-events-{YYYY-MM-DD}.csv` */
export function eventsCsvFilename(contractId: string, now: Date = new Date()): string {
  return `${contractId}-events-${now.toISOString().slice(0, 10)}.csv`;
}
