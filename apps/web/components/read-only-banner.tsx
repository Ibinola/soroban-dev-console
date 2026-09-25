"use client";

/**
 * FE-234 / Issue #1118: Standalone read-only banner for the shared
 * workspace view. Replaces the inline div so the read-only affordance is
 * reusable and testable, and carries the "Fork to My Workspaces" CTA so
 * the action is available directly from the banner, not just the page
 * header below it.
 */

import { Eye, GitFork } from "lucide-react";
import { Badge, Button } from "@devconsole/ui";

interface ReadOnlyBannerProps {
  isExpired?: boolean;
  onFork?: () => void;
}

export function ReadOnlyBanner({ isExpired = false, onFork }: ReadOnlyBannerProps) {
  return (
    <div
      role="status"
      aria-label="Read-only workspace"
      data-testid="read-only-banner"
      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300"
    >
      <span className="flex items-center gap-2">
        <Eye className="h-4 w-4 shrink-0" aria-hidden />
        <span>
          <strong>Read-Only Shared Workspace Preview</strong> — editing is
          disabled. Fork this workspace to make changes.
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {isExpired && <Badge variant="destructive">Expired</Badge>}
        {onFork && (
          <Button
            size="sm"
            variant="default"
            className="gap-2"
            onClick={onFork}
            disabled={isExpired}
            data-testid="read-only-banner-fork-button"
          >
            <GitFork className="h-4 w-4" />
            Fork to My Workspaces
          </Button>
        )}
      </span>
    </div>
  );
}
