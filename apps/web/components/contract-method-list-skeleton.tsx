"use client";

import { Skeleton } from "@devconsole/ui";

export function ContractMethodListSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading contract methods"
      aria-busy="true"
      className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5"
    >
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          data-testid="method-skeleton-item"
          className={`flex h-9 items-center rounded-md border px-3 ${
            index === 3 ? "hidden sm:flex" : index === 4 ? "hidden lg:flex" : ""
          }`}
        >
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
      <span className="sr-only">Loading contract methods...</span>
    </div>
  );
}
