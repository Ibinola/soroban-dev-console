"use client";

import { useState, useCallback } from "react";
import type { TraceNode } from "@/lib/invocation-trace";
import { toggleNode } from "@/lib/invocation-trace";
import { useContractStore } from "@/store/useContractStore";
import {
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Shield,
} from "lucide-react";
import { Badge } from "@devconsole/ui";
import { cn } from "@devconsole/ui";

interface InvocationTraceViewProps {
  trace: TraceNode;
  className?: string;
}

function getCallStatus(node: TraceNode): "success" | "error" | "auth-required" {
  if (node.result?.startsWith("Error") || node.result?.includes("ERR")) {
    return "error";
  }
  if (node.functionName.includes("auth") || node.args.some((a) => a.includes("auth"))) {
    return "auth-required";
  }
  return "success";
}

function StatusIcon({ status }: { status: "success" | "error" | "auth-required" }) {
  switch (status) {
    case "success":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "error":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "auth-required":
      return <Shield className="h-4 w-4 text-yellow-500" />;
  }
}

function getStatusColor(status: "success" | "error" | "auth-required") {
  switch (status) {
    case "success":
      return "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20";
    case "error":
      return "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20";
    case "auth-required":
      return "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20";
  }
}

function TraceNodeComponent({
  node,
  depth,
  onToggle,
  contractNames,
}: {
  node: TraceNode;
  depth: number;
  onToggle: (id: string) => void;
  contractNames: Map<string, string>;
}) {
  const status = getCallStatus(node);
  const hasChildren = node.children.length > 0;
  const contractLabel =
    contractNames.get(node.contractId) ||
    (node.contractId.length > 12
      ? node.contractId.slice(0, 8) + "..."
      : node.contractId);

  return (
    <div className={cn("rounded-md border p-2", getStatusColor(status))}>
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => onToggle(node.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onToggle(node.id);
        }}
        aria-expanded={hasChildren ? node.expanded : undefined}
      >
        {hasChildren ? (
          node.expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )
        ) : (
          <div className="w-4" />
        )}

        <StatusIcon status={status} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-medium text-primary">
              {contractLabel}
            </span>
            <span className="text-muted-foreground">.</span>
            <span className="font-medium text-sm">{node.functionName}</span>
            {hasChildren && (
              <Badge variant="secondary" className="text-[10px]">
                {node.children.length} sub-call{node.children.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {node.expanded && (
        <div className="mt-2 space-y-2 pl-6">
          {node.args.length > 0 && (
            <div>
              <span className="text-[10px] font-medium text-muted-foreground uppercase">
                Arguments
              </span>
              <div className="mt-1 space-y-1">
                {node.args.map((arg, i) => (
                  <div
                    key={i}
                    className="font-mono text-xs break-all rounded bg-background/50 px-2 py-1"
                  >
                    <span className="text-muted-foreground">[{i}]</span> {arg}
                  </div>
                ))}
              </div>
            </div>
          )}

          {node.result && (
            <div>
              <span className="text-[10px] font-medium text-muted-foreground uppercase">
                Result
              </span>
              <div
                className={cn(
                  "mt-1 font-mono text-xs break-all rounded px-2 py-1",
                  status === "error"
                    ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                    : "bg-background/50",
                )}
              >
                {node.result}
              </div>
            </div>
          )}

          <div className="font-mono text-[10px] text-muted-foreground">
            Contract: {node.contractId}
          </div>
        </div>
      )}

      {/* Nested children */}
      {node.expanded && hasChildren && (
        <div className="mt-2 ml-4 space-y-2 border-l-2 border-muted pl-2">
          {node.children.map((child) => (
            <TraceNodeComponent
              key={child.id}
              node={child}
              depth={depth + 1}
              onToggle={onToggle}
              contractNames={contractNames}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function InvocationTraceView({
  trace,
  className,
}: InvocationTraceViewProps) {
  const { contracts } = useContractStore();
  const [root, setRoot] = useState(trace);

  const contractNames = new Map(
    contracts.map((c) => [c.id, c.name || c.id]),
  );

  const handleToggle = useCallback(
    (targetId: string) => {
      setRoot((prev) => toggleNode(prev, targetId));
    },
    [],
  );

  return (
    <div className={cn("space-y-1", className)}>
      <TraceNodeComponent
        node={root}
        depth={0}
        onToggle={handleToggle}
        contractNames={contractNames}
      />
    </div>
  );
}

export function EmptyTraceView({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-md border border-dashed p-8 text-muted-foreground",
        className,
      )}
    >
      No invocation trace data available for this transaction.
    </div>
  );
}
