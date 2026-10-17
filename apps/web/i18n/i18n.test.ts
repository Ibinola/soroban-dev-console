import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createTranslator,
  flattenKeys,
  interpolate,
  mergeMessages,
  missingKeys,
  placeholdersOf,
  resolveLocale,
  type Messages,
} from "./core";
import { loadMessages } from "./index";
import locales from "./locales.json";
import en from "./messages/en.json";

const WEB_ROOT = path.resolve(__dirname, "..");

describe("i18n core (#1293)", () => {
  const config = {
    default: "en",
    locales: [
      { code: "en", name: "English" },
      { code: "fr", name: "Français" },
    ],
  };

  describe("resolveLocale", () => {
    it("accepts supported locales case-insensitively", () => {
      expect(resolveLocale("fr", config)).toBe("fr");
      expect(resolveLocale("FR", config)).toBe("fr");
    });

    it("falls back to the base language, then the default", () => {
      expect(resolveLocale("fr-CA", config)).toBe("fr");
      expect(resolveLocale("de", config)).toBe("en");
      expect(resolveLocale(null, config)).toBe("en");
      expect(resolveLocale("", config)).toBe("en");
    });
  });

  describe("translator", () => {
    const messages: Messages = { a: { b: "Hello {name}, you have {count} items" }, plain: "Plain" };

    it("looks up dotted keys and interpolates parameters", () => {
      const t = createTranslator(messages);
      expect(t("plain")).toBe("Plain");
      expect(t("a.b", { name: "Ada", count: 3 })).toBe("Hello Ada, you have 3 items");
    });

    it("renders missing keys as the key and leaves unknown placeholders", () => {
      const t = createTranslator(messages);
      expect(t("a.missing")).toBe("a.missing");
      expect(t("a")).toBe("a"); // a namespace is not a string
      expect(t("a.b", { name: "Ada" })).toBe("Hello Ada, you have {count} items");
      expect(interpolate("no params")).toBe("no params");
    });
  });

  describe("mergeMessages", () => {
    it("overlays translations on the base and keeps untranslated keys", () => {
      const merged = mergeMessages(
        { x: { one: "1", two: "2" }, y: "y" },
        { x: { one: "un" }, extra: "ignored-but-kept" },
      );
      expect(merged).toEqual({ x: { one: "un", two: "2" }, y: "y", extra: "ignored-but-kept" });
    });
  });

  it("flattens keys and reports keys a translation is missing", () => {
    const base = { a: { b: "1", c: "2" }, d: "3" };
    expect(flattenKeys(base).sort()).toEqual(["a.b", "a.c", "d"]);
    expect(missingKeys(base, { a: { b: "x" } }).sort()).toEqual(["a.c", "d"]);
    expect(placeholdersOf("{b} and {a} and {b}")).toEqual(["a", "b", "b"]);
  });
});

describe("locale files", () => {
  it("English is the default locale and is listed", () => {
    expect(locales.default).toBe("en");
    expect(locales.locales.map((l) => l.code)).toContain("en");
  });

  it("every listed locale has a messages file that is complete and keeps placeholders", () => {
    for (const { code } of locales.locales) {
      const file = path.join(__dirname, "messages", `${code}.json`);
      expect(existsSync(file), `missing messages/${code}.json`).toBe(true);
      const messages = JSON.parse(readFileSync(file, "utf8")) as Messages;
      if (code === "en") continue;
      const flat = (m: Messages): Record<string, string> =>
        Object.fromEntries(flattenKeys(m).map((k) => [k, k.split(".").reduce<never>((n, p) => (n as never)[p], m as never) as string]));
      const base = flat(en as Messages);
      const translated = flat(messages);
      expect(missingKeys(en as Messages, messages), `${code} is missing keys`).toEqual([]);
      for (const [key, text] of Object.entries(translated)) {
        expect(placeholdersOf(text), `${code}:${key} placeholders`).toEqual(placeholdersOf(base[key] ?? ""));
      }
    }
  });

  it("every messages file is listed in locales.json", () => {
    const files = readdirSync(path.join(__dirname, "messages")).map((f) => f.replace(/\.json$/, ""));
    expect(files.sort()).toEqual(locales.locales.map((l) => l.code).sort());
  });

  it("loadMessages returns English for the default and for unknown locales", async () => {
    expect((await loadMessages("en")).locale).toBe("en");
    const unknown = await loadMessages("xx");
    expect(unknown.locale).toBe("en");
    expect(unknown.messages).toEqual(en);
  });
});

describe("string extraction", () => {
  const pages = ["app/page.tsx", "app/contracts/page.tsx", "app/settings/page.tsx"];

  it.each(pages)("%s uses only keys that exist in en.json", (page) => {
    const source = readFileSync(path.join(WEB_ROOT, page), "utf8");
    const keys = [...source.matchAll(/\bt\(\s*"([\w.]+)"/g)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(5);
    const known = new Set(flattenKeys(en as Messages));
    for (const key of keys) expect(known.has(key), `unknown i18n key ${key} in ${page}`).toBe(true);
  });

  it("every key in en.json is used by some source file", () => {
    const used = new Set<string>();
    const scan = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === ".next") continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) scan(full);
        else if (/\.(tsx?|jsx?)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
          for (const m of readFileSync(full, "utf8").matchAll(/\bt\(\s*"([\w.]+)"/g)) used.add(m[1]);
        }
      }
    };
    for (const dir of ["app", "components"]) scan(path.join(WEB_ROOT, dir));
    const unused = flattenKeys(en as Messages).filter((k) => !used.has(k));
    expect(unused).toEqual([]);
  });

  it("the pages no longer hard-code their headline strings", () => {
    const settings = readFileSync(path.join(WEB_ROOT, "app/settings/page.tsx"), "utf8");
    const contracts = readFileSync(path.join(WEB_ROOT, "app/contracts/page.tsx"), "utf8");
    const home = readFileSync(path.join(WEB_ROOT, "app/page.tsx"), "utf8");
    expect(settings).not.toMatch(/>\s*Add Network\s*</);
    expect(contracts).not.toMatch(/>\s*Track New Contract\s*</);
    expect(home).not.toMatch(/>\s*Account Overview\s*</);
  });
});
