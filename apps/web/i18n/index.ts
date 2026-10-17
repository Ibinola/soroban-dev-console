import localeConfig from "./locales.json";
import { mergeMessages, resolveLocale, type LocaleConfig, type Messages } from "./core";

export * from "./core";

export const localeConfigData: LocaleConfig = localeConfig;

/**
 * Loads a locale's messages, layered over English so partially translated
 * languages still render every string. The dynamic import means any
 * `messages/<code>.json` listed in `locales.json` is picked up as is.
 */
export async function loadMessages(locale: string): Promise<{ locale: string; messages: Messages }> {
  const resolved = resolveLocale(locale, localeConfigData);
  const base = (await import("./messages/en.json")).default as Messages;
  if (resolved === localeConfigData.default) return { locale: resolved, messages: base };
  try {
    const translated = (await import(`./messages/${resolved}.json`)).default as Messages;
    return { locale: resolved, messages: mergeMessages(base, translated) };
  } catch {
    return { locale: localeConfigData.default, messages: base };
  }
}
