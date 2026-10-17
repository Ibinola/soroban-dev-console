/**
 * Validates links in the repository's Markdown documentation.
 *
 * Checks, offline and deterministically:
 *   - relative file links point at a file or directory that exists
 *   - `#anchor` links (same-file or to another Markdown file) match a heading
 *
 * External (http/https/mailto) links are not fetched, so the check cannot
 * flake on network issues. Exits 1 and lists every broken link on failure.
 *
 * Usage: npx tsx scripts/check-doc-links.ts [rootDir]
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const SKIP_DIRS = new Set(["node_modules", ".git", ".next", ".turbo", "dist", "build", "coverage"]);

export interface BrokenLink {
  file: string;
  line: number;
  target: string;
  reason: string;
}

export function listMarkdownFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (SKIP_DIRS.has(name)) continue;
      const full = path.join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (name.toLowerCase().endsWith(".md")) out.push(full);
    }
  };
  walk(root);
  return out.sort();
}

/** GitHub-style heading slug. */
export function slugify(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[`*_~]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s/g, "-");
}

export function headingAnchors(markdown: string): Set<string> {
  const anchors = new Set<string>();
  const seen = new Map<string, number>();
  let inFence = false;
  for (const line of markdown.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (inFence) continue;
    const m = /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    const base = slugify(m[1].replace(/\[([^\]]*)\]\([^)]*\)/g, "$1"));
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    anchors.add(n === 0 ? base : `${base}-${n}`);
  }
  return anchors;
}

const LINK_RE = /(?<!!)\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

export function extractLinks(markdown: string): { target: string; line: number }[] {
  const links: { target: string; line: number }[] = [];
  let inFence = false;
  markdown.split("\n").forEach((text, i) => {
    if (/^\s*(```|~~~)/.test(text)) inFence = !inFence;
    if (inFence) return;
    const withoutInlineCode = text.replace(/`[^`]*`/g, "");
    for (const m of withoutInlineCode.matchAll(LINK_RE)) links.push({ target: m[1], line: i + 1 });
  });
  return links;
}

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

export function findBrokenLinks(root: string): BrokenLink[] {
  const broken: BrokenLink[] = [];
  const anchorCache = new Map<string, Set<string>>();
  const anchorsOf = (file: string) => {
    let a = anchorCache.get(file);
    if (!a) {
      a = headingAnchors(readFileSync(file, "utf8"));
      anchorCache.set(file, a);
    }
    return a;
  };

  for (const file of listMarkdownFiles(root)) {
    const rel = path.relative(root, file);
    for (const { target, line } of extractLinks(readFileSync(file, "utf8"))) {
      if (EXTERNAL.test(target)) continue;
      const [rawPath, rawAnchor] = target.split("#");
      let resolved = file;
      if (rawPath) {
        const decoded = decodeURIComponent(rawPath);
        resolved = decoded.startsWith("/")
          ? path.join(root, decoded)
          : path.resolve(path.dirname(file), decoded);
        if (!existsSync(resolved)) {
          broken.push({ file: rel, line, target, reason: "file not found" });
          continue;
        }
      }
      if (rawAnchor && resolved.toLowerCase().endsWith(".md") && statSync(resolved).isFile()) {
        if (!anchorsOf(resolved).has(decodeURIComponent(rawAnchor).toLowerCase())) {
          broken.push({ file: rel, line, target, reason: "heading anchor not found" });
        }
      }
    }
  }
  return broken;
}

function main() {
  const root = path.resolve(process.argv[2] ?? ".");
  const broken = findBrokenLinks(root);
  if (broken.length === 0) {
    console.log(`✅ No broken documentation links under ${root}`);
    return;
  }
  console.error(`❌ ${broken.length} broken documentation link(s):`);
  for (const b of broken) console.error(`  ${b.file}:${b.line}  ${b.target}  (${b.reason})`);
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main();
}
