"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { rpc as SorobanRpc, scValToNative, xdr } from "@stellar/stellar-sdk";
import { useNetworkStore } from "@/store/useNetworkStore";
import { useSavedCallsStore } from "@/store/useSavedCallsStore";
import { fetchTransactionByHash, type NormalizedTx } from "@/lib/history-utils";
import {
  decodeDiagnosticEvents,
  type DecodedDiagnosticLog,
  type RawDiagnosticEvent,
} from "@/lib/diagnostic-event-decoder";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Copy,
  RotateCcw,
  Loader2,
  Clock,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@devconsole/ui";
import { Badge } from "@devconsole/ui";
import { Button } from "@devconsole/ui";
import { Switch } from "@devconsole/ui";
import { Label } from "@devconsole/ui";
import { toast } from "sonner";

import { DEFAULT_LOCAL_HORIZON_URL } from "@devconsole/api-contracts";

const HORIZON_URL: Record<string, string> = {
  mainnet: "https://horizon.stellar.org",
  testnet: "https://horizon-testnet.stellar.org",
  futurenet: "https://horizon-futurenet.stellar.org",
  local: DEFAULT_LOCAL_HORIZON_URL,
};

function stringifyScVal(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  } catch {
    return String(value);
  }
}

function toRawDiagnosticEvents(response: unknown): RawDiagnosticEvent[] {
  const res = response as any;
  const parsed = res?.diagnosticEvents;
  if (Array.isArray(parsed)) {
    return parsed
      .map((ev: any) => {
        const event = ev?.event?.() ?? ev?.event ?? ev;
        const topicsRaw = typeof event?.topics === "function" ? event.topics() : event?.topics ?? ev?.topics ?? [];
        const dataRaw = typeof event?.data === "function" ? event.data() : event?.body?.() ?? event?.data ?? ev?.data ?? null;
        const topics = Array.isArray(topicsRaw)
          ? topicsRaw.map((t: any) => {
              try {
                return stringifyScVal(scValToNative(t));
              } catch {
                return stringifyScVal(t?.toString?.() ?? t);
              }
            })
          : [];
        let data: unknown = dataRaw;
        try {
          data = scValToNative(dataRaw);
        } catch {
          // keep raw
        }
        const inSuccessfulContractCall =
          typeof ev?.inSuccessfulContractCall === "function"
            ? Boolean(ev.inSuccessfulContractCall())
            : Boolean(ev?.inSuccessfulContractCall ?? true);
        return { topics, data, inSuccessfulContractCall } as RawDiagnosticEvent;
      })
      .filter(Boolean);
  }

  const xdrEvents: string[] = res?.diagnosticEventsXdr ?? [];
  if (!Array.isArray(xdrEvents)) return [];
  return xdrEvents.flatMap((evXdr) => {
    try {
      const de = (xdr as any).DiagnosticEvent.fromXDR(evXdr, "base64");
      const inSuccessfulContractCall = Boolean(de.inSuccessfulContractCall?.());
      const ce = de.event?.();
      const topics = (ce?.body?.()?.v0?.()?.topics?.() ?? ce?.topics?.() ?? []).map((t: any) => {
        try {
          return stringifyScVal(scValToNative(t));
        } catch {
          return String(t);
        }
      });
      let data: unknown = null;
      try {
        const body = ce?.body?.();
        const v0 = body?.v0?.();
        const datum = v0?.data?.();
        data = datum ? scValToNative(datum) : null;
      } catch {
        data = null;
      }
      return [{ topics, data, inSuccessfulContractCall } as RawDiagnosticEvent];
    } catch {
      return [];
    }
  });
}

function severityBadgeClass(severity: DecodedDiagnosticLog["severity"]) {
  switch (severity) {
    case "INFO":
      return "border-green-500/30 bg-green-500/15 text-green-700";
    case "WARN":
      return "border-yellow-500/30 bg-yellow-500/15 text-yellow-700";
    case "ERROR":
      return "border-red-500/30 bg-red-500/15 text-red-700";
    case "DEBUG":
    default:
      return "border-slate-500/30 bg-slate-500/15 text-slate-700";
  }
}

export default function TxDetailPage() {
  const { hash } = useParams<{ hash: string }>();
  const router = useRouter();
  const { currentNetwork, getActiveNetworkConfig } = useNetworkStore();
  const { savedCalls, addToCart } = useSavedCallsStore();

  const [tx, setTx] = useState<NormalizedTx | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diagnosticLogs, setDiagnosticLogs] = useState<DecodedDiagnosticLog[]>([]);
  const [hideDebugLogs, setHideDebugLogs] = useState(false);

  const horizonUrl = HORIZON_URL[currentNetwork] ?? HORIZON_URL.testnet;

  useEffect(() => {
    if (!hash) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDiagnosticLogs([]);

    const networkConfig = getActiveNetworkConfig();
    const rpcUrl = networkConfig?.rpcUrl;
    const server = rpcUrl ? new SorobanRpc.Server(rpcUrl) : null;

    Promise.all([
      fetchTransactionByHash(hash, horizonUrl),
      server
        ? server.getTransaction(hash).catch(() => null)
        : Promise.resolve(null),
    ])
      .then(([result, rpcTx]) => {
        if (result) {
          setTx(result);
        } else {
          setError("Transaction not found.");
          return;
        }
        setTx(result);

        if (!result.successful) {
          let code: string | null = null;
          if (rpcUrl) {
            try {
              const server = new SorobanRpc.Server(rpcUrl);
              const rpcTx = await server.getTransaction(hash);
              code = extractFailureCode(rpcTx);
            } catch {
              // ignore best-effort RPC lookup
            }
          }
          if (!code) code = "Transaction failed";
          if (!cancelled) setFailureCode(code);
        }
        if (rpcTx) {
          const events = toRawDiagnosticEvents(rpcTx);
          setDiagnosticLogs(decodeDiagnosticEvents(events));
        }
      })
      .catch((e) => setError(e?.message ?? "Failed to load transaction."))
      .finally(() => setLoading(false));
  }, [hash, horizonUrl, currentNetwork, getActiveNetworkConfig]);

  const visibleDiagnosticLogs = useMemo(
    () => (hideDebugLogs ? diagnosticLogs.filter((l) => l.severity !== "DEBUG") : diagnosticLogs),
    [diagnosticLogs, hideDebugLogs],
  );

  // FE-046: Find saved calls that match this tx's source account for replay
  const replayableCalls = savedCalls.filter(
    (c) => c.network === currentNetwork,
  );

  const handleReplay = (callId: string) => {
    const call = savedCalls.find((c) => c.id === callId);
    if (!call) return;
    addToCart(call);
    toast.success(`"${call.name}" added to tx-builder cart`);
    router.push("/tx-builder");
  };

  const copyHash = () => {
    navigator.clipboard.writeText(hash);
    toast.success("Hash copied");
  };

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !tx) {
    return (
      <div className="container mx-auto p-6">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Link>
        </Button>
        <p className="text-sm text-destructive">{error ?? "Transaction not found."}</p>
      </div>
    );
  }

  const isPending = Boolean(tx.pending) || !tx.createdAt || !Number.isFinite(tx.ledger);

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Link>
        </Button>
        <h1 className="text-xl font-semibold">Transaction Detail</h1>
        {isPending ? (
          <Badge variant="outline" className="text-amber-700">
            <Clock className="mr-1 h-3 w-3" /> Pending Confirmation
          </Badge>
        ) : tx.successful ? (
          <Badge className="bg-green-500/15 text-green-700">
            <CheckCircle2 className="mr-1 h-3 w-3" /> Success
          </Badge>
        ) : (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" /> Failed
          </Badge>
        )}
      </div>

      {!tx.successful && failureExplanation && (
        <Card className="border-red-500/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Failed Transaction Error Explainer
            </CardTitle>
            <CardDescription>
              Human-readable explanation alongside the raw error code.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Raw error code</p>
              <p className="font-mono break-all rounded border bg-muted/40 p-2 text-xs">
                {failureCode}
              </p>
            </div>
            <div>
              <p className="font-medium">{failureExplanation.title}</p>
              <p className="text-muted-foreground mt-1">{failureExplanation.explanation}</p>
            </div>
            {failureExplanation.remedies.length > 0 && (
              <div>
                <p className="font-medium mb-1">Suggested remedies</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  {failureExplanation.remedies.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
            <a
              href={failureExplanation.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
            >
              Stellar documentation <ExternalLink className="h-3 w-3" />
            </a>
          </CardContent>
        </Card>
      )}

      {/* Core fields */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Hash">
            <span className="font-mono break-all">{tx.hash}</span>
            <Button variant="ghost" size="icon" className="ml-2 h-6 w-6" onClick={copyHash}>
              <Copy className="h-3 w-3" />
            </Button>
          </Row>
          <Row label="Ledger">
            {Number.isFinite(tx.ledger) ? (
              <a
                href={getLedgerExplorerUrl(currentNetwork, Number(tx.ledger))}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-primary underline-offset-2 hover:underline"
              >
                #{tx.ledger} <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span>Pending Confirmation</span>
            )}
          </Row>
          <Row label="Timestamp">
            {tx.createdAt ? (
              <span className="flex flex-col">
                <span>{formatRelativeTimestamp(tx.createdAt)}</span>
                <span className="text-xs text-muted-foreground">
                  {formatUtcTimestamp(tx.createdAt)}
                </span>
              </span>
            ) : (
              <span>Pending Confirmation</span>
            )}
          </Row>
          <Row label="Operation">{tx.operationSummary}</Row>
          <Row label="Operations">{tx.operationCount}</Row>
          <Row label="Source">
            <span className="font-mono">{tx.sourceAccount || "—"}</span>
          </Row>
          <Row label="Fee">{tx.feePaid} stroops</Row>
          <Row label="Network">{currentNetwork}</Row>
          <Row label="Explorer">
            <a
              href={`https://stellar.expert/explorer/${currentNetwork}/tx/${tx.hash}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-primary underline-offset-2 hover:underline"
            >
              stellar.expert <ExternalLink className="h-3 w-3" />
            </a>
          </Row>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Diagnostic Events</CardTitle>
              <CardDescription>
                Decoded diagnostic events with severity indicators.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="hide-debug-logs"
                checked={hideDebugLogs}
                onCheckedChange={setHideDebugLogs}
              />
              <Label htmlFor="hide-debug-logs" className="text-xs">
                Hide DEBUG
              </Label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {visibleDiagnosticLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {diagnosticLogs.length === 0
                ? "No diagnostic events available for this transaction."
                : "No diagnostic events match the current filter."}
            </p>
          ) : (
            visibleDiagnosticLogs.map((log, idx) => (
              <div key={idx} className="rounded-md border p-3 text-sm">
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant="outline" className={severityBadgeClass(log.severity)}>
                    {log.severity}
                  </Badge>
                  {log.isError ? (
                    <span className="text-xs text-red-600">Contract call error</span>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Topics</span>
                    <pre className="mt-1 overflow-x-auto rounded bg-muted/50 p-2 text-xs">
                      {JSON.stringify(log.topics, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Data</span>
                    <pre className="mt-1 overflow-x-auto rounded bg-muted/50 p-2 text-xs">
                      {stringifyScVal(log.data)}
                    </pre>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* FE-046: Replay surface */}
      {replayableCalls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Replay</CardTitle>
            <CardDescription>
              Add a saved call to the tx-builder to replay or rehydrate this flow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {replayableCalls.map((call) => (
              <div
                key={call.id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-medium">{call.name || call.fnName}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {call.fnName}({call.args.length} args)
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReplay(call.id)}
                >
                  <RotateCcw className="mr-1 h-3 w-3" /> Replay
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <span className="flex items-center">{children}</span>
    </div>
  );
}
