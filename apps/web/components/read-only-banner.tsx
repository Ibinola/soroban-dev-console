"use client";

/**
 * FE-234: Standalone read-only banner for the shared workspace view.
 * Replaces the inline div so the read-only affordance is reusable and testable.
 */

import { Eye } from "lucide-react";
import { Badge } from "@devconsole/ui";

interface ReadOnlyBannerProps {
  isExpired?: boolean;
}

export function ReadOnlyBanner({ isExpired = false }: ReadOnlyBannerProps) {
  return (
    <div
      role="status"
      aria-label="Read-only workspace"
      data-testid="read-only-banner"
      className="flex items-center justify-between gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300"
    >
      <span className="flex items-center gap-2">
        <Eye className="h-4 w-4 shrink-0" aria-hidden />
        <span>
          <strong>Read-only</strong> shared workspace — editing is disabled.
          Fork this workspace to make changes.
        </span>
      </span>
      {isExpired && (
        <Badge variant="destructive" className="shrink-0">
          Expired
        </Badge>
      )}
    </div>
  );
}
