"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, Copy } from "lucide-react";
import { Button } from "@devconsole/ui";
import {
  formatTerminalText,
  type TerminalLevel,
  type TerminalSection,
} from "@/lib/simulation-terminal";

const LEVEL_CLASS: Record<TerminalLevel, string> = {
  info: "text-emerald-400",
  warn: "text-amber-400",
  error: "text-red-400",
};

const MIN_HEIGHT = 96;

export function TerminalOutputViewer({ sections }: { sections: TerminalSection[] }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [height, setHeight] = useState(224);
  const [copied, setCopied] = useState(false);
  const dragStart = useRef<{ y: number; h: number } | null>(null);

  const copy = async () => {
    await navigator.clipboard.writeText(formatTerminalText(sections));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStart.current = { y: e.clientY, h: height };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    setHeight(Math.max(MIN_HEIGHT, dragStart.current.h + (e.clientY - dragStart.current.y)));
  };
  const onPointerUp = () => {
    dragStart.current = null;
  };

  return (
    <div className="overflow-hidden rounded-md border border-zinc-800 bg-zinc-950 text-zinc-100">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5">
        <span className="font-mono text-[11px] text-zinc-400">simulation output</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-zinc-300 hover:text-white"
          onClick={copy}
          aria-label="Copy output to clipboard"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>

      <div
        className="overflow-auto px-3 py-2 font-mono text-xs"
        style={{ height }}
        data-testid="terminal-body"
      >
        {sections.map((section) => {
          const isCollapsed = collapsed[section.id] ?? false;
          return (
            <div key={section.id} className="mb-2">
              <button
                type="button"
                className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200"
                aria-expanded={!isCollapsed}
                onClick={() => setCollapsed((c) => ({ ...c, [section.id]: !isCollapsed }))}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                [{section.title}]
              </button>
              {!isCollapsed &&
                section.lines.map((line, i) => (
                  <div key={i} className="whitespace-pre-wrap break-all pl-4">
                    <span className={LEVEL_CLASS[line.level]}>{line.level.toUpperCase().padEnd(5)}</span>{" "}
                    {line.text}
                  </div>
                ))}
            </div>
          );
        })}
      </div>

      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize terminal"
        className="h-2 cursor-row-resize touch-none border-t border-zinc-800 bg-zinc-900 hover:bg-zinc-800"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
    </div>
  );
}
