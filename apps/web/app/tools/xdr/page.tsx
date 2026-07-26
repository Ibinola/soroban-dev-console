"use client";

import { useState } from "react";
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
import { AlertCircle, CheckCircle, Copy, Trash2, Code, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";

const jsonReplacer = (_key: string, value: any) => {
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
};

type ScValType =
  | "u32"
  | "i32"
  | "u64"
  | "i64"
  | "u128"
  | "i128"
  | "bool"
  | "string"
  | "bytes"
  | "symbol"
  | "address"
  | "vec"
  | "map"
  | "void";

const SC_VAL_TYPES: ScValType[] = [
  "u32", "i32", "u64", "i64", "u128", "i128",
  "bool", "string", "bytes", "symbol", "address",
  "vec", "map", "void",
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
      if (!Number.isInteger(n) || n < 0 || n > 4294967295) {
        throw new Error("Value must be a valid u32 (0 to 4294967295)");
      }
      scVal = xdr.ScVal.scvU32(n);
      break;
    }
    case "i32": {
      const n = Number(value);
      if (!Number.isInteger(n) || n < -2147483648 || n > 2147483647) {
        throw new Error("Value must be a valid i32 (-2147483648 to 2147483647)");
      }
      scVal = xdr.ScVal.scvI32(n);
      break;
    }
    case "u64": {
      const n = BigInt(value);
      if (n < BigInt(0) || n > BigInt("18446744073709551615")) {
        throw new Error("Value must be a valid u64");
      }
      scVal = nativeToScVal(value, { type: "u64" });
      break;
    }
    case "i64": {
      const n = BigInt(value);
      if (n < BigInt("-9223372036854775808") || n > BigInt("9223372036854775807")) {
        throw new Error("Value must be a valid i64");
      }
      scVal = nativeToScVal(value, { type: "i64" });
      break;
    }
    case "u128": {
      const n = BigInt(value);
      if (n < BigInt(0) || n > BigInt("340282366920938463463374607431768211455")) {
        throw new Error("Value must be a valid u128");
      }
      scVal = nativeToScVal(value, { type: "u128" });
      break;
    }
    case "i128": {
      const n = BigInt(value);
      if (n < BigInt("-170141183460469231731687303715884105728") || n > BigInt("170141183460469231731687303715884105727")) {
        throw new Error("Value must be a valid i128");
      }
      scVal = nativeToScVal(value, { type: "i128" });
      break;
    }
    case "string": {
      const bytes = Buffer.from(value, "utf-8");
      scVal = xdr.ScVal.scvBytes(bytes);
      break;
    }
    case "bytes": {
      const bytes = Buffer.from(value, "hex");
      scVal = xdr.ScVal.scvBytes(bytes);
      break;
    }
    case "symbol":
      scVal = xdr.ScVal.scvSymbol(value);
      break;
    case "address":
      scVal = nativeToScVal(value, { type: "address" });
      break;
    case "vec": {
      const items = JSON.parse(value) as unknown[];
      const scVals = items.map((item, i) => {
        if (typeof item === "string") {
          return xdr.ScVal.scvSymbol(item);
        }
        if (typeof item === "number") {
          return xdr.ScVal.scvI32(item);
        }
        if (typeof item === "boolean") {
          return xdr.ScVal.scvBool(item);
        }
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
        if (typeof v === "string") {
          val = xdr.ScVal.scvSymbol(v);
        } else if (typeof v === "number") {
          val = xdr.ScVal.scvI32(v);
        } else if (typeof v === "boolean") {
          val = xdr.ScVal.scvBool(v);
        } else {
          throw new Error(`Unsupported map value type for key "${k}"`);
        }
        return new xdr.ScMapEntry({ key, val });
      });
      scVal = xdr.ScVal.scvMap(entries);
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

function decodeXdr(input: string): { result: unknown; typeName: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const attempts = [
    { name: "Transaction Envelope", method: xdr.TransactionEnvelope.fromXDR },
    { name: "Transaction Result", method: xdr.TransactionResult.fromXDR },
    { name: "Transaction Meta", method: xdr.TransactionMeta.fromXDR },
    { name: "Soroban Value (ScVal)", method: xdr.ScVal.fromXDR },
    { name: "Ledger Entry", method: xdr.LedgerEntry.fromXDR },
    { name: "Soroban Auth", method: xdr.SorobanAuthorizationEntry.fromXDR },
  ];

  for (const attempt of attempts) {
    try {
      const result = attempt.method(trimmed, "base64");
      return { result, typeName: attempt.name };
    } catch {}
  }

  return null;
}

export default function XdrToolsPage() {
  const [activeTab, setActiveTab] = useState<"decode" | "encode">("decode");

  // Decoder state
  const [decodeInput, setDecodeInput] = useState("");
  const [decoded, setDecoded] = useState<string | null>(null);
  const [detectedType, setDetectedType] = useState<string | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);

  // Encoder state
  const [encodeType, setEncodeType] = useState<ScValType>("u32");
  const [encodeValue, setEncodeValue] = useState("");
  const [encodedBase64, setEncodedBase64] = useState<string | null>(null);
  const [encodedHex, setEncodedHex] = useState<string | null>(null);
  const [encodeError, setEncodeError] = useState<string | null>(null);

  const handleDecode = () => {
    setDecodeError(null);
    setDecoded(null);
    setDetectedType(null);

    const decoded = decodeXdr(decodeInput);
    if (decoded) {
      setDetectedType(decoded.typeName);
      setDecoded(JSON.stringify(decoded.result, jsonReplacer, 2));
      toast.success(`Decoded as ${decoded.typeName}`);
    } else {
      setDecodeError("Could not decode XDR. Invalid format or unsupported type.");
      toast.error("Decoding failed");
    }
  };

  const handleEncode = () => {
    setEncodeError(null);
    setEncodedBase64(null);
    setEncodedHex(null);

    if (encodeType === "void" || encodeValue.trim()) {
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

  const clearAll = () => {
    setDecodeInput("");
    setDecoded(null);
    setDetectedType(null);
    setDecodeError(null);
    setEncodeValue("");
    setEncodedBase64(null);
    setEncodedHex(null);
    setEncodeError(null);
  };

  const getPlaceholder = (type: ScValType): string => {
    switch (type) {
      case "u32": return "42";
      case "i32": return "-42";
      case "u64": return "1234567890";
      case "i64": return "-1234567890";
      case "u128": return "340282366920938463463374607431768211455";
      case "i128": return "-170141183460469231731687303715884105728";
      case "bool": return "true";
      case "string": return "Hello, World!";
      case "bytes": return "deadbeef";
      case "symbol": return "transfer";
      case "address": return "GAAAAAAA...";
      case "vec": return '["item1", "item2"]';
      case "map": return '{"key1": "value1", "key2": 42}';
      case "void": return "(no value needed)";
    }
  };

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">XDR Tools</h1>
          <p className="text-muted-foreground">
            Decode base64 XDR strings or encode ScVal types to XDR.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={activeTab === "decode" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("decode")}
          >
            <Code className="mr-1 h-3 w-3" />
            Decode
          </Button>
          <Button
            variant={activeTab === "encode" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("encode")}
          >
            <ArrowRightLeft className="mr-1 h-3 w-3" />
            Encode
          </Button>
        </div>
      </div>

      {activeTab === "decode" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <Card className="flex h-full flex-col">
              <CardHeader>
                <CardTitle>Input</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <div className="grid w-full gap-1.5">
                  <Label htmlFor="xdr-decode-input">Base64 XDR String</Label>
                  <Textarea
                    id="xdr-decode-input"
                    placeholder="AAAAAgAAA..."
                    className="min-h-[300px] resize-none font-mono text-xs"
                    value={decodeInput}
                    onChange={(e) => setDecodeInput(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleDecode} disabled={!decodeInput} className="flex-1 gap-2">
                    <Code className="h-4 w-4" />
                    Decode
                  </Button>
                  <Button variant="outline" onClick={clearAll} disabled={!decodeInput}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {decodeError && (
                  <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-500 dark:bg-red-900/20">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    {decodeError}
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
                {decoded && (
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(decoded)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="relative min-h-[300px] flex-1">
                {decoded ? (
                  <div className="absolute inset-4 overflow-auto rounded-md bg-zinc-950 p-4 font-mono text-xs text-zinc-50">
                    <pre>{decoded}</pre>
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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <Card className="flex h-full flex-col">
              <CardHeader>
                <CardTitle>Encode ScVal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>ScVal Type</Label>
                  <Select value={encodeType} onValueChange={(v: ScValType) => { setEncodeType(v); setEncodeValue(""); setEncodedBase64(null); setEncodedHex(null); setEncodeError(null); }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SC_VAL_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {encodeType !== "void" && (
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
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button onClick={handleEncode} className="flex-1 gap-2" disabled={encodeType !== "void" && !encodeValue.trim()}>
                    <ArrowRightLeft className="h-4 w-4" />
                    Encode
                  </Button>
                  <Button variant="outline" onClick={clearAll}>
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
