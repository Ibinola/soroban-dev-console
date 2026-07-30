"use client";

import {
  LayoutDashboard,
  FileCode,
  Activity,
  Settings,
  Search,
  HardDrive,
  Calculator,
  UploadCloud,
  Keyboard,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@devconsole/ui";

import { WorkspaceSwitcher } from "./workspace-switcher";
import { useKeyboardShortcutsStore } from "./keyboard-shortcuts-modal";

const items = [
  {
    title: "Home / Monitor",
    url: "/",
    icon: Activity,
  },
  {
    title: "Account Dashboard",
    url: "/account",
    icon: LayoutDashboard,
  },
  {
    title: "Contract Explorer",
    url: "/contracts",
    icon: FileCode,
  },
  {
    title: "Deploy Contract",
    url: "/deploy",
    icon: UploadCloud,
  },
  {
    title: "WASM Registry",
    url: "/deploy/wasm",
    icon: HardDrive,
  },
  {
    title: "Transaction Lookup",
    url: "/tx",
    icon: Search,
  },
  {
    title: "Key Calculator",
    url: "/tools/ledger-keys",
    icon: Calculator,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const openShortcuts = useKeyboardShortcutsStore((s) => s.open);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="flex flex-col gap-4 py-4">
        <span className="w-full truncate px-2 text-lg font-bold">
          DevConsole
        </span>
        <WorkspaceSwitcher />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Issue #750: Keyboard shortcut hint in sidebar footer */}
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <button
          onClick={openShortcuts}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          title="Keyboard shortcuts (?)"
          aria-label="Open keyboard shortcuts"
        >
          <Keyboard className="h-3.5 w-3.5" />
          <span>Shortcuts</span>
          <kbd className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded border border-border bg-muted font-mono text-[10px]">?</kbd>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
