"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  History,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Skeleton,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
} from "@devconsole/ui";

import {
  POLL_INTERVALS_MS,
  useEventLog,
  type PollIntervalMs,
} from "@/lib/hooks/useEventLog";

interface ContractEventsProps {
  contractId: string;
}

function parsePoll(value: string | null): PollIntervalMs {
  if (value === "off") return "off";
  const num = Number(value);
  if (
    Number.isFinite(num) &&
    (POLL_INTERVALS_MS as readonly number[]).includes(num)
  ) {
    return num as PollIntervalMs;
  }
  return "off";
}

function pollToUrlValue(p: PollIntervalMs): string {
  return p === "off" ? "off" : String(p);
}

function formatRelative(ts: number | null): string {
  if (!ts) return "never";
  const delta = Math.max(0, Date.now() - ts);
  if (delta < 1_500) return "just now";
  if (delta < 60_000) return `${Math.round(delta / 1_000)}s ago`;
  if (delta < 3_600_000) return `${Math.round(delta / 60_000)}m ago`;
  return new Date(ts).toLocaleTimeString();
}

export function ContractEvents({ contractId }: ContractEventsProps) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const initialPoll = parsePoll(params.get("poll"));
  const hook = useEventLog({
    contractId,
    initialPollInterval: initialPoll,
  });

  // Sync the polling interval selection into the URL so a refresh / deep
  // link restores the user's view of the log. Acceptance criterion: state
  // survives away-and-back navigation.
  useEffect(() => {
    const next = pollToUrlValue(hook.pollInterval);
    const current = params.get("poll");
    if (next !== current) {
      const sp = new URLSearchParams(params.toString());
      if (next === "off") sp.delete("poll");
      else sp.set("poll", next);
      const query = sp.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    }
  }, [hook.pollInterval, params, pathname, router]);

  // Re-tick the relative timestamp every second so "just now" stays fresh.
  const now = useRelativeNow(1000);

  const pollOptions = useMemo(
    () => [
      { value: "off", label: "Off" },
      ...POLL_INTERVALS_MS.map((ms) => ({
        value: String(ms),
        label: `${ms / 1000}s`,
      })),
    ],
    [],
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Contract Events
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {hook.totalCount} event{hook.totalCount === 1 ? "" : "s"} loaded ·
              refreshed {formatRelative(hook.lastRefreshedAt)} (now: {now})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={hook.pollInterval === "off" ? "secondary" : "default"}
              className="gap-1"
              data-testid="event-poll-status"
            >
              {hook.pollInterval === "off" ? (
                <>
                  <Pause className="h-3 w-3" />
                  Live: off
                </>
              ) : (
                <>
                  <Play className="h-3 w-3" />
                  Live: {hook.pollInterval / 1000}s
                </>
              )}
            </Badge>

            <Select
              value={pollToUrlValue(hook.pollInterval)}
              onValueChange={(v) => hook.setPollInterval(parsePoll(v))}
            >
              <SelectTrigger
                className="h-8 w-[110px]"
                aria-label="Auto-refresh interval"
              >
                <SelectValue placeholder="Refresh" />
              </SelectTrigger>
              <SelectContent>
                {pollOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              size="sm"
              variant="outline"
              onClick={() => void hook.refresh()}
              disabled={hook.loading}
              title="Refresh events now"
            >
              {hook.loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {hook.loading && hook.totalCount === 0 ? (
          <EventsSkeleton />
        ) : hook.error ? (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-md bg-red-50 p-4 text-sm text-red-500 dark:bg-red-950/30"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            {hook.error}
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ledger</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Topics</TableHead>
                  <TableHead className="text-right">Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hook.events.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No events found for this contract.
                    </TableCell>
                  </TableRow>
                ) : (
                  hook.events.map((evt) => {
                    const isFresh = hook.freshIds.has(evt.id);
                    return (
                      <TableRow
                        key={evt.id}
                        data-fresh={isFresh}
                        className={
                          isFresh
                            ? "bg-emerald-50/60 transition-colors duration-700 dark:bg-emerald-900/20"
                            : undefined
                        }
                      >
                        <TableCell className="font-mono text-xs">
                          <span className="inline-flex items-center gap-1">
                            {isFresh && (
                              <CheckCircle2
                                className="h-3 w-3 text-emerald-600"
                                aria-label="New since last refresh"
                              />
                            )}
                            {evt.ledger}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold">
                            {evt.type}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate font-mono text-xs text-muted-foreground">
                          {evt.topic.join(", ")}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-right font-mono text-xs">
                          {evt.data.slice(0, 20)}…
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {hook.loadingMore && <EventsSkeletonRows />}

            <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
              <span>
                {hook.hasNextPage
                  ? "More events available — paginated on demand."
                  : hook.totalCount === 0
                    ? "No events loaded yet."
                    : "End of available events."}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={!hook.hasNextPage || hook.loadingMore}
                onClick={() => void hook.loadMore()}
              >
                {hook.loadingMore ? (
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                ) : null}
                Load more
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function EventsSkeleton() {
  return (
    <div className="space-y-2 p-4">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-6 w-5/6" />
    </div>
  );
}

function EventsSkeletonRows() {
  return (
    <div
      aria-hidden
      className="space-y-2 border-t bg-muted/30 p-4"
      data-testid="event-loading-rows"
    >
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-5 w-full" />
      ))}
    </div>
  );
}

function useRelativeNow(intervalMs: number): string {
  // Lightweight "current time" hook used only to keep the "refreshed …
  // ago" string visible. Re-renders on a fixed cadence; cheap.
  const [stamp, setStamp] = useState<string>(() =>
    new Date().toLocaleTimeString(),
  );
  useEffect(() => {
    const id = setInterval(() => {
      setStamp(new Date().toLocaleTimeString());
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return stamp;
}
