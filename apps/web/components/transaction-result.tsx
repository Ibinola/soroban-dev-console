"use client";

import { CheckCircle2, XCircle, Clock, AlertCircle, ExternalLink, Copy, FileText } from "lucide-react";
import { Button } from "@devconsole/ui";
import { Badge } from "@devconsole/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@devconsole/ui";
import { toast } from "sonner";
import type { TxResult } from "@/lib/tx-orchestrator";
import type { NormalizedSimulationResult } from "@devconsole/soroban-utils";

export interface TransactionResultProps {
  result: TxResult;
  title?: string;
  description?: string;
  showSimulation?: boolean;
  compact?: boolean;
  actions?: React.ReactNode;
}

export function TransactionResult({
  result,
  title,
  description,
  showSimulation = true,
  compact = false,
  actions,
}: TransactionResultProps) {
  const isSuccess = result.status === "success";
  const isError = result.status === "error";

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const getStatusIcon = () => {
    if (isSuccess) return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    if (isError) return <XCircle className="h-5 w-5 text-red-500" />;
    return <Clock className="h-5 w-5 text-blue-500" />;
  };

  const getStatusBadge = () => {
    const variant = isSuccess ? "default" : isError ? "destructive" : "secondary";
    const text = isSuccess ? "Success" : isError ? "Failed" : "Pending";
    return <Badge variant={variant}>{text}</Badge>;
  };

  const renderSimulationDetails = (simulation: NormalizedSimulationResult) => {
    if (!showSimulation || compact) return null;

    return (
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-medium mb-2">Simulation Details</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Cost:</span>
              <span className="ml-2 font-mono">{simulation.cost?.toString() || "N/A"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">CPU Instructions:</span>
              <span className="ml-2 font-mono">{simulation.cpuInstructions || "N/A"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Memory Bytes:</span>
              <span className="ml-2 font-mono">{simulation.memoryBytes || "N/A"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Min Resource Fee:</span>
              <span className="ml-2 font-mono">{simulation.minResourceFee?.toString() || "N/A"}</span>
            </div>
          </div>
        </div>

        {simulation.events && simulation.events.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Events</h4>
            <div className="max-h-32 overflow-y-auto border rounded-md p-2">
              <pre className="text-xs">{JSON.stringify(simulation.events, null, 2)}</pre>
            </div>
          </div>
        )}

        {simulation.auth && (
          <div>
            <h4 className="text-sm font-medium mb-2">Authorization Requirements</h4>
            <div className="text-sm">
              {simulation.auth.map((auth, index) => (
                <div key={index} className="mb-1">
                  <Badge variant="outline" className="text-xs">
                    {auth.type === "public_key" ? "Public Key" : "Contract"}
                  </Badge>
                  <span className="ml-2 font-mono text-xs">{auth.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 p-3 border rounded-lg">
        {getStatusIcon()}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            {title && <span className="font-medium">{title}</span>}
          </div>
          {result.hash && (
            <div className="text-xs text-muted-foreground">
              Hash: <span className="font-mono">{result.hash.slice(0, 8)}…</span>
            </div>
          )}
          {result.errorMessage && (
            <div className="text-xs text-red-600">{result.errorMessage}</div>
          )}
        </div>
        {actions}
      </div>
    );
  }

  return (
    <Card className={isError ? "border-red-200" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div>
              <CardTitle className="text-lg">
                {title || (isSuccess ? "Transaction Successful" : isError ? "Transaction Failed" : "Transaction Pending")}
              </CardTitle>
              {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
            </div>
            {getStatusBadge()}
          </div>
          {actions}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Transaction Hash */}
        {result.hash && (
          <div>
            <h4 className="text-sm font-medium mb-2">Transaction Hash</h4>
            <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
              <code className="flex-1 text-sm font-mono">{result.hash}</code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(result.hash!)}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                asChild
              >
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${result.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {result.errorMessage && (
          <div>
            <h4 className="text-sm font-medium mb-2 text-red-600">Error Details</h4>
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{result.errorMessage}</p>
            </div>
          </div>
        )}

        {/* Simulation Results */}
        {result.simulation && renderSimulationDetails(result.simulation)}

        {/* Transaction Result XDR */}
        {result.resultXdr && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              Result XDR
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(result.resultXdr as string)}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </h4>
            <div className="max-h-40 overflow-y-auto border rounded-md p-2">
              <pre className="text-xs">{result.resultXdr}</pre>
            </div>
          </div>
        )}

        {/* Transaction Meta XDR */}
        {result.resultMetaXdr && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              Meta XDR
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(result.resultMetaXdr as string)}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </h4>
            <div className="max-h-40 overflow-y-auto border rounded-md p-2">
              <pre className="text-xs">{result.resultMetaXdr}</pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Compact transaction result for inline display
 */
export function CompactTransactionResult({ result, className }: { result: TxResult; className?: string }) {
  const isSuccess = result.status === "success";

  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      {isSuccess ? (
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500" />
      )}
      <span className={isSuccess ? "text-green-700" : "text-red-700"}>
        {result.status === "success" && result.hash
          ? `Success: ${result.hash.slice(0, 8)}…`
          : result.status === "error"
          ? `Error: ${result.errorMessage || "Unknown error"}`
          : "Pending"}
      </span>
    </div>
  );
}

/**
 * Transaction result for deployment flows
 */
export function DeployTransactionResult({ result, contractId }: { result: TxResult; contractId?: string }) {
  const title = result.status === "success" ? "Deployment Successful" : "Deployment Failed";
  const description = result.status === "success" && contractId
    ? `Contract deployed with ID: ${contractId}`
    : undefined;

  return (
    <TransactionResult
      result={result}
      title={title}
      description={description}
      showSimulation={true}
    />
  );
}

/**
 * Transaction result for contract calls
 */
export function CallTransactionResult({ result, functionName }: { result: TxResult; functionName?: string }) {
  const title = result.status === "success" ? "Call Successful" : "Call Failed";
  const description = result.status === "success" && functionName
    ? `Function ${functionName} executed successfully`
    : undefined;

  return (
    <TransactionResult
      result={result}
      title={title}
      description={description}
      showSimulation={true}
    />
  );
}

/**
 * Transaction result for batch operations
 */
export function BatchTransactionResult({ result, operationCount }: { result: TxResult; operationCount: number }) {
  const title = result.status === "success" ? "Batch Successful" : "Batch Failed";
  const description = result.status === "success"
    ? `${operationCount} operation${operationCount !== 1 ? "s" : ""} executed successfully`
    : undefined;

  return (
    <TransactionResult
      result={result}
      title={title}
      description={description}
      showSimulation={false} // Batch operations typically show individual operation results
    />
  );
}
