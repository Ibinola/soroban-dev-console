"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  AlertCircle,
  FileCode,
  Package,
  ExternalLink,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Badge } from "@devconsole/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@devconsole/ui";
import { Button } from "@devconsole/ui";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@devconsole/ui";
import {
  diagnoseDependencies,
  getRecoveryActions,
  formatDiagnosticSummary,
  type DependencyDiagnostics,
  type DependencyIssue,
} from "@/lib/dependency-diagnostics";
import type { SerializedWorkspace } from "@/lib/workspace-serializer";
import type { NormalizedContractSpec } from "@devconsole/soroban-utils";
import type { WasmEntry } from "@/store/useWasmStore";

interface DependencyDiagnosticsProps {
  workspace: SerializedWorkspace;
  abiSpecs: Record<string, NormalizedContractSpec>;
  wasms: WasmEntry[];
  className?: string;
}

export function DependencyDiagnostics({
  workspace,
  abiSpecs,
  wasms,
  className,
}: DependencyDiagnosticsProps) {
  const diagnostics = useMemo(
    () => diagnoseDependencies(workspace, abiSpecs, wasms),
    [workspace, abiSpecs, wasms],
  );

  const recoveryActions = useMemo(
    () => getRecoveryActions(diagnostics.issues),
    [diagnostics.issues],
  );

  if (!diagnostics.hasIssues) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/20 dark:text-green-300">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span className="font-medium">All dependencies resolved</span>
        </div>
      </div>
    );
  }

  const getIssueIcon = (type: DependencyIssue["type"]) => {
    switch (type) {
      case "missing-abi":
        return <FileCode className="h-4 w-4" />;
      case "missing-wasm":
        return <Package className="h-4 w-4" />;
      case "broken-reference":
        return <XCircle className="h-4 w-4" />;
      case "incomplete-artifact":
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: DependencyIssue["severity"]) => {
    switch (severity) {
      case "error":
        return "text-red-600 bg-red-50 border-red-200 dark:bg-red-950/20 dark:text-red-300";
      case "warning":
        return "text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:text-yellow-300";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200 dark:bg-gray-950/20 dark:text-gray-300";
    }
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Dependency Diagnostics
            <Badge variant={diagnostics.summary.errors > 0 ? "destructive" : "secondary"}>
              {diagnostics.summary.errors} Error{diagnostics.summary.errors !== 1 ? "s" : ""}
            </Badge>
            <Badge variant={diagnostics.summary.warnings > 0 ? "outline" : "secondary"}>
              {diagnostics.summary.warnings} Warning{diagnostics.summary.warnings !== 1 ? "s" : ""}
            </Badge>
          </CardTitle>
          <CardDescription>
            {formatDiagnosticSummary(diagnostics)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Issues List */}
          <div className="space-y-3">
            {diagnostics.issues.map((issue, index) => (
              <div
                key={`${issue.type}-${index}`}
                className={cn(
                  "flex items-start gap-3 rounded-md border p-3",
                  getSeverityColor(issue.severity),
                )}
              >
                <div className="shrink-0">
                  {getIssueIcon(issue.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{issue.entityType}</span>
                    <Badge variant="outline" className="text-xs">
                      {issue.type.replace("-", " ")}
                    </Badge>
                    <Badge
                      variant={issue.severity === "error" ? "destructive" : "secondary"}
                      className="text-xs"
                    >
                      {issue.severity}
                    </Badge>
                  </div>
                  <p className="text-sm">{issue.description}</p>
                  {issue.recoveryPath && (
                    <p className="text-xs text-muted-foreground mt-1">
                      <strong>Recovery:</strong> {issue.recoveryPath}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Recovery Actions */}
          {recoveryActions.length > 0 && (
            <Collapsible className="border-t pt-4">
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Recovery Actions ({recoveryActions.length})
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 mt-3">
                {recoveryActions.map((action, index) => (
                  <div
                    key={`${action.action}-${index}`}
                    className="rounded-md border p-3"
                  >
                    <h4 className="font-medium mb-2">{action.description}</h4>
                    <div className="space-y-2">
                      {action.issues.map((issue, issueIndex) => (
                        <div
                          key={`${issue.entityId}-${issueIndex}`}
                          className="flex items-center gap-2 text-sm"
                        >
                          <Badge variant="outline" className="text-xs">
                            {issue.type.replace("-", " ")}
                          </Badge>
                          <span>{issue.entityId}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Summary by Type */}
          <div className="rounded-md border p-3">
            <h4 className="font-medium mb-3">Issue Summary by Type</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {Object.entries(diagnostics.summary.byType).map(([type, count]) => (
                <div key={type} className="flex items-center gap-2">
                  <span className="font-medium">{type.replace("-", " ")}:</span>
                  <Badge variant={count > 0 ? "destructive" : "secondary"}>
                    {count}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
