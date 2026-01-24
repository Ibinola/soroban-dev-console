'use client';

import { useSavedCallsStore, SavedCall } from '@/store/useSavedCallsStore';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bookmarks, Trash2, PlayCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SavedCallsSheetProps {
  contractId: string;
  onSelect: (call: SavedCall) => void;
}

export function SavedCallsSheet({
  contractId,
  onSelect,
}: SavedCallsSheetProps) {
  const { savedCalls, removeCall } = useSavedCallsStore();

  const relevantCalls = savedCalls.filter((c) => c.contractId === contractId);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Bookmarks className="h-4 w-4" />
          Saved Calls
          <Badge variant="secondary" className="ml-1 px-1 h-5 min-w-[20px]">
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
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-6 pr-4">
          <div className="space-y-4">
            {relevantCalls.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8 border border-dashed rounded-md">
                No saved calls yet.
                <br />
                Click "Save" on the form to add one.
              </div>
            ) : (
              relevantCalls.map((call) => (
                <div
                  key={call.id}
                  className="p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors relative group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold text-sm truncate pr-6">
                      {call.name}
                    </h4>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-red-500 absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeCall(call.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="text-xs font-mono text-muted-foreground mb-3 space-y-1">
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
