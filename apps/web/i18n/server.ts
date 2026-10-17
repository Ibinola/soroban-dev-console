import { cookies } from "next/headers";
import { createTranslator, LOCALE_COOKIE, resolveLocale, type Translate } from "./core";
import { loadMessages, localeConfigData } from "./index";

/** Locale chosen by the user (cookie), or the default. */
export async function getRequestLocale(): Promise<string> {
  const store = await cookies();
  return resolveLocale(store.get(LOCALE_COOKIE)?.value, localeConfigData);
}

/** Translator for server components. */
export async function getTranslations(): Promise<Translate> {
  const { messages } = await loadMessages(await getRequestLocale());
  return createTranslator(messages);
}
