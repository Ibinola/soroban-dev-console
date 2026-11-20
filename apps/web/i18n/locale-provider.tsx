"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createTranslator, type Messages, type Translate } from "./core";

interface LocaleContextValue {
  locale: string;
  t: Translate;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  locale,
  messages,
  children,
}: {
  locale: string;
  messages: Messages;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ locale, t: createTranslator(messages) }), [locale, messages]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** `const t = useTranslations()` — falls back to the key outside a provider. */
export function useTranslations(): Translate {
  return useContext(LocaleContext)?.t ?? createTranslator({});
}

export function useLocale(): string {
  return useContext(LocaleContext)?.locale ?? "en";
}
