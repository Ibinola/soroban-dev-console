"use client";

import { DependencyGraph } from "@/components/contract-dependency-graph";
import { Button } from "@devconsole/ui";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function DependencyGraphPage() {
  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Link href="/contracts">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            Back to Contracts
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Dependency Graph
          </h1>
          <p className="text-sm text-muted-foreground">
            Visualize inter-contract call relationships in your workspace.
          </p>
        </div>
      </div>
      <DependencyGraph />
    </div>
  );
}
