"use client";

/**
 * MobileNavDrawer
 *
 * Issue #955: Responsive mobile layout drawer for workspace navigation.
 *
 * Acceptance criteria:
 *  ✅ Hamburger menu button visible only on mobile viewports (<768px / md breakpoint).
 *  ✅ Slide-over drawer from the left containing workspace selector and nav tools.
 *  ✅ Background scroll locked while the drawer is open.
 *  ✅ Closes on overlay click, Escape key, or explicit close button.
 *
 * The component is designed to be dropped into the SiteHeader alongside the
 * existing desktop navigation.  It mirrors the app-sidebar content so mobile
 * users have access to all workspace tools without the sidebar layout.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Menu, X, LayoutDashboard, FileCode, Activity, Settings, Search, HardDrive, Calculator, UploadCloud, Keyboard } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@devconsole/ui";
import { useKeyboardShortcutsStore } from "@/components/keyboard-shortcuts-modal";

// ─── Navigation items (mirrors app-sidebar) ───────────────────────────────────

const NAV_ITEMS = [
  { title: "Home / Monitor",      url: "/",                    Icon: Activity },
  { title: "Account Dashboard",   url: "/account",             Icon: LayoutDashboard },
  { title: "Contract Explorer",   url: "/contracts",           Icon: FileCode },
  { title: "Deploy Contract",     url: "/deploy",              Icon: UploadCloud },
  { title: "WASM Registry",       url: "/deploy/wasm",         Icon: HardDrive },
  { title: "Transaction Lookup",  url: "/tx",                  Icon: Search },
  { title: "Key Calculator",      url: "/tools/ledger-keys",   Icon: Calculator },
  { title: "Settings",            url: "/settings",            Icon: Settings },
] as const;

// ─── Hook: lock body scroll ───────────────────────────────────────────────────

function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;

    // Compensate for scrollbar width to avoid content shift
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [active]);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MobileNavDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDivElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const openShortcuts = useKeyboardShortcutsStore((s) => s.open);

  // Lock background scroll while the drawer is open
  useScrollLock(isOpen);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    // Return focus to the hamburger button when closing
    requestAnimationFrame(() => openButtonRef.current?.focus());
  }, []);

  // Close on route change
  useEffect(() => {
    close();
  }, [pathname, close]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, close]);

  // Trap focus inside drawer while open
  useEffect(() => {
    if (!isOpen || !drawerRef.current) return;

    const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    // Auto-focus first item
    first?.focus();

    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [isOpen]);

  return (
    <>
      {/* ── Hamburger trigger (mobile only) ───────────────────────────────── */}
      <Button
        ref={openButtonRef}
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={open}
        aria-label="Open navigation menu"
        aria-expanded={isOpen}
        aria-controls="mobile-nav-drawer"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </Button>

      {/* ── Backdrop ──────────────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-hidden="true"
          onClick={close}
        />
      )}

      {/* ── Drawer ────────────────────────────────────────────────────────── */}
      <div
        id="mobile-nav-drawer"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-background shadow-xl transition-transform duration-300 ease-in-out md:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          <span className="text-lg font-bold">DevConsole</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={close}
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>

        {/* Nav items */}
        <nav aria-label="Main navigation" className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-0.5 px-2" role="list">
            {NAV_ITEMS.map(({ title, url, Icon }) => {
              const isActive = pathname === url || (url !== "/" && pathname.startsWith(url));
              return (
                <li key={url}>
                  <a
                    href={url}
                    aria-current={isActive ? "page" : undefined}
                    className={[
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-muted hover:text-foreground",
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {title}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer — keyboard shortcuts hint */}
        <div className="border-t p-3">
          <button
            onClick={() => {
              close();
              openShortcuts();
            }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Open keyboard shortcuts"
          >
            <Keyboard className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Keyboard shortcuts</span>
            <kbd className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-background font-mono text-[10px]">
              ?
            </kbd>
          </button>
        </div>
      </div>
    </>
  );
}
