"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { rpc as SorobanRpc } from "@stellar/stellar-sdk";
import { FlaskConical, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@devconsole/ui";
import { Input } from "@devconsole/ui";
import { Label } from "@devconsole/ui";
import { useAbiStore } from "@/store/useAbiStore";
import { useNetworkStore } from "@/store/useNetworkStore";
import {
  PLAYGROUND_DEBOUNCE_MS,
  buildPlaygroundArgs,
  createDebounced,
  simulatePlaygroundCall,
  type PlaygroundResult,
} from "@/lib/playground";
import type { xdr } from "@stellar/stellar-sdk";

type SimulateFn = (call: { fnName: string; args: xdr.ScVal[] }) => Promise<PlaygroundResult>;

/**
 * Live playground: every change to the function or its parameters re-runs a
 * simulation after a 500 ms pause and updates the preview. Only simulation is
 * performed; nothing is signed or submitted.
 */
export function ContractPlayground({
  contractId,
  simulate,
}: {
  contractId: string;
  /** Overridable for tests; defaults to simulating against the active network. */
  simulate?: SimulateFn;
}) {
  const spec = useAbiStore((s) => s.getSpec(contractId));
  const { getActiveNetworkConfig } = useNetworkStore();
  const functions = useMemo(() => spec?.functions ?? [], [spec]);

  const [fnName, setFnName] = useState("");
  const [values, setValues] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "invalid" | "running" | "done">("idle");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [result, setResult] = useState<PlaygroundResult | null>(null);
  const requestId = useRef(0);

  const selected = functions.find((f) => f.name === fnName);

  const defaultSimulate = useRef<SimulateFn>(async ({ fnName: name, args }) => {
    const network = getActiveNetworkConfig();
    return simulatePlaygroundCall({
      server: new SorobanRpc.Server(network.rpcUrl),
      networkPassphrase: network.networkPassphrase,
      contractId,
      fnName: name,
      args,
    });
  });
  const runSimulation = simulate ?? defaultSimulate.current;
  const runRef = useRef(runSimulation);
  runRef.current = runSimulation;

  const debounced = useMemo(
    () =>
      createDebounced(async (name: string, inputs: { name: string; type: string }[], vals: string[]) => {
        const built = buildPlaygroundArgs(inputs, vals);
        if (!built.ok) {
          setValidationError(built.error);
          setStatus("invalid");
          return;
        }
        setValidationError(null);
        setStatus("running");
        const id = ++requestId.current;
        const res = await runRef.current({ fnName: name, args: built.args });
        // Ignore responses for parameter sets that have since been replaced.
        if (id !== requestId.current) return;
        setResult(res);
        setStatus("done");
      }, PLAYGROUND_DEBOUNCE_MS),
    [],
  );

  useEffect(() => () => debounced.cancel(), [debounced]);

  const schedule = (name: string, vals: string[]) => {
    const fn = functions.find((f) => f.name === name);
    if (!fn) return;
    // A newer edit invalidates any request still in flight.
    requestId.current++;
    debounced(name, fn.inputs, vals);
  };

  const onSelect = (name: string) => {
    const fn = functions.find((f) => f.name === name);
    const empty = (fn?.inputs ?? []).map(() => "");
    setFnName(name);
    setValues(empty);
    setResult(null);
    setValidationError(null);
    setStatus("idle");
    if (fn && fn.inputs.length === 0) schedule(name, empty);
  };

  const onValue = (index: number, value: string) => {
    const next = values.map((v, i) => (i === index ? value : v));
    setValues(next);
    schedule(fnName, next);
  };

  return (
    <Card aria-label="Contract playground">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="h-4 w-4" /> Playground
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Results update as you type. Calls are simulated only — no transaction is ever submitted.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          {functions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Load the contract interface to use the playground.</p>
          ) : (
            <>
              <div className="space-y-1">
                <Label htmlFor="playground-fn">Function</Label>
                <select
                  id="playground-fn"
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  value={fnName}
                  onChange={(e) => onSelect(e.target.value)}
                >
                  <option value="">Select a function…</option>
                  {functions.map((f) => (
                    <option key={f.name} value={f.name}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              {selected?.inputs.map((input, i) => (
                <div key={input.name} className="space-y-1">
                  <Label htmlFor={`playground-arg-${i}`}>
                    {input.name} <span className="text-muted-foreground">({input.type})</span>
                  </Label>
                  <Input
                    id={`playground-arg-${i}`}
                    value={values[i] ?? ""}
                    onChange={(e) => onValue(i, e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              ))}
            </>
          )}
        </div>

        <div className="space-y-2" aria-live="polite">
          <p className="text-xs font-semibold">Preview</p>
          {status === "idle" && <p className="text-sm text-muted-foreground">Pick a function and fill in its parameters.</p>}
          {status === "invalid" && <p className="text-sm text-amber-700">{validationError}</p>}
          {status === "running" && (
            <p className="flex items-center gap-2 text-sm text-blue-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Simulating…
            </p>
          )}
          {status === "done" && result && (
            <div className="space-y-2">
              {result.ok ? (
                <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 font-mono text-xs" data-testid="playground-result">
                  {result.returnValue ?? "(no return value)"}
                </pre>
              ) : (
                <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 font-mono text-xs text-destructive">
                  {result.error}
                </p>
              )}
              {result.cost && (
                <dl className="grid grid-cols-3 gap-2 text-xs" aria-label="Resource cost estimate">
                  <div>
                    <dt className="text-muted-foreground">Fee</dt>
                    <dd className="font-mono">{result.cost.minResourceFee ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">CPU</dt>
                    <dd className="font-mono">{result.cost.cpuInsns ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Memory</dt>
                    <dd className="font-mono">{result.cost.memBytes ?? "—"}</dd>
                  </div>
                </dl>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
