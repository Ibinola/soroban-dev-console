"use client";

import { ArrowDown, ArrowUp, ListOrdered, Plus, Trash2 } from "lucide-react";

import { CartItem, SavedCall } from "@/store/useSavedCallsStore";
import { Badge } from "@devconsole/ui";
import { Button } from "@devconsole/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@devconsole/ui";

// Re-export for backward compat
export type { CartItem as MultiOpCartItem };

type MultiOpCartProps = {
  availableCalls: SavedCall[];
  cartItems: CartItem[];
  currentNetwork: string;
  onAddCall: (call: SavedCall) => void;
  onRemoveItem: (cartItemId: string) => void;
  onMoveItem: (cartItemId: string, direction: "up" | "down") => void;
  onClear: () => void;
};

function shortContract(contractId: string) {
  return `${contractId.slice(0, 6)}...${contractId.slice(-6)}`;
}

export function MultiOpCart({
  availableCalls,
  cartItems,
  currentNetwork,
  onAddCall,
  onRemoveItem,
  onMoveItem,
  onClear,
}: MultiOpCartProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Saved Calls</CardTitle>
          <CardDescription>
            Add saved interactions from the current network to your transaction.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {availableCalls.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No saved calls found for <strong>{currentNetwork}</strong>.
            </p>
          ) : (
            availableCalls.map((call) => (
              <div
                key={call.id}
                className="flex items-center justify-between rounded-md border bg-muted/30 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{call.name}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {shortContract(call.contractId)} • {call.fnName}({call.args.length})
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => onAddCall(call)}>
                  <Plus className="mr-1 h-3 w-3" />
                  Add
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ListOrdered className="h-4 w-4" />
              Operation Cart
            </CardTitle>
            <CardDescription>
              Re-order calls to control atomic execution order.
            </CardDescription>
          </div>
          <Badge variant={cartItems.length >= 2 ? "default" : "secondary"}>
            {cartItems.length} op{cartItems.length === 1 ? "" : "s"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-2">
          {cartItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Cart is empty. Add calls from the left panel.
            </p>
          ) : (
            <>
              {cartItems.map((item, index) => (
                <div
                  key={item.cartItemId}
                  className="flex items-center justify-between gap-2 rounded-md border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {index + 1}. {item.name}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {shortContract(item.contractId)} • {item.fnName}({item.args.length})
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={index === 0}
                      onClick={() => onMoveItem(item.cartItemId, "up")}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={index === cartItems.length - 1}
                      onClick={() => onMoveItem(item.cartItemId, "down")}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => onRemoveItem(item.cartItemId)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="pt-2">
                <Button variant="outline" size="sm" onClick={onClear}>
                  Clear Cart
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
