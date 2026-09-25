"use client";

import { ContractArg } from "@devconsole/soroban-utils";
import { useState } from "react";
import { Input } from "@devconsole/ui";
import { Label } from "@devconsole/ui";
import { Textarea } from "@devconsole/ui";

interface AbiInputFieldProps {
  arg: ContractArg;
  onChange: (id: string, value: string) => void;
  /** #1032: whether nested struct/map argument is expanded (accordion). */
  expanded?: boolean;
  /** #1032: notify parent when the user collapses/expands this argument. */
  onToggleCollapse?: (id: string) => void;
}

export function AbiInputField({
  arg,
  onChange,
  expanded = true,
  onToggleCollapse,
}: AbiInputFieldProps) {
  const [rawXdrMode, setRawXdrMode] = useState(false);
  const isComplex = arg.type === "vec" || arg.type === "map";
  const isCollapsible = isComplex;
  const isOpen = isCollapsible ? expanded : true;

  // #1032: human-readable summary shown in the collapsed accordion header.
  const nestedSummary = () => {
    if (!arg.value || !arg.value.trim()) return "empty";
    if (arg.type === "vec") {
      const decoded = JSON.parse(arg.value);
      return Array.isArray(decoded) ? `${decoded.length} item${decoded.length === 1 ? "" : "s"}` : "invalid JSON";
    }
    if (arg.type === "map") {
      const decoded = JSON.parse(arg.value);
      const keys = Object.keys(decoded);
      return `${keys.length} key${keys.length === 1 ? "" : "s"}`;
    }
    return arg.value.length > 24 ? `${arg.value.length} chars` : arg.value;
  };

  return (
    <div className="flex-1 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <input type="checkbox" id={`xdr-${arg.id}`} checked={rawXdrMode} onChange={(e) => setRawXdrMode(e.target.checked)} />
          <label htmlFor={`xdr-${arg.id}`} className="text-[9px] uppercase cursor-pointer">Raw XDR Mode</label>
        </div>
      </div>

      {!rawXdrMode && isCollapsible && (
        <button
          type="button"
          id={`toggle-${arg.id}`}
          onClick={() => onToggleCollapse?.(arg.id)}
          aria-expanded={isOpen}
          aria-controls={`body-${arg.id}`}
          className="flex w-full items-center justify-between rounded-md border border-muted px-3 py-2 text-left text-[10px] font-medium"
        >
          <span className="truncate">
            {isOpen ? "−" : "+"} {arg.name || "Argument"}
            <span className="ml-1 text-muted-foreground">
              ({arg.type})
            </span>
          </span>
          {!isOpen && (
            <span className="ml-2 truncate font-mono text-[10px] text-muted-foreground">
              {nestedSummary()}
            </span>
          )}
        </button>
      )}

      {isCollapsible && !isOpen ? null : rawXdrMode ? (
        <Textarea
          id={arg.id}
          rows={3}
          placeholder="Enter raw XDR (base64)..."
          value={arg.value}
          onChange={(e) => onChange(arg.id, e.target.value)}
          className="font-mono text-xs"
        />
      ) : isComplex ? (
        <Textarea
          id={arg.id}
          rows={arg.type === "vec" ? 3 : 5}
          placeholder={arg.type === "vec" ? "[item1, item2]" : '{"key": "value"}'}
          value={arg.value}
          onChange={(e) => onChange(arg.id, e.target.value)}
          className="font-mono text-xs"
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
      )}
    </div>
  );
}
