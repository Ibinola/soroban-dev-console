"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { sharesApi } from "@/lib/api/workspaces";
import { ShareDetail } from "@devconsole/api-contracts";
import { deserializeWorkspace, type SerializedWorkspace } from "@/lib/workspace-serializer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@devconsole/ui";
import { Badge } from "@devconsole/ui";
import { AlertTriangle, Eye, FileCode, Loader2 } from "lucide-react";

type PageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; link: ShareDetail; payload: SerializedWorkspace };

export default function SharedWorkspacePage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<PageState>({ status: "loading" });

  useEffect(() => {
    if (!token) return;

    sharesApi
      .get(token)
      .then((link) => {
        const payload = deserializeWorkspace(link.snapshotJson);
        setState({ status: "ready", link, payload });
      })
      .catch((err: unknown) => {
        // BE-010: API now returns 403 for revoked and 410 for expired.
        // Fall back to a generic message for other errors.
        let msg = "Share link not found.";
        if (err instanceof Error) {
          msg = err.message;
        } else if (typeof err === "object" && err !== null && "status" in err) {
          const status = (err as { status: number }).status;
          if (status === 403) msg = "This share link has been revoked.";
          else if (status === 410) msg = "This share link has expired.";
        }
        setState({ status: "error", message: msg });
      });
  }, [token]);

  if (state.status === "loading") {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading shared workspace…
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="container mx-auto max-w-lg p-8">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Link Unavailable
            </CardTitle>
            <CardDescription>{state.message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { payload } = state;

  return (
    <div className="container mx-auto max-w-3xl space-y-6 p-6">
      {/* Read-only banner */}
      <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
        <Eye className="h-4 w-4 shrink-0" />
        <span>
          This is a <strong>read-only</strong> shared workspace. You cannot make
          changes.
        </span>
      </div>

      {/* Workspace header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {payload.workspace.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Network:{" "}
          <Badge variant="secondary">{payload.workspace.selectedNetwork}</Badge>
          &nbsp;·&nbsp;Exported{" "}
          {new Date(payload.exportedAt).toLocaleDateString()}
        </p>
      </div>

      {/* Contracts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contracts</CardTitle>
        </CardHeader>
        <CardContent>
          {payload.contracts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contracts in this workspace.</p>
          ) : (
            <ul className="space-y-2">
              {payload.contracts.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-sm"
                >
                  <FileCode className="h-4 w-4 shrink-0 text-blue-500" />
                  <span className="flex-1 truncate">{c.id}</span>
                  <Badge variant="outline">{c.network}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Saved calls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Saved Calls</CardTitle>
        </CardHeader>
        <CardContent>
          {payload.savedCalls.length === 0 ? (
            <p className="text-sm text-muted-foreground">No saved calls in this workspace.</p>
          ) : (
            <ul className="space-y-2">
              {payload.savedCalls.map((c) => (
                <li
                  key={c.id}
                  className="rounded-md border px-3 py-2 text-sm"
                >
                  <div className="font-medium">{c.name || c.fnName}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.contractId} · {c.fnName}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
