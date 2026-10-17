"use client";

import { Star } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@devconsole/ui";
import { useContractStore } from "@/store/useContractStore";
import { useFavoriteContractsStore } from "@/store/useFavoriteContractsStore";

/** Quick-access sidebar section for starred contracts. Hidden when empty. */
export function FavoriteContractsSection() {
  const ids = useFavoriteContractsStore((s) => s.ids);
  const contracts = useContractStore((s) => s.contracts);

  if (ids.length === 0) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Favorites</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {ids.map((id) => {
            const name = contracts.find((c) => c.id === id)?.name ?? `${id.slice(0, 4)}…${id.slice(-4)}`;
            return (
              <SidebarMenuItem key={id}>
                <SidebarMenuButton asChild tooltip={name}>
                  <a href={`/contracts/${encodeURIComponent(id)}`}>
                    <Star className="fill-current" />
                    <span>{name}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
