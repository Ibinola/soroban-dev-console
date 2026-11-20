/**
 * Framework-free i18n core. Messages are nested JSON objects addressed by
 * dotted keys (`settings.title`); `{name}` placeholders are interpolated.
 * A locale is added by dropping `messages/<code>.json` next to `en.json` and
 * listing it in `locales.json` — no code changes.
 */

export type Messages = { [key: string]: string | Messages };
export type TranslateParams = Record<string, string | number>;
export type Translate = (key: string, params?: TranslateParams) => string;

export interface LocaleInfo {
  code: string;
  name: string;
}

export interface LocaleConfig {
  default: string;
  locales: LocaleInfo[];
}

export const LOCALE_COOKIE = "NEXT_LOCALE";

/** Returns `candidate` if it is a supported locale (case-insensitive), else the default. */
export function resolveLocale(candidate: string | null | undefined, config: LocaleConfig): string {
  if (candidate) {
    const wanted = candidate.toLowerCase();
    const exact = config.locales.find((l) => l.code.toLowerCase() === wanted);
    if (exact) return exact.code;
    // `fr-CA` falls back to `fr` when only the base language is supported.
    const base = config.locales.find((l) => l.code.toLowerCase() === wanted.split("-")[0]);
    if (base) return base.code;
  }
  return config.default;
}

function isMessages(value: unknown): value is Messages {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Overlays `override` on `base`; keys missing from a translation fall back to the base language. */
export function mergeMessages(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = out[key];
    if (isMessages(value) && isMessages(existing)) out[key] = mergeMessages(existing, value);
    else if (typeof value === "string" || isMessages(value)) out[key] = value;
  }
  return out;
}

function lookup(messages: Messages, key: string): string | undefined {
  let node: string | Messages | undefined = messages;
  for (const part of key.split(".")) {
    if (!isMessages(node)) return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

export function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** Missing keys render as the key itself so gaps are visible rather than blank. */
export function createTranslator(messages: Messages): Translate {
  return (key, params) => interpolate(lookup(messages, key) ?? key, params);
}

/** Every dotted key that has a string value. */
export function flattenKeys(messages: Messages, prefix = ""): string[] {
  return Object.entries(messages).flatMap(([k, v]) =>
    typeof v === "string" ? [`${prefix}${k}`] : flattenKeys(v, `${prefix}${k}.`),
  );
}

/** Keys of `base` that `translation` does not define (for translation completeness checks). */
export function missingKeys(base: Messages, translation: Messages): string[] {
  const have = new Set(flattenKeys(translation));
  return flattenKeys(base).filter((k) => !have.has(k));
}

/** Placeholders (`{name}`) used in a template. */
export function placeholdersOf(template: string): string[] {
  return [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}
