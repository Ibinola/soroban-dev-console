"use client";

import { useRef } from "react";
import { useSavedCallsStore, SavedCall } from "@/store/useSavedCallsStore";
import { Button } from "@devconsole/ui";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@devconsole/ui";
import { ScrollArea } from "@devconsole/ui";
import { Bookmark, Trash2, PlayCircle, Download, Upload } from "lucide-react";
import { Badge } from "@devconsole/ui";

interface SavedCallsSheetProps {
  contractId: string;
  onSelect: (call: SavedCall) => void;
}

export function SavedCallsSheet({
  contractId,
  onSelect,
}: SavedCallsSheetProps) {
  const { savedCalls, removeCall, exportSavedCalls, importSavedCalls } =
    useSavedCallsStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const relevantCalls = savedCalls.filter((c) => c.contractId === contractId);

  // #780: download all saved calls as a portable JSON file.
  const handleExport = () => {
    const json = exportSavedCalls();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "saved-calls.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  // #780: import saved calls from a previously exported JSON file.
  const handleImportFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-importing the same file
    if (!file) return;
    try {
      const result = importSavedCalls(await file.text());
      alert(`Imported ${result.imported} call(s), skipped ${result.skipped}.`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to import file.");
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Bookmark className="h-4 w-4" />
          Saved Calls
          <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1">
            {relevantCalls.length}
          </Badge>
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Saved Interactions</SheetTitle>
          <SheetDescription>
            Quickly load previously saved function calls for this contract.
          </SheetDescription>
          {/* #780: export/import saved calls as portable JSON */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleExport}
              disabled={savedCalls.length === 0}
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Import
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={handleImportFile}
            />
          </div>
        </SheetHeader>

        <ScrollArea className="mt-6 h-[calc(100vh-120px)] pr-4">
          <div className="space-y-4">
            {relevantCalls.length === 0 ? (
              <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
                No saved calls yet.
                <br />
                Click "Save" on the form to add one.
              </div>
            ) : (
              relevantCalls.map((call) => (
                <div
                  key={call.id}
                  className="group relative rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <h4 className="truncate pr-6 text-sm font-semibold">
                      {call.name}
                    </h4>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-3 top-3 h-6 w-6 text-muted-foreground opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeCall(call.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="mb-3 space-y-1 font-mono text-xs text-muted-foreground">
                    <div className="flex gap-2">
                      <span className="text-blue-500">fn:</span>
                      {call.fnName}
                    </div>
                    <div className="flex gap-2">
                      <span className="text-blue-500">args:</span>
                      {call.args.length}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => onSelect(call)}
                  >
                    <PlayCircle className="h-3 w-3" />
                    Load
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
