"use client";

import { Star } from "lucide-react";
import { Button } from "@devconsole/ui";
import { useFavoriteContractsStore } from "@/store/useFavoriteContractsStore";

export function FavoriteContractButton({ contractId }: { contractId: string }) {
  const favorite = useFavoriteContractsStore((s) => s.ids.includes(contractId));
  const toggle = useFavoriteContractsStore((s) => s.toggleFavorite);

  return (
    <Button
      variant="outline"
      size="icon"
      aria-pressed={favorite}
      aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
      onClick={() => toggle(contractId)}
    >
      <Star className={`h-4 w-4 ${favorite ? "fill-yellow-400 text-yellow-500" : ""}`} />
    </Button>
  );
}
