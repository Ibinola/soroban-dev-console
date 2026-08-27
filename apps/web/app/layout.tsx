import type { Metadata } from "next";
import "./globals.css";
import { SidebarProvider, SidebarInset, TooltipProvider } from "@devconsole/ui";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { CommandPalette } from "@/components/command-palette";
import { KeyboardShortcutsModal } from "@/components/keyboard-shortcuts-modal";
import { WalletNetworkMismatchBanner } from "@/components/wallet-network-mismatch-banner";
import { fetchRuntimeConfig } from "@/lib/api/runtime-config";
// Issue #952: SRI helpers — renders external assets with integrity + crossorigin attributes
import { SriScript, SriStylesheet } from "@/lib/sri-manifest";

export const metadata: Metadata = {
  title: "Soroban DevConsole",
  description: "Developer toolkit for Soroban smart contracts",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const runtimeConfigResult = await fetchRuntimeConfig();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Issue #952: External assets are loaded via the SRI manifest helper
          (lib/sri-manifest.ts) which injects integrity + crossorigin attributes
          automatically.  Add third-party fonts / scripts to the manifest and
          render them here using <SriStylesheet name="…" /> or <SriScript name="…" />.

          Example (uncomment when adding external fonts):
            <SriStylesheet name="inter-font" />

          The components render null when the manifest entry is absent, so
          adding them here is safe even before the hashes are registered.
        */}
        {/* Inline runtime config so client components can read it synchronously */}
        <script
          id="__runtime_config__"
          type="application/json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(runtimeConfigResult).replace(/<\//g, '<\\/') }}
        />
        {/*
          Issue #748: Prevent flash of incorrect theme (FOIT) on page load.
          Reads from localStorage using the sdc:theme:v1 key and applies the
          theme class to <html> before React hydration.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('sdc:theme:v1');if(t==='dark'||(t==='system'||!t)&&window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
          enableSystem
          storageKey="sdc:theme:v1"
        >
          <SidebarProvider>
            <TooltipProvider>
              <AppSidebar />
              <SidebarInset>
                <SiteHeader />
                <WalletNetworkMismatchBanner />
                <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                  {children}
                  <CommandPalette />
                  {/* Issue #750: Keyboard shortcuts modal — global, responds to ? key */}
                  <KeyboardShortcutsModal />
                </div>
              </SidebarInset>
            </TooltipProvider>
          </SidebarProvider>
        </ThemeProvider>

        <Toaster
          richColors
          position="bottom-right"
          // Issue #749: max 3 visible toasts; errors persist until dismissed
          visibleToasts={3}
          toastOptions={{
            duration: 3000,
            classNames: {
              error: "sonner-error-persist",
            },
          }}
        />
      </body>
    </html>
  );
}
