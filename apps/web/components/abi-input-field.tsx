"use client";

import { ContractArg } from "@devconsole/soroban-utils";
import { useState } from "react";
import { Input } from "@devconsole/ui";
import { Label } from "@devconsole/ui";
import { Textarea } from "@devconsole/ui";

interface AbiInputFieldProps {
  arg: ContractArg;
  onChange: (id: string, value: string) => void;
}

export function AbiInputField({ arg, onChange }: AbiInputFieldProps) {
  const [rawXdrMode, setRawXdrMode] = useState(false);
  const isComplex = arg.type === "vec" || arg.type === "map";

  return (
    <div className="flex-1 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <input type="checkbox" id={`xdr-${arg.id}`} checked={rawXdrMode} onChange={(e) => setRawXdrMode(e.target.checked)} />
          <label htmlFor={`xdr-${arg.id}`} className="text-[9px] uppercase cursor-pointer">Raw XDR Mode</label>
        </div>
        <Label htmlFor={arg.id} className="text-[10px] font-bold uppercase text-muted-foreground">
          {arg.name || "Argument"}
          <span className="ml-1 font-mono lowercase opacity-60">
            ({arg.type})
          </span>
        </Label>
      </div>

      {rawXdrMode ? (
        <Textarea
          id={arg.id}
          placeholder="Enter raw XDR (base64)..."
          value={arg.value}
          onChange={(e) => onChange(arg.id, e.target.value)}
          className="min-h-[80px] font-mono text-xs"
        />
      ) : isComplex ? (
        <Textarea
          id={arg.id}
          placeholder={
            arg.type === "vec" ? "[item1, item2]" : '{"key": "value"}'
          }
          value={arg.value}
          onChange={(e) => onChange(arg.id, e.target.value)}
          className="min-h-[80px] font-mono text-xs"
        />
      ) : (
        <Input
          id={arg.id}
          type={arg.type === "i32" ? "number" : "text"}
          placeholder={`Enter ${arg.type}...`}
          value={arg.value}
          onChange={(e) => onChange(arg.id, e.target.value)}
          className="h-9"
        />
      ))}
    </div>
  );
}
