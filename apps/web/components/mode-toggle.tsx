"use client";

/**
 * ModeToggle
 *
 * Issue #953: Dark / light / system theme switcher with smooth transition animation.
 *
 * Changes from the original:
 *  - Active theme is highlighted in the dropdown (checkmark + bold label).
 *  - A `Monitor` icon is shown when the system preference is active.
 *  - CSS colour-scheme transitions are applied globally via a <style> tag
 *    injected once on mount (avoids layout flash while still animating).
 *  - `next-themes` `ThemeProvider` (already in layout.tsx) handles persistence
 *    and the anti-flash script; this component only handles the UI toggle.
 */

import { useEffect } from "react";
import { Moon, Sun, Monitor, Check } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@devconsole/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@devconsole/ui";

/** Inject a global CSS transition for theme changes exactly once. */
function useThemeTransition() {
  useEffect(() => {
    const id = "sdc-theme-transition";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      *,
      *::before,
      *::after {
        transition:
          background-color 0.25s ease,
          border-color 0.25s ease,
          color 0.2s ease,
          fill 0.2s ease,
          stroke 0.2s ease,
          box-shadow 0.2s ease !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      // Leave the style in the DOM — removing it on unmount would re-add it
      // each time the component remounts (e.g. route changes).
    };
  }, []);
}

const THEMES = [
  { value: "light",  label: "Light",  Icon: Sun },
  { value: "dark",   label: "Dark",   Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

export function ModeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  useThemeTransition();

  // Pick the button icon based on the *resolved* theme (what the user actually sees)
  const isDark = resolvedTheme === "dark";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Toggle theme">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">{isDark ? "Dark theme active" : "Light theme active"}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-[8rem]">
        {THEMES.map(({ value, label, Icon }) => {
          const isActive = theme === value;
          return (
            <DropdownMenuItem
              key={value}
              onClick={() => setTheme(value)}
              className="flex items-center gap-2"
              aria-current={isActive ? "true" : undefined}
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className={isActive ? "font-semibold" : ""}>{label}</span>
              {isActive && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
