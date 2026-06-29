"use client";

import { useEffect } from "react";
import { Button } from "@devconsole/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@devconsole/ui";
import { AlertCircle, RefreshCcw, Copy, Home } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an external service if needed
    console.error("Application Crash:", error);
  }, [error]);

  const copyDiagnosticReport = () => {
    const report = {
      message: error.message,
      stack: error.stack,
      digest: error.digest,
      timestamp: new Date().toISOString(),
      url: window.location.href,
    };
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    toast.success("Diagnostic report copied to clipboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md border-destructive/50 shadow-lg">
        <CardHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>Application Error</CardTitle>
          <CardDescription>
            Something went wrong while rendering this page. This might be due to
            a network timeout or an unexpected contract response.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md bg-muted p-3">
            <p className="text-sm text-muted-foreground">
              Please try reloading the page. If the problem persists, you can copy the diagnostic report and contact support.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <div className="flex w-full gap-2">
            <Button onClick={() => reset()} className="flex-1">
              <RefreshCcw className="mr-2 h-4 w-4" /> Try Again
            </Button>
            <Button variant="outline" onClick={copyDiagnosticReport}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="ghost" asChild className="w-full">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" /> Return Home
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
