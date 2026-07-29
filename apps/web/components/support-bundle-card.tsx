"use client";

import { useState } from "react";
import { Button } from "@devconsole/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@devconsole/ui";
import { FileArchive, Download } from "lucide-react";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { useSavedCallsStore } from "@/store/useSavedCallsStore";
import {
  useNetworkStore,
  DEFAULT_NETWORKS,
  type NetworkConfig,
} from "@/store/useNetworkStore";
import { STORE_SCHEMA_VERSION } from "@/store/schema-version";
import {
  generateSupportBundle,
  downloadSupportBundle,
  type SupportBundle,
} from "@/lib/support-bundle";

/**
 * FE-039: Lets the user generate a redacted diagnostic support bundle from the
 * settings page, preview exactly what it contains, and download it. Owner keys
 * are never included and addresses are truncated.
 */
export function SupportBundleCard() {
  const getActiveWorkspace = useWorkspaceStore((s) => s.getActiveWorkspace);
  const savedCalls = useSavedCallsStore((s) => s.savedCalls);
  const { currentNetwork, customNetworks } = useNetworkStore();
  const [preview, setPreview] = useState<SupportBundle | null>(null);

  const resolveNetwork = (): NetworkConfig =>
    DEFAULT_NETWORKS[currentNetwork] ??
    customNetworks.find((n) => n.id === currentNetwork) ??
    DEFAULT_NETWORKS.testnet;

  const handleGenerate = () => {
    setPreview(
      generateSupportBundle(
        getActiveWorkspace(),
        savedCalls,
        resolveNetwork(),
        STORE_SCHEMA_VERSION,
      ),
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Support Bundle</CardTitle>
        <CardDescription>
          Generate a redacted diagnostic bundle to attach to bug reports. Owner
          keys are never included and addresses are truncated.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button variant="outline" onClick={handleGenerate}>
          <FileArchive className="mr-2 h-4 w-4" />
          Generate Support Bundle
        </Button>

        {preview && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Review the data below before downloading. No private keys are
              included.
            </p>
            <pre className="max-h-72 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
              {JSON.stringify(preview, null, 2)}
            </pre>
            <div className="flex gap-3">
              <Button onClick={() => downloadSupportBundle(preview)}>
                <Download className="mr-2 h-4 w-4" />
                Download Bundle
              </Button>
              <Button variant="ghost" onClick={() => setPreview(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
