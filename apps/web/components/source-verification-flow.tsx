"use client";

import { useState, useEffect } from "react";
import { getRegisteredSource, type NetworkConfig } from "@/lib/source-registry";
import {
  getVerificationLabel,
  resolveVerificationStatus,
  type SourceVerification,
  type VerificationStatus,
} from "@/lib/source-verification";
import { useNetworkStore } from "@/store/useNetworkStore";
import { useWallet } from "@/store/useWallet";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@devconsole/ui";
import { Button } from "@devconsole/ui";
import { Input } from "@devconsole/ui";
import { Label } from "@devconsole/ui";
import { Badge } from "@devconsole/ui";
import {
  ShieldCheck,
  ShieldOff,
  ShieldAlert,
  ExternalLink,
  Upload,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface SourceVerificationFlowProps {
  contractId: string;
  wasmHash?: string;
  className?: string;
}

const REGISTRY_CONTRACTS: Record<string, string> = {
  testnet: "CBLR7BHW4S3FK4QYRM5G3FFYV4F5YV4Z5W5X5Z5Z5Z5Z5Z5Z5Z5Z5Z5",
  mainnet: "CBLR7BHW4S3FK4QYRM5G3FFYV4F5YV4Z5W5X5Z5Z5Z5Z5Z5Z5Z5Z5Z5",
};

function VerificationIcon({ status }: { status: VerificationStatus }) {
  switch (status) {
    case "confirmed":
      return <ShieldCheck className="h-5 w-5 text-green-500" />;
    case "inferred":
      return <ShieldAlert className="h-5 w-5 text-yellow-500" />;
    case "pending":
      return <ShieldAlert className="h-5 w-5 text-blue-500" />;
    default:
      return <ShieldOff className="h-5 w-5 text-gray-400" />;
  }
}

function getStatusBadgeVariant(
  status: VerificationStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "confirmed":
      return "default";
    case "inferred":
      return "secondary";
    case "pending":
      return "outline";
    default:
      return "outline";
  }
}

export function SourceVerificationFlow({
  contractId,
  wasmHash,
  className,
}: SourceVerificationFlowProps) {
  const { getActiveNetworkConfig } = useNetworkStore();
  const { isConnected } = useWallet();
  const [verification, setVerification] = useState<SourceVerification | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [repoUrl, setRepoUrl] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkVerification() {
      setLoading(true);
      try {
        const network = getActiveNetworkConfig();
        const registryId = REGISTRY_CONTRACTS[network.id];

        if (!registryId) {
          setVerification({ status: "unknown" });
          return;
        }

        const sourceUrl = await getRegisteredSource(
          network as NetworkConfig,
          registryId,
          contractId,
        );

        if (cancelled) return;

        const status = resolveVerificationStatus(wasmHash, sourceUrl);
        setVerification({
          status,
          sourceUrl: sourceUrl || undefined,
          verifiedAt: status === "confirmed" ? new Date().toISOString() : undefined,
        });
      } catch {
        if (!cancelled) {
          setVerification({ status: "unknown" });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void checkVerification();
    return () => {
      cancelled = true;
    };
  }, [contractId, wasmHash, getActiveNetworkConfig]);

  const handleVerify = async () => {
    if (!repoUrl.trim()) {
      toast.error("Please enter a repository URL");
      return;
    }

    setIsVerifying(true);
    try {
      setVerification({
        status: "pending",
        sourceUrl: repoUrl,
      });
      toast.success(
        "Verification initiated. The source registry will be updated once confirmed.",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Verification failed: ${message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">
            Checking verification status...
          </span>
        </CardContent>
      </Card>
    );
  }

  const status = verification?.status || "unknown";

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <VerificationIcon status={status} />
          Source Verification
          <Badge variant={getStatusBadgeVariant(status)}>
            {getVerificationLabel(status)}
          </Badge>
        </CardTitle>
        <CardDescription>
          Verify that the deployed contract matches its published source code.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === "confirmed" && verification?.sourceUrl && (
          <div className="space-y-3">
            <div className="rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
              <p className="text-sm text-green-800 dark:text-green-300">
                Source code verified. This contract matches the published source.
              </p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Repository:</span>
                <a
                  href={verification.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  {verification.sourceUrl}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              {verification.verifiedAt && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Verified:</span>
                  <span>
                    {new Date(verification.verifiedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {status === "inferred" && verification?.sourceUrl && (
          <div className="space-y-3">
            <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-900/20">
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                Source URL registered but not yet confirmed. Verification is
                inferred.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Source:</span>
              <a
                href={verification.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                {verification.sourceUrl}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}

        {(status === "unknown" || status === "pending") && (
          <div className="space-y-4">
            <div className="rounded-md border border-dashed p-4 text-center">
              <ShieldOff className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                This contract has not been verified. Verify the source code to
                establish trust.
              </p>
            </div>

            {isConnected && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="repo-url">Repository URL</Label>
                  <Input
                    id="repo-url"
                    placeholder="https://github.com/owner/repo"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleVerify}
                  disabled={isVerifying || !repoUrl.trim()}
                  className="w-full gap-2"
                >
                  {isVerifying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Verify Source
                </Button>
              </div>
            )}

            {!isConnected && (
              <p className="text-xs text-muted-foreground text-center">
                Connect a wallet to verify source code.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
