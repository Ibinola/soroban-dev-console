"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@devconsole/ui";
import { Input } from "@devconsole/ui";
import { Label } from "@devconsole/ui";
import {
  ALL_EVENT_CSV_COLUMNS,
  EVENT_CSV_COLUMNS,
  eventsCsvFilename,
  eventsToCsv,
  filterEventsByDate,
  type EventCsvColumn,
  type ExportableEvent,
} from "@/lib/events-csv";

/** "Export CSV" button with column selection and date-range filtering. */
export function EventsExportMenu({
  contractId,
  events,
}: {
  contractId: string;
  events: ExportableEvent[];
}) {
  const [open, setOpen] = useState(false);
  const [columns, setColumns] = useState<EventCsvColumn[]>(ALL_EVENT_CSV_COLUMNS);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const rows = useMemo(() => filterEventsByDate(events, { from, to }), [events, from, to]);
  const invalidRange = from !== "" && to !== "" && from > to;

  const toggle = (key: EventCsvColumn) =>
    setColumns((current) => (current.includes(key) ? current.filter((c) => c !== key) : [...current, key]));

  const download = () => {
    const csv = eventsToCsv(rows, columns);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = eventsCsvFilename(contractId);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  return (
    <div className="relative">
      <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Download className="mr-1 h-3 w-3" />
        Export CSV
      </Button>
      {open && (
        <div
          role="dialog"
          aria-label="Export events"
          className="absolute right-0 z-20 mt-2 w-72 space-y-3 rounded-md border bg-background p-3 shadow-md"
        >
          <fieldset className="space-y-1">
            <legend className="text-xs font-semibold">Columns</legend>
            {EVENT_CSV_COLUMNS.map((c) => (
              <label key={c.key} className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={columns.includes(c.key)} onChange={() => toggle(c.key)} />
                {c.label}
              </label>
            ))}
          </fieldset>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="events-export-from" className="text-xs">From</Label>
              <Input id="events-export-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="events-export-to" className="text-xs">To</Label>
              <Input id="events-export-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          {invalidRange && <p className="text-xs text-destructive">“From” must not be after “To”.</p>}
          <p className="text-xs text-muted-foreground">
            {rows.length} of {events.length} event{events.length === 1 ? "" : "s"} will be exported.
          </p>
          <Button
            size="sm"
            className="w-full"
            onClick={download}
            disabled={columns.length === 0 || invalidRange || rows.length === 0}
          >
            Download
          </Button>
        </div>
      )}
    </div>
  );
}
