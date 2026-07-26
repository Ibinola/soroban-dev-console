"use client";

import { ContractArg } from "@devconsole/soroban-utils";
import { Input } from "@devconsole/ui";
import { Label } from "@devconsole/ui";
import { Textarea } from "@devconsole/ui";

interface AbiInputFieldProps {
  arg: ContractArg;
  onChange: (id: string, value: string) => void;
}

export function AbiInputField({ arg, onChange }: AbiInputFieldProps) {
  const isComplex = arg.type === "vec" || arg.type === "map";

  return (
    <div className="flex-1 space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={arg.id} className="text-[10px] font-bold uppercase text-muted-foreground">
          {arg.name || "Argument"}
          <span className="ml-1 font-mono lowercase opacity-60">
            ({arg.type})
          </span>
        </Label>
      </div>

      {isComplex ? (
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
      )}
    </div>
  );
}
