// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { extractLinks, findBrokenLinks, headingAnchors, slugify } from "../../../scripts/check-doc-links";

const dirs: string[] = [];
function repo(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), "doclinks-"));
  dirs.push(root);
  for (const [name, content] of Object.entries(files)) {
    const full = path.join(root, name);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("doc link checker (#1317)", () => {
  it("slugifies headings like GitHub", () => {
    expect(slugify("Hello, World!")).toBe("hello-world");
    expect(slugify("`code` & Stuff")).toBe("code--stuff");
  });

  it("collects heading anchors, de-duplicating repeats and ignoring code fences", () => {
    const a = headingAnchors("# Title\n## Dup\n## Dup\n```\n# not a heading\n```\n");
    expect([...a].sort()).toEqual(["dup", "dup-1", "title"]);
  });

  it("extracts links but not images, code spans or fenced blocks", () => {
    const links = extractLinks("[a](x.md) ![img](i.png) `[c](c.md)`\n```\n[f](f.md)\n```\n[b](y.md#h)");
    expect(links.map((l) => l.target)).toEqual(["x.md", "y.md#h"]);
  });

  it("accepts valid file and anchor links", () => {
    const root = repo({
      "README.md": "# Home\n[docs](docs/a.md) [sec](docs/a.md#section) [self](#home) [ext](https://example.com/x)\n",
      "docs/a.md": "# A\n## Section\n[back](../README.md)\n",
    });
    expect(findBrokenLinks(root)).toEqual([]);
  });

  it("reports missing files and missing anchors with locations", () => {
    const root = repo({
      "README.md": "# Home\n\n[gone](docs/missing.md)\n[bad](docs/a.md#nope)\n[self](#nope)\n",
      "docs/a.md": "# A\n",
    });
    const broken = findBrokenLinks(root);
    expect(broken.map((b) => [b.file, b.line, b.reason])).toEqual([
      ["README.md", 3, "file not found"],
      ["README.md", 4, "heading anchor not found"],
      ["README.md", 5, "heading anchor not found"],
    ]);
  });
});
