export interface SimulationFeeBreakdown {
  inclusionFee: string;
  resourceFee: string;
  totalFee: string;
}

export interface SimulationAuthEntry {
  contractId: string;
  fnName: string;
}

export interface SorobanErrorExplanation {
  /** Raw error code or message as surfaced by Soroban/host. */
  code: string;
  /** Short human-readable title for the failure. */
  title: string;
  /** Explanation of what the error means. */
  explanation: string;
  /** Actionable debugging/remediation steps. */
  remedies: string[];
  /** Relevant Stellar/Soroban documentation link. */
  docsUrl: string;
}

export interface SimulationExplanation {
  success: boolean;
  fees: SimulationFeeBreakdown;
  authEntries: SimulationAuthEntry[];
  stateChanges: string[];
  outputSummary: string;
  warnings: string[];
  /** Present when simulation failed and an error was identified. */
  errorCode?: string;
  /** Human-readable explanation and remedies for failed simulations. */
  errorExplanation?: SorobanErrorExplanation;
}

type RawSimResult = {
  error?: string;
  result?: { retval?: unknown };
  cost?: { cpuInsns?: string; memBytes?: string };
  minResourceFee?: string;
  transactionData?: {
    resources?: {
      footprint?: {
        readOnly?: unknown[];
        readWrite?: unknown[];
      };
    };
  };
  auth?: Array<{ rootInvocation?: { functionName?: string; contractAddress?: string } }>;
};

type ErrorRule = {
  match: (raw: string) => boolean;
  title: string;
  explanation: string;
  remedies: string[];
  docsUrl: string;
  code?: (raw: string) => string;
};

const DEFAULT_DOCS_URL =
  "https://developers.stellar.org/docs/learn/fundamentals/contract-development/errors-and-debugging";
const RESOURCE_DOCS_URL =
  "https://developers.stellar.org/docs/learn/fundamentals/fees-resource-limits-metering";
const STORAGE_DOCS_URL =
  "https://developers.stellar.org/docs/build/guides/storage/choosing-the-right-storage";
const AUTH_DOCS_URL =
  "https://developers.stellar.org/docs/learn/fundamentals/contract-development/authorization";

function normalizeErrorText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function extractHostErrorToken(raw: string): string | null {
  const m =
    raw.match(/HostError(?::\s*)?Error\(([^)]+)\)/i) ||
    raw.match(/Error\(([^)]+)\)/i);
  return m ? `Error(${m[1].trim()})` : null;
}

const HOST_ERROR_RULES: ErrorRule[] = [
  {
    match: (raw) => /Budget,\s*CpuLimitExceeded|CpuLimitExceeded|CPU instructions/i.test(raw),
    title: "CPU budget exceeded",
    explanation:
      "The contract execution exceeded the CPU instruction budget allowed for the transaction simulation or invocation.",
    remedies: [
      "Optimize contract logic to reduce CPU-intensive operations.",
      "Increase CPU/resource limits in advanced transaction settings when supported.",
      "Split large operations into smaller transactions or batches.",
    ],
    docsUrl: RESOURCE_DOCS_URL,
    code: () => "Error(Budget, CpuLimitExceeded)",
  },
  {
    match: (raw) => /Budget,\s*MemLimitExceeded|MemLimitExceeded|memory limit/i.test(raw),
    title: "Memory budget exceeded",
    explanation:
      "The contract used more memory than the Soroban VM budget allows for this execution.",
    remedies: [
      "Reduce in-memory data structures and temporary allocations in contract code.",
      "Increase memory/resource limits in advanced transaction settings when supported.",
      "Process data in smaller chunks to lower peak memory usage.",
    ],
    docsUrl: RESOURCE_DOCS_URL,
    code: () => "Error(Budget, MemLimitExceeded)",
  },
  {
    match: (raw) =>
      /Storage,\s*(ExceededLimit|Exceeded.*Limit)|StorageLimitExceeded|storage limit/i.test(raw),
    title: "Storage limit exceeded",
    explanation:
      "The transaction would exceed Soroban storage limits, such as ledger entry size/count or write footprint constraints.",
    remedies: [
      "Reduce the size or number of storage entries written in this transaction.",
      "Remove obsolete data before writing new state.",
      "Review storage footprint and resource configuration for the invocation.",
    ],
    docsUrl: STORAGE_DOCS_URL,
    code: () => "Error(Storage, ExceededLimit)",
  },
  {
    match: (raw) => /Storage,\s*MissingValue|MissingValue|non.?existent.*(entry|key)/i.test(raw),
    title: "Missing storage value",
    explanation:
      "The contract attempted to read or update a ledger/storage entry that does not exist.",
    remedies: [
      "Verify the contract address, key, and network are correct.",
      "Initialize required storage entries before reading or extending them.",
      "Restore archived entries if the data has expired and been archived.",
    ],
    docsUrl: STORAGE_DOCS_URL,
    code: () => "Error(Storage, MissingValue)",
  },
  {
    match: (raw) => /Storage,\s*ExistingValue|ExistingValue/i.test(raw),
    title: "Storage entry already exists",
    explanation:
      "The contract attempted to create a storage entry that already exists.",
    remedies: [
      "Use update/put logic when an entry may already exist.",
      "Check for existing state before creating new entries.",
      "Adjust initialization flow to be idempotent where appropriate.",
    ],
    docsUrl: STORAGE_DOCS_URL,
    code: () => "Error(Storage, ExistingValue)",
  },
  {
    match: (raw) => /WasmVm,\s*InvalidAction|InvalidAction/i.test(raw),
    title: "Invalid contract action",
    explanation:
      "The Soroban VM rejected an operation because the contract performed an invalid or unsupported action.",
    remedies: [
      "Inspect contract logic and input values for invalid state transitions or calls.",
      "Check function arguments and invocation context against contract requirements.",
      "Review recent contract changes for unsupported host interactions.",
    ],
    docsUrl: DEFAULT_DOCS_URL,
    code: () => "Error(WasmVm, InvalidAction)",
  },
  {
    match: (raw) => /Auth|Missing.*auth|authorization/i.test(raw),
    title: "Authorization required or invalid",
    explanation:
      "The transaction is missing required authorization or provided authorization does not satisfy contract requirements.",
    remedies: [
      "Ensure the correct signer/account authorizes the invocation.",
      "Include required auth entries and signatures for all authorized addresses.",
      "Verify contract address, function name, and invocation arguments in auth payloads.",
    ],
    docsUrl: AUTH_DOCS_URL,
  },
  {
    match: (raw) => /expired|ttl|restore/i.test(raw),
    title: "Ledger entry expired or TTL too low",
    explanation:
      "A required contract code or data entry may be archived or have insufficient time-to-live (TTL).",
    remedies: [
      "Extend the TTL for relevant contract data/code entries.",
      "Restore archived entries before invoking the contract.",
      "Re-run simulation after extending/restoring to confirm footprint changes.",
    ],
    docsUrl: STORAGE_DOCS_URL,
  },
];

export function explainSorobanError(rawError: string): SorobanErrorExplanation {
  const normalized = normalizeErrorText(rawError || "Unknown transaction error");
  const hostToken = extractHostErrorToken(normalized);

  for (const rule of HOST_ERROR_RULES) {
    if (rule.match(normalized)) {
      return {
        code: rule.code ? rule.code(normalized) : hostToken ?? normalized,
        title: rule.title,
        explanation: rule.explanation,
        remedies: rule.remedies,
        docsUrl: rule.docsUrl,
      };
    }
  }

  if (/HostError/i.test(normalized)) {
    return {
      code: hostToken ?? "HostError",
      title: "Soroban host error",
      explanation:
        "The Soroban host rejected the transaction during simulation or execution. The raw host error provides the specific failure code.",
      remedies: [
        "Review the raw host error code and contract invocation parameters.",
        "Check resource limits, authorization, and storage state for this transaction.",
        "Consult Stellar/Soroban documentation for the specific host error variant.",
      ],
      docsUrl: DEFAULT_DOCS_URL,
    };
  }

  return {
    code: normalized || "UnknownError",
    title: "Transaction failed",
    explanation:
      "The transaction failed before or during execution. Review the raw error details to identify the root cause.",
    remedies: [
      "Inspect the raw error message and transaction parameters.",
      "Retry simulation with adjusted inputs, fees, or resource settings as needed.",
      "Check network status and contract state, then consult Stellar documentation.",
    ],
    docsUrl: DEFAULT_DOCS_URL,
  };
}

/**
 * Transforms a raw Soroban simulation result into a developer-friendly
 * explanation covering fees, auth requirements, state implications, and output.
 */
export function explainSimulation(raw: RawSimResult): SimulationExplanation {
  const warnings: string[] = [];

  if (raw.error) {
    const rawError = String(raw.error);
    const errorExplanation = explainSorobanError(rawError);
    warnings.push(`Simulation failed: ${rawError}`);
    warnings.push(errorExplanation.explanation);
    for (const remedy of errorExplanation.remedies) {
      warnings.push(`Suggested remedy: ${remedy}`);
    }
    return {
      success: false,
      fees: { inclusionFee: "n/a", resourceFee: "n/a", totalFee: "n/a" },
      authEntries: [],
      stateChanges: [],
      outputSummary: `Error: ${rawError}`,
      warnings,
      errorCode: rawError,
      errorExplanation,
    };
  }

  const resourceFee = raw.minResourceFee ?? "0";
  const inclusionFee = "100"; // base inclusion fee in stroops
  const totalFee = (
    parseInt(inclusionFee, 10) + parseInt(resourceFee, 10)
  ).toString();

  const authEntries: SimulationAuthEntry[] = (raw.auth ?? []).map((a) => ({
    contractId: a.rootInvocation?.contractAddress ?? "unknown",
    fnName: a.rootInvocation?.functionName ?? "unknown",
  }));

  const readOnly = raw.transactionData?.resources?.footprint?.readOnly ?? [];
  const readWrite = raw.transactionData?.resources?.footprint?.readWrite ?? [];
  const stateChanges: string[] = [];
  if ((readOnly as unknown[]).length > 0)
    stateChanges.push(`${(readOnly as unknown[]).length} ledger key(s) read`);
  if ((readWrite as unknown[]).length > 0)
    stateChanges.push(`${(readWrite as unknown[]).length} ledger key(s) written`);

  if (authEntries.length === 0) warnings.push("No auth entries — ensure callers are set.");
  if (parseInt(resourceFee, 10) > 100_000)
    warnings.push("Resource fee is unusually high — consider optimising storage footprint.");

  const outputSummary =
    raw.result?.retval !== undefined
      ? `Return value: ${JSON.stringify(raw.result.retval)}`
      : "No return value (void function).";

  return {
    success: true,
    fees: { inclusionFee, resourceFee, totalFee },
    authEntries,
    stateChanges,
    outputSummary,
    warnings,
  };
}
