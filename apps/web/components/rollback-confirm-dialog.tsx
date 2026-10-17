"use client";

import { useState } from "react";
import { History } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@devconsole/ui";
import { Button } from "@devconsole/ui";
import { summarizeRollback, type RollbackTarget } from "@/lib/deployment-rollback";

interface RollbackConfirmDialogProps {
  target: RollbackTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (target: RollbackTarget) => void;
}

export function RollbackConfirmDialog({
  target,
  open,
  onOpenChange,
  onConfirm,
}: RollbackConfirmDialogProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  if (!target) return null;
  const rows = summarizeRollback(target);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setAcknowledged(false);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Roll back to previous version?
          </DialogTitle>
          <DialogDescription>
            This restores the WASM from your previous successful deployment. Review the
            differences below before continuing.
          </DialogDescription>
        </DialogHeader>

        <dl className="space-y-2 text-xs">
          {rows.map((r) => (
            <div key={r.label} className="rounded-md border p-2">
              <dt className="mb-1 font-semibold">{r.label}</dt>
              <dd className="break-all font-mono text-muted-foreground">Current: {r.current}</dd>
              <dd className={`break-all font-mono ${r.changed ? "text-foreground" : "text-muted-foreground"}`}>
                Previous: {r.previous}
              </dd>
            </div>
          ))}
        </dl>

        <label className="flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5"
          />
          <span>I understand the contract will run the previous code and state written by newer code may not match it.</span>
        </label>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!acknowledged}
            onClick={() => {
              onConfirm(target);
              setAcknowledged(false);
              onOpenChange(false);
            }}
          >
            Use previous version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
