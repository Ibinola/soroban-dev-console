"use client";

/**
 * XDR Tools page
 *
 * Issue #936: Full ScVal type builder dropdown (all 20+ ScValType variants)
 * Issue #937: XDR schema validator against official Stellar XDR definitions
 * Issue #938: Secret key detector alert when a secret key is pasted
 */

import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { xdr, nativeToScVal } from "@stellar/stellar-sdk";
import { StrKey } from "@stellar/stellar-sdk";
import { Button } from "@devconsole/ui";
import { Textarea } from "@devconsole/ui";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@devconsole/ui";
import { Label } from "@devconsole/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@devconsole/ui";
import { Input } from "@devconsole/ui";
import { AlertCircle, CheckCircle, Copy, Trash2, Code, ArrowRightLeft, ShieldAlert, Link2 } from "lucide-react";
import { toast } from "sonner";
// Issue #937: XDR schema validator
import { validateXdr, XDR_TYPE_NAMES } from "@/lib/xdr-schema-validator";
import { isAcceptedXdrFile, readXdrFileAsText, ACCEPTED_XDR_FILE_EXTENSIONS } from "@/lib/xdr-file-reader";
import { findBase64ErrorPosition, type XdrErrorLocation } from "@/lib/xdr-error-locator";
// Issue #938: Secret key detector
import { containsSecret, useSecretPasteGuard } from "@/lib/secret-redaction";
// Issue #1109: type-badged inspection tree for decoded ScVals
import { scvalWrapperKey } from "@/lib/scval-type-badges";
import { ScvalInspectionTree } from "@/components/scval-inspection-tree";

const jsonReplacer = (_key: string, value: any) => {
  if (typeof value === "bigint") return value.toString();
  return value;
};

// ─── Issue #1111: JSON output beautifier ───────────────────────────────────

export type JsonIndentOption = "compact" | "2" | "4";

const JSON_INDENT_STORAGE_KEY = "xdr-tools-json-indent";
const JSON_INDENT_LABELS: Record<JsonIndentOption, string> = {
  compact: "Compact",
  "2": "2 Spaces",
  "4": "4 Spaces",
};

/** Re-format an already-decoded value using the given indentation preference, without re-decoding. */
export function formatDecodedJson(value: unknown, indent: JsonIndentOption): string {
  if (indent === "compact") return JSON.stringify(value, jsonReplacer);
  return JSON.stringify(value, jsonReplacer, indent === "4" ? 4 : 2);
}

function loadJsonIndentPreference(): JsonIndentOption {
  if (typeof window === "undefined") return "2";
  const stored = window.localStorage.getItem(JSON_INDENT_STORAGE_KEY);
  return stored === "compact" || stored === "2" || stored === "4" ? stored : "2";
}

// ─── Issue #1110: shareable XDR URL links ──────────────────────────────────

/** Practical, cross-browser/server-safe upper bound for a full share URL. */
export const MAX_SHARE_URL_LENGTH = 2000;

/** Convert standard base64 (as produced by Stellar XDR encoding) to the URL-safe variant. */
export function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Reverse of toBase64Url — restores padding so it can be passed back to base64 decoders. */
export function fromBase64Url(base64url: string): string {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (base64.length % 4)) % 4;
  return base64 + "=".repeat(padding);
}

export interface XdrShareParams {
  typeHint: string;
  xdr: string;
}

/** Build the shareable query string (`?type=...&xdr=...`) for an XDR payload. */
export function buildXdrShareQuery(params: XdrShareParams): string {
  const query = new URLSearchParams({
    type: params.typeHint,
    xdr: toBase64Url(params.xdr),
  });
  return query.toString();
}

/** Parse `type`/`xdr` back out of a URLSearchParams instance, or null if absent. */
export function parseXdrShareQuery(searchParams: URLSearchParams): XdrShareParams | null {
  const xdr = searchParams.get("xdr");
  if (!xdr) return null;
  const typeHint = searchParams.get("type") ?? "auto";
  return { typeHint, xdr: fromBase64Url(xdr) };
}

// ─── Issue #936: All 20+ ScValType variants ───────────────────────────────────

type ScValType =
  | "void"
  | "bool"
  | "u32"
  | "i32"
  | "u64"
  | "i64"
  | "u128"
  | "i128"
  | "u256"
  | "i256"
  | "bytes"
  | "string"
  | "symbol"
  | "address"
  | "vec"
  | "map"
  | "error"
  | "duration"
  | "timepoint"
  | "ledger_key_contract_instance"
  | "ledger_key_nonce";

const SC_VAL_TYPES: Array<{ value: ScValType; label: string; description: string }> = [
  { value: "void",                          label: "Void",                    description: "No value" },
  { value: "bool",                          label: "Bool",                    description: "true or false" },
  { value: "u32",                           label: "U32",                     description: "Unsigned 32-bit integer" },
  { value: "i32",                           label: "I32",                     description: "Signed 32-bit integer" },
  { value: "u64",                           label: "U64",                     description: "Unsigned 64-bit integer" },
  { value: "i64",                           label: "I64",                     description: "Signed 64-bit integer" },
  { value: "u128",                          label: "U128",                    description: "Unsigned 128-bit integer" },
  { value: "i128",                          label: "I128",                    description: "Signed 128-bit integer" },
  { value: "u256",                          label: "U256",                    description: "Unsigned 256-bit integer" },
  { value: "i256",                          label: "I256",                    description: "Signed 256-bit integer" },
  { value: "bytes",                         label: "Bytes",                   description: "Hex-encoded byte array" },
  { value: "string",                        label: "String",                  description: "UTF-8 string" },
  { value: "symbol",                        label: "Symbol",                  description: "Short symbol (≤32 chars)" },
  { value: "address",                       label: "Address",                 description: "Stellar account or contract address" },
  { value: "vec",                           label: "Vec",                     description: "JSON array of values" },
  { value: "map",                           label: "Map",                     description: "JSON object (symbol keys)" },
  { value: "error",                         label: "Error",                   description: "Contract error code (u32)" },
  { value: "duration",                      label: "Duration",                description: "Duration in seconds (u64)" },
  { value: "timepoint",                     label: "Timepoint",               description: "Unix timestamp (u64)" },
  { value: "ledger_key_contract_instance",  label: "LedgerKey (Instance)",    description: "Contract instance ledger key" },
  { value: "ledger_key_nonce",              label: "LedgerKey (Nonce)",       description: "Account nonce ledger key (u64)" },
];

function encodeScValToXdr(type: ScValType, value: string): { xdrBase64: string; xdrHex: string } {
  let scVal: xdr.ScVal;

  switch (type) {
    case "void":
      scVal = xdr.ScVal.scvVoid();
      break;
    case "bool":
      scVal = xdr.ScVal.scvBool(value === "true" || value === "1");
      break;
    case "u32": {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 0 || n > 4294967295) throw new Error("Value must be a valid u32 (0 to 4294967295)");
      scVal = xdr.ScVal.scvU32(n);
      break;
    }
    case "i32": {
      const n = Number(value);
      if (!Number.isInteger(n) || n < -2147483648 || n > 2147483647) throw new Error("Value must be a valid i32 (-2147483648 to 2147483647)");
      scVal = xdr.ScVal.scvI32(n);
      break;
    }
    case "u64":
      scVal = nativeToScVal(value, { type: "u64" });
      break;
    case "i64":
      scVal = nativeToScVal(value, { type: "i64" });
      break;
    case "u128":
      scVal = nativeToScVal(value, { type: "u128" });
      break;
    case "i128":
      scVal = nativeToScVal(value, { type: "i128" });
      break;
    case "u256": {
      const n = BigInt(value);
      if (n < 0n) throw new Error("U256 must be non-negative");
      // Build u256 hi/lo split
      const mask128 = (1n << 128n) - 1n;
      const hi = n >> 128n;
      const lo = n & mask128;
      const hiHi = Number(hi >> 64n);
      const hiLo = Number(hi & ((1n << 64n) - 1n));
      const loHi = Number(lo >> 64n);
      const loLo = Number(lo & ((1n << 64n) - 1n));
      scVal = xdr.ScVal.scvU256(new xdr.UInt256Parts({ hiHi, hiLo, loHi, loLo }));
      break;
    }
    case "i256": {
      const n = BigInt(value);
      const mask128 = (1n << 128n) - 1n;
      const abs = n < 0n ? -n : n;
      const hi = abs >> 128n;
      const lo = abs & mask128;
      const hiHi = n < 0n ? -Number(hi >> 64n) : Number(hi >> 64n);
      const hiLo = Number(hi & ((1n << 64n) - 1n));
      const loHi = Number(lo >> 64n);
      const loLo = Number(lo & ((1n << 64n) - 1n));
      scVal = xdr.ScVal.scvI256(new xdr.Int256Parts({ hiHi, hiLo, loHi, loLo }));
      break;
    }
    case "string":
      scVal = xdr.ScVal.scvBytes(Buffer.from(value, "utf-8"));
      break;
    case "bytes":
      scVal = xdr.ScVal.scvBytes(Buffer.from(value, "hex"));
      break;
    case "symbol":
      scVal = xdr.ScVal.scvSymbol(value);
      break;
    case "address":
      scVal = nativeToScVal(value, { type: "address" });
      break;
    case "vec": {
      const items = JSON.parse(value) as unknown[];
      const scVals = items.map((item, i) => {
        if (typeof item === "string") return xdr.ScVal.scvSymbol(item);
        if (typeof item === "number") return xdr.ScVal.scvI32(item);
        if (typeof item === "boolean") return xdr.ScVal.scvBool(item);
        throw new Error(`Unsupported vec item type at index ${i}`);
      });
      scVal = xdr.ScVal.scvVec(scVals);
      break;
    }
    case "map": {
      const obj = JSON.parse(value) as Record<string, unknown>;
      const entries = Object.entries(obj).map(([k, v]) => {
        const key = xdr.ScVal.scvSymbol(k);
        let val: xdr.ScVal;
        if (typeof v === "string") val = xdr.ScVal.scvSymbol(v);
        else if (typeof v === "number") val = xdr.ScVal.scvI32(v);
        else if (typeof v === "boolean") val = xdr.ScVal.scvBool(v);
        else throw new Error(`Unsupported map value type for key "${k}"`);
        return new xdr.ScMapEntry({ key, val });
      });
      scVal = xdr.ScVal.scvMap(entries);
      break;
    }
    case "error": {
      const code = Number(value);
      if (!Number.isInteger(code) || code < 0) throw new Error("Error code must be a non-negative integer");
      scVal = xdr.ScVal.scvError(
        xdr.ScError.sceContract(code),
      );
      break;
    }
    case "duration":
      scVal = xdr.ScVal.scvDuration(xdr.Duration.fromString(value));
      break;
    case "timepoint":
      scVal = xdr.ScVal.scvTimepoint(xdr.TimePoint.fromString(value));
      break;
    case "ledger_key_contract_instance":
      scVal = xdr.ScVal.scvLedgerKeyContractInstance();
      break;
    case "ledger_key_nonce": {
      const n = BigInt(value);
      scVal = xdr.ScVal.scvLedgerKeyNonce(
        new xdr.ScNonceKey({ nonce: xdr.Int64.fromString(n.toString()) }),
      );
      break;
    }
    default:
      throw new Error(`Unsupported type: ${type}`);
  }

  const xdrBuffer = scVal.toXDR();
  const xdrBase64 = Buffer.from(xdrBuffer).toString("base64");
  const xdrHex = Buffer.from(xdrBuffer).toString("hex");
  return { xdrBase64, xdrHex };
}

function getPlaceholder(type: ScValType): string {
  switch (type) {
    case "u32":    return "42";
    case "i32":    return "-42";
    case "u64":    return "1234567890";
    case "i64":    return "-1234567890";
    case "u128":   return "340282366920938463463374607431768211455";
    case "i128":   return "-170141183460469231731687303715884105728";
    case "u256":   return "0";
    case "i256":   return "0";
    case "bool":   return "true";
    case "string": return "Hello, World!";
    case "bytes":  return "deadbeef";
    case "symbol": return "transfer";
    case "address": return "GABC...";
    case "vec":    return '["item1", "item2"]';
    case "map":    return '{"key1": "value1", "key2": 42}';
    case "error":  return "1";
    case "duration": return "86400";
    case "timepoint": return "1700000000";
    case "ledger_key_nonce": return "0";
    default:       return "";
  }
}

// Issue #1105: render a short excerpt of the input around the error
// position, with the offending character underlined in red.
const ERROR_EXCERPT_RADIUS = 20;

function renderErrorExcerpt(input: string, position: number) {
  const start = Math.max(0, position - ERROR_EXCERPT_RADIUS);
  const end = Math.min(input.length, position + ERROR_EXCERPT_RADIUS + 1);
  const before = input.slice(start, position);
  const flagged = input[position] ?? "";
  const after = input.slice(position + 1, end);

  return (
    <>
      {start > 0 && "…"}
      {before}
      <span className="rounded bg-red-500/20 underline decoration-red-500 decoration-2 underline-offset-2">
        {flagged || " "}
      </span>
      {after}
      {end < input.length && "…"}
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function XdrToolsPage() {
  const [activeTab, setActiveTab] = useState<"decode" | "encode">("decode");
  const decodeTabRef = useRef<HTMLButtonElement>(null);
  const encodeTabRef = useRef<HTMLButtonElement>(null);

  const handleTabKeyDown = (e: React.KeyboardEvent, tab: "decode" | "encode") => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const nextTab = tab === "decode" ? "encode" : "decode";
      setActiveTab(nextTab);
      if (nextTab === "decode") decodeTabRef.current?.focus();
      else encodeTabRef.current?.focus();
    }
  };

  // Decoder state
  const [decodeInput, setDecodeInput] = useState("");
  // Issue #1111: keep the raw decoded value so the JSON view can be
  // re-formatted on indentation-preference changes without re-decoding.
  const [decodedValue, setDecodedValue] = useState<unknown>(null);
  const [detectedType, setDetectedType] = useState<string | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  // Issue #1105: precise error location for Base64-syntax decode failures.
  const [errorLocation, setErrorLocation] = useState<XdrErrorLocation | null>(null);
  const [typeHint, setTypeHint] = useState<string>("auto");
  // Issue #938: secret alert
  const [secretAlert, setSecretAlert] = useState(false);
  // Issue #1111: JSON beautifier indentation preference, persisted per-browser.
  const [jsonIndent, setJsonIndent] = useState<JsonIndentOption>(() => loadJsonIndentPreference());
  const decoded = decodedValue !== null ? formatDecodedJson(decodedValue, jsonIndent) : null;

  // Encoder state
  const [encodeType, setEncodeType] = useState<ScValType>("u32");
  const [encodeValue, setEncodeValue] = useState("");
  const [encodedBase64, setEncodedBase64] = useState<string | null>(null);
  const [encodedHex, setEncodedHex] = useState<string | null>(null);
  const [encodeError, setEncodeError] = useState<string | null>(null);

  // Issue #1110: auto-populate + auto-decode from a shared ?type=&xdr= link.
  const searchParams = useSearchParams();
  useEffect(() => {
    const shared = parseXdrShareQuery(searchParams);
    if (!shared) return;

    setDecodeInput(shared.xdr);
    setTypeHint(shared.typeHint);

    const hint = shared.typeHint === "auto" ? undefined : shared.typeHint;
    const result = validateXdr(shared.xdr, hint);
    if (result.valid && result.decoded) {
      setDetectedType(result.typeName ?? null);
      setDecodedValue(result.decoded);
      toast.success(`Loaded shared XDR — decoded as ${result.typeName}`);
    } else {
      setDecodeError(result.errors.join("\n"));
      toast.error("Failed to decode shared XDR link");
    }
    // Only ever runs against the URL params present on initial mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Issue #1110: build a shareable URL for the current decode input and copy it.
  const handleShareLink = () => {
    if (!decodeInput.trim()) {
      toast.error("Nothing to share — decode an XDR payload first");
      return;
    }
    const query = buildXdrShareQuery({ typeHint, xdr: decodeInput });
    const shareUrl = `${window.location.origin}${window.location.pathname}?${query}`;

    if (shareUrl.length > MAX_SHARE_URL_LENGTH) {
      toast.warning(
        `Share link is ${shareUrl.length} characters, over the ${MAX_SHARE_URL_LENGTH}-character safe limit — some tools/messengers may truncate it.`,
      );
    }
    navigator.clipboard.writeText(shareUrl);
    toast.success("Share link copied to clipboard");
  };

  // Issue #938: secret paste guard hook
  const { guardedOnChange } = useSecretPasteGuard({
    onSecretDetected: () => {
      setSecretAlert(true);
      toast.warning("⚠️ Secret key detected in input — do not paste private keys here.");
    },
  });

  // Issue #937: validate using XDR schema validator
  const decodeAndSetState = (input: string) => {
    setDecodeError(null);
    setDecodedValue(null);
    setDetectedType(null);

    const hint = typeHint === "auto" ? undefined : typeHint;
    const result = validateXdr(input, hint);

    if (result.valid && result.decoded) {
      setDetectedType(result.typeName ?? null);
      setDecodedValue(result.decoded);
      toast.success(`Decoded as ${result.typeName}`);
    } else {
      setDecodeError(result.errors.join("\n"));
      // Issue #1105: pinpoint the exact character when the failure is a
      // Base64-syntax problem — see xdr-error-locator.ts for why deeper
      // XDR-schema mismatches can't get a precise byte offset.
      setErrorLocation(findBase64ErrorPosition(input));
      toast.error("Decoding failed");
    }
  };

  // Issue #1111: change the indentation preference and persist it; re-formats
  // the already-decoded value instantly without touching decodeInput/decode.
  const handleJsonIndentChange = (next: JsonIndentOption) => {
    setJsonIndent(next);
    try {
      window.localStorage.setItem(JSON_INDENT_STORAGE_KEY, next);
    } catch {
      // localStorage unavailable (private mode, SSR) — preference just won't persist.
    }
  };

  const handleEncode = () => {
    setEncodeError(null);
    setEncodedBase64(null);
    setEncodedHex(null);

    const needsValue = !["void", "ledger_key_contract_instance"].includes(encodeType);
    if (!needsValue || encodeValue.trim()) {
      try {
        const { xdrBase64, xdrHex } = encodeScValToXdr(encodeType, encodeValue);
        setEncodedBase64(xdrBase64);
        setEncodedHex(xdrHex);
        toast.success("Encoded successfully");
      } catch (e: any) {
        setEncodeError(e.message);
        toast.error("Encoding failed");
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  // Issue #1107: copy a ready-to-run Stellar CLI command for the current input.
  const handleCopyCliCommand = () => {
    const command = buildStellarCliCommand({
      xdr: decodeInput,
      commandType: cliCommandType,
      typeHint,
    });
    navigator.clipboard.writeText(command);
    toast.success("CLI command copied to clipboard");
  };

  const clearAll = () => {
    setDecodeInput("");
    setDecodedValue(null);
    setDetectedType(null);
    setDecodeError(null);
    setErrorLocation(null);
    setEncodeValue("");
    setEncodedBase64(null);
    setEncodedHex(null);
    setEncodeError(null);
    setSecretAlert(false);
  };

  const needsValueInput = !["void", "ledger_key_contract_instance"].includes(encodeType);

  // Issue #1109: the decoded payload, parsed once, and whether we can draw a badged tree for it
  let decodedJson: unknown;
  try {
    decodedJson = decoded ? JSON.parse(decoded) : undefined;
  } catch {
    decodedJson = undefined;
  }
  const hasScvalTree = decodedJson !== undefined && scvalWrapperKey(decodedJson) !== undefined;

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">XDR Tools</h1>
          <p className="text-muted-foreground">
            Decode base64 XDR strings or encode ScVal types to XDR.
          </p>
        </div>
        <div className="flex gap-2" role="tablist" aria-label="XDR tool mode">
          <Button
            ref={decodeTabRef}
            variant={activeTab === "decode" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("decode")}
            role="tab"
            aria-selected={activeTab === "decode"}
            aria-controls="decode-panel"
            onKeyDown={(e) => handleTabKeyDown(e, "decode")}
          >
            <Code className="mr-1 h-3 w-3" />
            Decode
          </Button>
          <Button
            ref={encodeTabRef}
            variant={activeTab === "encode" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("encode")}
            role="tab"
            aria-selected={activeTab === "encode"}
            aria-controls="encode-panel"
            onKeyDown={(e) => handleTabKeyDown(e, "encode")}
          >
            <ArrowRightLeft className="mr-1 h-3 w-3" />
            Encode
          </Button>
        </div>
      </div>

      {activeTab === "decode" ? (
        <div id="decode-panel" role="tabpanel" aria-label="Decode XDR" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <Card className="flex h-full flex-col">
              <CardHeader>
                <CardTitle>Input</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                {/* Issue #938: secret alert popover */}
                {secretAlert && (
                  <div className="flex items-start gap-2 rounded-md border border-yellow-400 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-300">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="font-semibold">Secret key detected</p>
                      <p className="mt-0.5 text-xs">A Stellar secret key or other sensitive value was detected in your input. Never paste private keys into developer tools.</p>
                    </div>
                    <button
                      onClick={() => setSecretAlert(false)}
                      className="ml-auto text-yellow-600 hover:text-yellow-800"
                      aria-label="Dismiss secret alert"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Issue #937: type hint selector */}
                <div className="space-y-1.5">
                  <Label htmlFor="type-hint">Validate as type (optional)</Label>
                  <Select value={typeHint} onValueChange={setTypeHint}>
                    <SelectTrigger id="type-hint">
                      <SelectValue placeholder="Auto-detect" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-detect</SelectItem>
                      {XDR_TYPE_NAMES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid w-full gap-1.5">
                  <Label htmlFor="xdr-decode-input">Base64 or Hex XDR String</Label>
                  <Textarea
                    id="xdr-decode-input"
                    placeholder="AAAAAgAAA..."
                    className="min-h-[240px] resize-none font-mono text-xs"
                    value={decodeInput}
                    onChange={guardedOnChange((e) => setDecodeInput(e.target.value))}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleDecode} disabled={!decodeInput} className="flex-1 gap-2">
                    <Code className="h-4 w-4" />
                    Decode &amp; Validate
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleShareLink}
                    disabled={!decodeInput}
                    aria-label="Share XDR link"
                    title="Copy a shareable link to this XDR payload"
                  >
                    <Link2 className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" onClick={clearAll} disabled={!decodeInput} aria-label="Clear input">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {decodeError && (
                  <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-500 dark:bg-red-900/20">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <pre className="whitespace-pre-wrap">{decodeError}</pre>
                  </div>
                )}
                {/* Issue #1105: pinpoint the exact character for Base64-syntax failures */}
                {errorLocation && (
                  <div
                    className="space-y-1 rounded-md border border-red-200 bg-red-50/50 p-3 text-xs dark:border-red-900 dark:bg-red-900/10"
                    data-testid="xdr-error-location"
                  >
                    <p className="font-medium text-red-600 dark:text-red-400">
                      {errorLocation.message} (line {errorLocation.line}, column {errorLocation.column})
                    </p>
                    <pre className="overflow-x-auto whitespace-pre rounded bg-zinc-950 p-2 font-mono text-zinc-50">
                      {renderErrorExcerpt(decodeInput, errorLocation.position)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="flex h-full flex-col border-dashed bg-muted/30">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle>Result</CardTitle>
                  <CardDescription>
                    {detectedType ? (
                      <span className="flex items-center gap-1 font-medium text-green-600">
                        <CheckCircle className="h-3 w-3" />
                        {detectedType}
                      </span>
                    ) : (
                      "Waiting for input..."
                    )}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {decoded && (
                    <Select value={jsonIndent} onValueChange={(v) => handleJsonIndentChange(v as JsonIndentOption)}>
                      <SelectTrigger className="h-8 w-[130px]" aria-label="JSON indentation">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(JSON_INDENT_LABELS) as JsonIndentOption[]).map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {JSON_INDENT_LABELS[opt]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {decoded && (
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(decoded)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="relative min-h-[300px] flex-1">
                {decoded ? (
                  <div aria-live="polite" className="absolute inset-4 overflow-auto rounded-md bg-zinc-950 p-4 font-mono text-xs text-zinc-50">
                    {/* Issue #1109: type badges on every node when the payload is an ScVal */}
                    {hasScvalTree ? <ScvalInspectionTree value={decodedJson} /> : <pre>{decoded}</pre>}
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm italic text-muted-foreground">
                    Decoded JSON will appear here
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div id="encode-panel" role="tabpanel" aria-label="Encode XDR" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <Card className="flex h-full flex-col">
              <CardHeader>
                <CardTitle>Encode ScVal</CardTitle>
                <CardDescription>All 20+ Soroban ScValType variants supported</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>ScVal Type</Label>
                  <Select
                    value={encodeType}
                    onValueChange={(v: ScValType) => {
                      setEncodeType(v);
                      setEncodeValue("");
                      setEncodedBase64(null);
                      setEncodedHex(null);
                      setEncodeError(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SC_VAL_TYPES.map(({ value, label, description }) => (
                        <SelectItem key={value} value={value}>
                          <span className="font-mono">{label}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{description}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {needsValueInput && (
                  <div className="space-y-2">
                    <Label>Value</Label>
                    <Input
                      placeholder={getPlaceholder(encodeType)}
                      value={encodeValue}
                      onChange={(e) => setEncodeValue(e.target.value)}
                      className="font-mono text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      {encodeType === "vec" && 'JSON array: ["a", "b"]'}
                      {encodeType === "map" && 'JSON object: {"key": "value"}'}
                      {encodeType === "bytes" && "Hex string: deadbeef"}
                      {encodeType === "bool" && '"true" or "false"'}
                      {encodeType === "u256" && "Non-negative integer (up to 2^256 - 1)"}
                      {encodeType === "i256" && "Signed integer"}
                      {encodeType === "error" && "Contract error code (u32)"}
                      {encodeType === "duration" && "Duration in seconds"}
                      {encodeType === "timepoint" && "Unix timestamp in seconds"}
                      {encodeType === "ledger_key_nonce" && "Nonce value (i64)"}
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={handleEncode}
                    className="flex-1 gap-2"
                    disabled={needsValueInput && !encodeValue.trim()}
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                    Encode
                  </Button>
                  <Button variant="outline" onClick={clearAll} aria-label="Clear all">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {encodeError && (
                  <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-500 dark:bg-red-900/20">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    {encodeError}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="flex h-full flex-col border-dashed bg-muted/30">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle>Encoded XDR</CardTitle>
                  <CardDescription>
                    {encodedBase64 ? (
                      <span className="flex items-center gap-1 font-medium text-green-600">
                        <CheckCircle className="h-3 w-3" />
                        {encodeType} encoded
                      </span>
                    ) : (
                      "Waiting for input..."
                    )}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="relative min-h-[300px] flex-1 space-y-4">
                {encodedBase64 ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold uppercase text-muted-foreground">Base64</Label>
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(encodedBase64)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="break-all rounded-md bg-zinc-950 p-4 font-mono text-xs text-zinc-50">
                        {encodedBase64}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold uppercase text-muted-foreground">Hex</Label>
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(encodedHex!)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="break-all rounded-md bg-zinc-950 p-4 font-mono text-xs text-zinc-50">
                        {encodedHex}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm italic text-muted-foreground">
                    Encoded XDR will appear here
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
