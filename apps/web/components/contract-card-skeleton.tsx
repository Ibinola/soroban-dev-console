"use client";

import { Card, CardContent, CardHeader, Skeleton } from "@devconsole/ui";

/**
 * Skeleton placeholder for contract spec/info cards.
 * Renders an animated pulse layout matching the shape of the
 * Contract Info, Function List, and related spec panels.
 */
export function ContractCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <Skeleton className="h-5 w-36" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-3/5" />
        <div className="pt-2">
          <Skeleton className="h-8 w-full rounded-md" />
        </div>
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </CardContent>
    </Card>
  );
}

/**
 * Full-page skeleton for the contract detail view.
 * Shows the header area and a grid of card skeletons
 * matching the 3-column layout used on the contract page.
 */
export function ContractDetailSkeleton() {
  return (
    <div className="container mx-auto space-y-8 p-6" aria-busy="true" aria-label="Loading contract details">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex min-w-0 items-center gap-4">
          <Skeleton className="h-10 w-10 shrink-0 rounded-md" />
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>

      <div className="space-y-4">
        <Skeleton className="h-10 w-64 rounded-md" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <ContractCardSkeleton className="md:col-span-1" />
          <div className="space-y-4 md:col-span-2">
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-3/4" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
