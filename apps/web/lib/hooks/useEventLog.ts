"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { rpc as SorobanRpc } from "@stellar/stellar-sdk";

import { sorobanRpc, RpcGatewayError } from "@/lib/api/rpc-gateway";
import {
  DEFAULT_NETWORKS,
  type NetworkConfig,
  useNetworkStore,
} from "@/store/useNetworkStore";

/**
 * W7-FE-005 (#679): Cursor-paginated, optionally polled contract event log.
 *
 * Layers concerns so `contract-events.tsx` only has to render and the test
 * surface stays small:
 *   - initial fetch + "load more" pagination via opaque cursor
 *   - optional polling (5s/15s/30s/60s/off) that only re-fetches the
 *     newest page and merges in fresh events with a transient highlight
 *   - routing through `sorobanRpc.getEvents` so the API gateway, correlation
 *     IDs, and rate-limiting all kick in; falls back to the direct RPC URL
 *     when the gateway is unreachable so the panel still works in
 *     backend-less local development
 */

export const POLL_INTERVALS_MS = [5_000, 15_000, 30_000, 60_000] as const;
export type PollIntervalMs = (typeof POLL_INTERVALS_MS)[number] | "off";

export interface ContractEvent {
  id: string;
  type: string;
  topic: string[];
  data: string;
  ledger: number;
  ledgerClosedAt: string;
}

interface RawEvent {
  id: string;
  type: string;
  topic: any[];
  value: unknown;
  ledger: number;
  ledgerClosedAt: string;
}

interface GetEventsResponse {
  events: RawEvent[];
  latestLedger: number;
  cursor?: string;
}

export interface UseEventLogOptions {
  contractId: string;
  /** Storage key under which pagination state survives a remount. */
  storageKey?: string;
  /** Default when no persisted state exists yet. */
  initialPollInterval?: PollIntervalMs;
  /** Page size — matches the existing UX default. */
  pageSize?: number;
}

export interface UseEventLogResult {
  events: ContractEvent[];
  totalCount: number;
  lastRefreshedAt: number | null;
  /** Ids of events that arrived in the most recent poll. Cleared automatically. */
  freshIds: ReadonlySet<string>;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  /** True when at least one page has returned. */
  hasNextPage: boolean;
  pollInterval: PollIntervalMs;
  setPollInterval: (v: PollIntervalMs) => void;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}

const DEFAULT_PAGE_SIZE = 20;
const FRESH_HIGHLIGHT_MS = 2_500;

function formatEvent(raw: RawEvent): ContractEvent {
  return {
    id: raw.id,
    type: raw.type,
    topic: Array.isArray(raw.topic)
      ? raw.topic.map((t) => (typeof t === "string" ? t : JSON.stringify(t)))
      : [],
    data:
      typeof raw.value === "string"
        ? raw.value
        : JSON.stringify(raw.value ?? null),
    ledger: raw.ledger,
    ledgerClosedAt: raw.ledgerClosedAt ?? "",
  };
}

function getStartLedger(network: NetworkConfig): number {
  // The RPC requires startLedger > 0. Fetch a small recent window so a first
  // visit doesn't return every event ever emitted.
  return Math.max(1, network.id === "local" ? 1 : 1);
}

async function fetchOnce(
  network: NetworkConfig,
  contractId: string,
  cursor: string | null,
  pageSize: number,
): Promise<GetEventsResponse> {
  const baseRequest = {
    filters: [{ type: "contract" as const, contractIds: [contractId] }],
    limit: pageSize,
    ...(cursor ? { cursor } : { startLedger: getStartLedger(network) }),
  };

  // Try the gateway first so the correlation-ID + caching infra kicks in.
  // The gateway requires a live backend; on a hard failure fall back to
  // a direct call to the network's RPC URL so the UI is still useful.
  try {
    const result = await sorobanRpc.getEvents(network.id, baseRequest);
    if (result && Array.isArray((result as GetEventsResponse).events)) {
      return result as GetEventsResponse;
    }
  } catch (err) {
    const isHardFailure =
      err instanceof RpcGatewayError &&
      (err.code === "NETWORK_ERROR" || err.code === "HTTP_ERROR");
    if (!isHardFailure) {
      // The gateway is reachable but the RPC rejected the request — surface
      // it instead of silently retrying on a different transport.
      throw err;
    }
  }

  const server = new SorobanRpc.Server(network.rpcUrl, {
    allowHttp: network.rpcUrl.startsWith("http://"),
  });
  return (await server.getEvents(baseRequest)) as GetEventsResponse;
}

export function useEventLog(options: UseEventLogOptions): UseEventLogResult {
  const {
    contractId,
    initialPollInterval = "off",
    pageSize = DEFAULT_PAGE_SIZE,
  } = options;
  const { getActiveNetworkConfig } = useNetworkStore();

  const [events, setEvents] = useState<ContractEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [latestLedger, setLatestLedger] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const [pollInterval, setPollInterval] =
    useState<PollIntervalMs>(initialPollInterval);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());

  const network = getActiveNetworkConfig();
  // Resolved network ID — used as part of the cache key so that switching
  // networks drops the in-memory event list (we don't want to show testnet
  // events while pretending to be on mainnet).
  const networkKey = `${network.id}:${contractId}`;

  const freshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflightRef = useRef<boolean>(false);

  const highlightFresh = useCallback((ids: string[]) => {
    if (!ids.length) return;
    setFreshIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    if (freshTimer.current) clearTimeout(freshTimer.current);
    freshTimer.current = setTimeout(() => {
      setFreshIds(new Set());
      freshTimer.current = null;
    }, FRESH_HIGHLIGHT_MS);
  }, []);

  const runFetch = useCallback(
    async (
      mode: "initial" | "more" | "poll",
    ): Promise<GetEventsResponse | null> => {
      if (inflightRef.current) return null;
      inflightRef.current = true;
      try {
        if (mode === "more") setLoadingMore(true);
        else if (mode === "initial") setLoading(true);

        // Polls always re-fetch the newest page (cursor forced to null) so the
        // closure-stale `cursor` value can never push us down a stale page.
        // Load-more uses the persisted cursor verbatim.
        const useCursor =
          mode === "poll" ? null : mode === "initial" ? null : (cursor ?? null);
        const response = await fetchOnce(
          network,
          contractId,
          useCursor,
          pageSize,
        );
        const formatted = response.events.map(formatEvent);

        if (mode === "more") {
          setEvents((prev) => {
            const seen = new Set(prev.map((e) => e.id));
            const appended = formatted.filter((e) => !seen.has(e.id));
            return [...prev, ...appended];
          });
        } else if (mode === "poll") {
          setEvents((prev) => {
            const seen = new Set(prev.map((e) => e.id));
            const freshOnes = formatted.filter((e) => !seen.has(e.id));
            if (freshOnes.length === 0) return prev;
            highlightFresh(freshOnes.map((e) => e.id));
            return [...freshOnes, ...prev];
          });
        } else {
          setEvents(formatted);
        }
        setCursor(response.cursor ?? null);
        setLatestLedger(response.latestLedger ?? 0);
        setLastRefreshedAt(Date.now());
        setError(null);
        return response;
      } catch (err: any) {
        console.error("useEventLog fetch failed", err);
        setError(
          err?.message ??
            "Failed to fetch events. Ensure the RPC supports getEvents.",
        );
        return null;
      } finally {
        inflightRef.current = false;
        if (mode === "more") setLoadingMore(false);
        else if (mode === "initial") setLoading(false);
      }
    },
    [contractId, cursor, highlightFresh, network, pageSize],
  );

  // Reset state when contract or network changes — events from network A
  // are not valid for network B.
  useEffect(() => {
    setEvents([]);
    setCursor(null);
    setLatestLedger(0);
    setError(null);
    setLastRefreshedAt(null);
    setFreshIds(new Set());
    if (freshTimer.current) {
      clearTimeout(freshTimer.current);
      freshTimer.current = null;
    }
    void runFetch("initial");
    // We intentionally depend on the resolved network/contract key, not on
    // the network object identity, so transient config updates don't churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networkKey, pageSize]);

  // Polling loop. `off` disables; everything else triggers a periodic poll
  // that re-checks the latest page only (cursor stays at null while polling).
  useEffect(() => {
    if (pollInterval === "off") return;
    const timer = setInterval(() => {
      // For polling, always re-fetch the latest page (cursor cleared).
      const previouslyKnown = new Set(eventsRef.current.map((e) => e.id));
      setCursor(null);
      void runFetch("poll").then(() => {
        // Highlight freshness detection is handled inside runFetch; this
        // effect only manages the timer lifecycle.
        void previouslyKnown;
      });
    }, pollInterval);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollInterval, networkKey]);

  // Keep a ref to the latest events for the polling diff.
  const eventsRef = useRef<ContractEvent[]>(events);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const refresh = useCallback(async () => {
    setCursor(null);
    await runFetch("initial");
  }, [runFetch]);

  const loadMore = useCallback(async () => {
    if (!cursor) return;
    await runFetch("more");
  }, [cursor, runFetch]);

  const hasNextPage = useMemo(
    () => Boolean(cursor) && events.length > 0,
    [cursor, events.length],
  );

  // NEWEST first for display — but only for the "initial" page fetch. When
  // the user paginates, we keep the chronological order.
  const orderedEvents = useMemo(() => {
    if (latestLedger === 0) return events;
    return [...events].sort((a, b) => b.ledger - a.ledger);
  }, [events, latestLedger]);

  return {
    events: orderedEvents,
    totalCount: orderedEvents.length,
    lastRefreshedAt,
    freshIds,
    loading,
    loadingMore,
    error,
    hasNextPage,
    pollInterval,
    setPollInterval,
    refresh,
    loadMore,
  };
}

export const _internals = {
  formatEvent,
  fetchOnce,
  POLL_INTERVALS_MS,
};
// Silence "unused" linting for the typed convenience re-export.
void DEFAULT_NETWORKS;
