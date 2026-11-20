"use client";

import { usePathname } from "next/navigation";
import { ConnectWalletButton } from "@/components/wallet-connect";
import { WalletBalanceOverview } from "@/components/wallet-balance-overview";
import { NetworkSwitcher } from "@/components/network-switcher";
import { ModeToggle } from "@/components/mode-toggle";
import { NetworkHealth } from "@/components/network-health";
// Issue #955: Responsive mobile navigation drawer
import { MobileNavDrawer } from "@/components/mobile-nav-drawer";
import {
  getBreadcrumbItems,
  type BreadcrumbItem,
} from "@/components/breadcrumb-utils";

import { SidebarTrigger } from "@devconsole/ui";
import { Separator } from "@devconsole/ui";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@devconsole/ui";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import Link from "next/link";

function BreadcrumbLink({
  item,
  isCurrent = false,
}: {
  item: BreadcrumbItem;
  isCurrent?: boolean;
}) {
  return (
    <Link
      href={item.href}
      aria-label={item.accessibleLabel}
      aria-current={isCurrent ? "page" : undefined}
      title={item.accessibleLabel ?? item.label}
      className="max-w-[180px] truncate text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      {item.label}
    </Link>
  );
}

function BreadcrumbSeparator() {
  return (
    <ChevronRight
      aria-hidden="true"
      className="h-4 w-4 shrink-0 text-muted-foreground/60"
    />
  );
}

function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const ancestors = items.slice(1, -1);
  const currentPage = items[items.length - 1];

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="hidden min-w-0 items-center gap-1 sm:flex">
        {items.map((item, index) => (
          <li
            key={`${item.href}-${index}`}
            className="flex min-w-0 items-center gap-1"
          >
            {index > 0 && <BreadcrumbSeparator />}
            <BreadcrumbLink
              item={item}
              isCurrent={index === items.length - 1}
            />
          </li>
        ))}
      </ol>

      <ol className="flex min-w-0 items-center gap-1 sm:hidden">
        <li className="flex shrink-0 items-center gap-1">
          <BreadcrumbLink item={items[0]} />
          {items.length > 1 && <BreadcrumbSeparator />}
        </li>
        {ancestors.length > 0 && (
          <li className="flex shrink-0 items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Show breadcrumb navigation"
                  className="h-7 w-7"
                >
                  <MoreHorizontal aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {ancestors.map((item, index) => (
                  <DropdownMenuItem key={`${item.href}-${index}`} asChild>
                    <Link href={item.href}>{item.label}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <BreadcrumbSeparator />
          </li>
        )}
        {items.length > 1 && (
          <li className="min-w-0">
            <BreadcrumbLink item={currentPage} isCurrent />
          </li>
        )}
      </ol>
    </nav>
  );
}

function getPageTitle(pathname: string) {
  if (pathname === "/") return "Home / Monitor";
  if (pathname === "/account") return "Account Dashboard";
  if (pathname === "/contracts") return "Contract Explorer";
  if (pathname.startsWith("/contracts/")) return "Contract Details";
  if (pathname === "/deploy") return "Deploy Contract";
  if (pathname === "/deploy/wasm") return "WASM Registry";
  if (pathname === "/tx") return "Transaction Lookup";
  if (pathname === "/tools/ledger-keys") return "Key Calculator";
  if (pathname === "/tools/xdr") return "XDR Decoder";
  if (pathname === "/settings") return "Settings";
  if (pathname.startsWith("/docs")) return "Documentation";

  return "Dashboard";
}

export function SiteHeader() {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);
  const breadcrumbItems = getBreadcrumbItems(pathname);

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
      {/* Issue #955: Mobile hamburger + slide-over drawer (hidden on md+) */}
      <MobileNavDrawer />

      <SidebarTrigger className="-ml-1 hidden md:flex" />
      <Separator orientation="vertical" className="mr-2 hidden h-4 md:block" />

      <div className="flex flex-1 items-center">
        {/* Left side */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {breadcrumbItems ? (
            <Breadcrumbs items={breadcrumbItems} />
          ) : (
            <span className="font-medium">{pageTitle}</span>
          )}
          <NetworkHealth />
        </div>

        {/* Right side — desktop only */}
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <NetworkSwitcher />
          <ModeToggle />
          <WalletBalanceOverview />
          <ConnectWalletButton />
        </div>
      </div>
    </header>
  );
}
