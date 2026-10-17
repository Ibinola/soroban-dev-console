import {
  Account,
  Contract,
  Keypair,
  TransactionBuilder,
  TimeoutInfinite,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import {
  convertToScVal,
  normalizeSimulationResult,
  type ArgType,
  type NormalizedSimulationResult,
} from "@devconsole/soroban-utils";

/** Playground simulations wait this long after the last parameter change. */
export const PLAYGROUND_DEBOUNCE_MS = 500;

/**
 * Trailing-edge debounce with `cancel`. Each call replaces the pending one, so
 * only the last parameter set in a burst of edits is simulated.
 */
export function createDebounced<A extends unknown[]>(fn: (...args: A) => void, waitMs: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: A) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, waitMs);
  };
  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return debounced;
}

export interface PlaygroundInput {
  name: string;
  type: string;
}

export type BuiltArgs = { ok: true; args: xdr.ScVal[] } | { ok: false; error: string };

/** Converts the playground's text inputs into ScVals, reporting the first invalid field. */
export function buildPlaygroundArgs(inputs: PlaygroundInput[], values: string[]): BuiltArgs {
  const args: xdr.ScVal[] = [];
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    const raw = values[i] ?? "";
    if (raw.trim() === "") return { ok: false, error: `Enter a value for “${input.name}”.` };
    try {
      args.push(convertToScVal(toArgType(input.type), raw.trim()));
    } catch (e) {
      return { ok: false, error: `“${input.name}” is not a valid ${input.type}: ${e instanceof Error ? e.message : String(e)}` };
    }
  }
  return { ok: true, args };
}

const ARG_TYPES: ArgType[] = ["symbol", "address", "i32", "u32", "i128", "u128", "string", "bool", "vec", "map"];

function toArgType(type: string): ArgType {
  return (ARG_TYPES as string[]).includes(type) ? (type as ArgType) : "string";
}

/** The slice of the RPC server the playground uses. It has no way to submit a transaction. */
export interface SimulationServer {
  simulateTransaction(tx: ReturnType<TransactionBuilder["build"]>): Promise<unknown>;
}

export interface PlaygroundResult {
  ok: boolean;
  error?: string;
  /** Decoded return value, pretty-printed. */
  returnValue?: string;
  cost?: { minResourceFee?: string; cpuInsns?: number; memBytes?: number };
}

/** Source account for read-only simulation: it only has to be well-formed. */
function simulationSource(): Account {
  return new Account(Keypair.fromRawEd25519Seed(Buffer.alloc(32, 1)).publicKey(), "0");
}

export function decodeReturnValue(resultXdr: string | undefined): string | undefined {
  if (!resultXdr) return undefined;
  try {
    const native = scValToNative(xdr.ScVal.fromXDR(resultXdr, "base64"));
    return JSON.stringify(native, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2) ?? "null";
  } catch {
    return resultXdr;
  }
}

/**
 * Simulates one contract call. Only ever calls `simulateTransaction`; nothing
 * is signed or submitted, so playground use cannot change on-chain state.
 */
export async function simulatePlaygroundCall(params: {
  server: SimulationServer;
  networkPassphrase: string;
  contractId: string;
  fnName: string;
  args: xdr.ScVal[];
}): Promise<PlaygroundResult> {
  const { server, networkPassphrase, contractId, fnName, args } = params;
  try {
    const tx = new TransactionBuilder(simulationSource(), { fee: "100", networkPassphrase })
      .addOperation(new Contract(contractId).call(fnName, ...args))
      .setTimeout(TimeoutInfinite)
      .build();
    const sim: NormalizedSimulationResult = normalizeSimulationResult(
      (await server.simulateTransaction(tx)) as never,
    );
    if (!sim.ok) return { ok: false, error: sim.error ?? "Simulation failed" };
    return {
      ok: true,
      returnValue: decodeReturnValue(sim.resultXdr),
      cost: { minResourceFee: sim.minResourceFee, cpuInsns: sim.cpuInsns, memBytes: sim.memBytes },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
