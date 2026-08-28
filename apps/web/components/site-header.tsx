"use client";

import { usePathname } from "next/navigation";
import { ConnectWalletButton } from "@/components/wallet-connect";
import { WalletBalanceOverview } from "@/components/wallet-balance-overview";
import { NetworkSwitcher } from "@/components/network-switcher";
import { ModeToggle } from "@/components/mode-toggle";
import { NetworkHealth } from "@/components/network-health";
// Issue #955: Responsive mobile navigation drawer
import { MobileNavDrawer } from "@/components/mobile-nav-drawer";

import { SidebarTrigger } from "@devconsole/ui";
import { Separator } from "@devconsole/ui";

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

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
      {/* Issue #955: Mobile hamburger + slide-over drawer (hidden on md+) */}
      <MobileNavDrawer />

      <SidebarTrigger className="-ml-1 hidden md:flex" />
      <Separator orientation="vertical" className="mr-2 hidden h-4 md:block" />

      <div className="flex flex-1 items-center">
        {/* Left side */}
        <div className="flex items-center gap-2">
          <span className="font-medium">{pageTitle}</span>
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
