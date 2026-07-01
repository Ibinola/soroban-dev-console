import {
  LayoutDashboard,
  FileCode,
  Activity,
  Settings,
  Search,
  HardDrive,
  Calculator,
  UploadCloud,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@devconsole/ui";

import { WorkspaceSwitcher } from "./workspace-switcher";

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
    </Sidebar>
  );
}
