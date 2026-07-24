"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { rpc as SorobanRpc } from "@stellar/stellar-sdk";
import { useNetworkStore } from "@/store/useNetworkStore";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  Pause,
  Play,
  Sparkles,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@devconsole/ui";
import { Card, CardContent } from "@devconsole/ui";
import { Badge } from "@devconsole/ui";
import { Button } from "@devconsole/ui";
import { Skeleton } from "@devconsole/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@devconsole/ui";

const PAGE_SIZE = 20;

type RefreshInterval = "off" | "5s" | "15s" | "30s";
const REFRESH_OPTIONS: Array<{ label: RefreshInterval; ms: number }> = [
  { label: "off", ms: 0 },
  { label: "5s", ms: 5_000 },
  { label: "15s", ms: 15_000 },
  { label: "30s", ms: 30_000 },
];

interface ContractEventsProps {
  contractId: string;
}

interface EventRecord {
  id: string;
  type: string;
  topic: any[]; // Decoded or raw
  data: string;
  ledger: number;
  ts: string;
}

export function ContractEvents({ contractId }: ContractEventsProps) {
  const { getActiveNetworkConfig } = useNetworkStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [events, setEvents] = useState<EventRecord[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());
  const refreshIntervalMs = useRef<number>(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // Decode pagination/refresh state from URL search params so the view
  // restores when the user navigates back.
  const urlCursor = searchParams.get("cursor");
  const urlRefresh = (searchParams.get("refresh") as RefreshInterval | null) ??
    "off";

  const updateUrlState = useCallback(
    (nextCursor: string | null, refresh: RefreshInterval) => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextCursor) params.set("cursor", nextCursor);
      else params.delete("cursor");
      if (refresh && refresh !== "off") params.set("refresh", refresh);
      else params.delete("refresh");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  const fetchPage = useCallback(
    async (
      mode: "initial" | "more" | "poll",
      resumeCursor: string | null,
    ): Promise<void> => {
      if (!mountedRef.current) return;

      if (mode === "initial") setLoading(true);
      if (mode === "more") setLoadingMore(true);
      if (mode === "poll") setPolling(true);
      setError("");

      try {
        const network = getActiveNetworkConfig();
        const server = new SorobanRpc.Server(network.rpcUrl);

        const request: SorobanRpc.Api.GetEventsRequest = resumeCursor
          ? {
              filters: [{ type: "contract", contractIds: [contractId] }],
              cursor: resumeCursor,
              limit: PAGE_SIZE,
            }
          : {
              filters: [{ type: "contract", contractIds: [contractId] }],
              startLedger: 0,
              limit: PAGE_SIZE,
            };

        const response = await server.getEvents(request);

        const formatted: EventRecord[] = response.events.map((evt) => ({
          id: evt.id,
          type: evt.type,
          topic: evt.topic,
          data:
            typeof evt.value === "string"
              ? evt.value
              : JSON.stringify(evt.value),
          ledger: evt.ledger,
          ts: evt.ledgerClosedAt,
        }));

        if (!mountedRef.current) return;

        setCursor(response.cursor || null);
        setHasMore(Boolean(response.cursor) && formatted.length >= PAGE_SIZE);
        setLastRefreshed(new Date());

        if (mode === "more") {
          // Pagination — append older events to the bottom.
          setEvents((prev) => {
            const merged = [...prev, ...formatted];
            return merged;
          });
        } else {
          // Initial load or poll — highlight brand-new events at the top.
          const existingIds = new Set(eventsRef.current.map((e) => e.id));
          const freshIds = formatted.filter((e) => !existingIds.has(e.id));
          setEvents(() => formatted);
          setHighlighted((prev) => {
            const next = new Set(prev);
            freshIds.forEach((e) => next.add(e.id));
            return next;
          });
          // Clear highlight after a short window so the cue fades out.
          if (freshIds.length > 0) {
            const flashIds = freshIds.map((e) => e.id);
            setTimeout(() => {
              if (!mountedRef.current) return;
              setHighlighted((prev) => {
                const next = new Set(prev);
                flashIds.forEach((id) => next.delete(id));
                return next;
              });
            }, 3_000);
          }
        }
      } catch (err: any) {
        console.error(err);
        setError("Failed to fetch events. Ensure the RPC supports getEvents.");
      } finally {
        if (!mountedRef.current) return;
        setLoading(false);
        setLoadingMore(false);
        setPolling(false);
      }
    },
    // getActiveNetworkConfig is intentionally omitted — it's a Zustand
    // selector that returns a fresh object on every render, which would
    // re-trigger our fetch loop. We resolve the value at fetch time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contractId],
  );

  // Keep a stable reference to the latest events list so the polling
  // merge logic can diff against it without re-creating fetchPage.
  const eventsRef = useRef<EventRecord[]>([]);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const refreshInterval = useMemo<RefreshInterval>(() => {
    return REFRESH_OPTIONS.some((o) => o.label === urlRefresh)
      ? urlRefresh
      : "off";
  }, [urlRefresh]);

  refreshIntervalMs.current =
    REFRESH_OPTIONS.find((o) => o.label === refreshInterval)?.ms ?? 0;

  const handleRefreshChange = (next: RefreshInterval) => {
    updateUrlState(cursor, next);
  };

  const handleLoadMore = () => {
    if (loadingMore || polling) return;
    if (cursor) {
      void fetchPage("more", cursor);
    } else {
      // No backend cursor yet — issue another initial-style fetch.
      void fetchPage("initial", null);
    }
  };

  const handleManualRefresh = () => {
    void fetchPage("initial", null);
  };

  // Initial load on mount / contractId change only. URL cursor is
  // intentionally ignored on first mount so the user always sees the
  // newest events when re-entering the page; subsequent paging uses
  // local state. `mountedRef` is initialized to `true` at component
  // body so async resolves that arrive during the brief unmount window
  // of a contractId change cannot reach `setEvents`.
  useEffect(() => {
    mountedRef.current = true;
    setEvents([]);
    setCursor(null);
    setHasMore(true);
    setHighlighted(new Set());
    setLoading(true);
    void fetchPage("initial", null);

    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId]);

  // Auto-refresh (poll) — fires every refreshIntervalMs, fetching the
  // newest events and highlighting anything new.
  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    const ms = refreshIntervalMs.current;
    if (!ms || ms <= 0) return;

    pollRef.current = setInterval(() => {
      void fetchPage("poll", null);
    }, ms);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshInterval, contractId]);

  if (loading && events.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-3 p-4" aria-live="polite">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (error && events.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-red-50 p-4 text-sm text-red-500">
        <AlertCircle className="h-4 w-4" />
        {error}
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono">
              {events.length} event{events.length === 1 ? "" : "s"}
            </Badge>
            {lastRefreshed && (
              <span aria-label="Last refreshed">
                Last refreshed {lastRefreshed.toLocaleTimeString()}
              </span>
            )}
            {polling && (
              <span className="flex items-center gap-1 text-blue-600">
                <Loader2 className="h-3 w-3 animate-spin" /> polling…
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Select value={refreshInterval} onValueChange={(v) => handleRefreshChange(v as RefreshInterval)}>
              <SelectTrigger className="h-8 w-[110px]" aria-label="Auto-refresh interval">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">
                  <span className="flex items-center gap-1">
                    <Pause className="h-3 w-3" /> Off
                  </span>
                </SelectItem>
                <SelectItem value="5s">every 5s</SelectItem>
                <SelectItem value="15s">every 15s</SelectItem>
                <SelectItem value="30s">every 30s</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={handleManualRefresh}
              disabled={loading || loadingMore || polling}
              aria-label="Manually refresh events"
            >
              <RefreshCw
                className={`mr-1 h-3 w-3 ${polling || loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ledger</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Topics (Raw)</TableHead>
              <TableHead className="text-right">Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-24 text-center text-muted-foreground"
                >
                  No events found for this contract.
                </TableCell>
              </TableRow>
            ) : (
              events.map((evt) => (
                <TableRow
                  key={evt.id}
                  className={
                    highlighted.has(evt.id)
                      ? "bg-green-50/60 transition-colors duration-700 dark:bg-green-900/20"
                      : undefined
                  }
                >
                  <TableCell className="font-mono text-xs">
                    {evt.ledger}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold">
                      {evt.type}
                      {highlighted.has(evt.id) && (
                        <Sparkles className="h-3 w-3 text-green-600" />
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate font-mono text-xs text-muted-foreground">
                    {evt.topic.join(", ")}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-right font-mono text-xs">
                    {evt.data.slice(0, 20)}...
                  </TableCell>
                </TableRow>
              ))
            )}
            {loadingMore && (
              <>
                {Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={`skel-${i}`} aria-hidden="true">
                    <TableCell colSpan={4}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              </>
            )}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {cursor ? `Cursor: ${cursor.slice(0, 16)}…` : "Beginning of history"}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadMore}
            disabled={!hasMore || loadingMore || polling}
            aria-label="Load more events"
          >
            {loadingMore ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Loading…
              </>
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
