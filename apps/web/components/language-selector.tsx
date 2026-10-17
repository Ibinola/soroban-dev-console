"use client";

import { useRouter } from "next/navigation";
import { LOCALE_COOKIE } from "@/i18n/core";
import { localeConfigData } from "@/i18n";
import { useLocale, useTranslations } from "@/i18n/locale-provider";

/** Writes the locale cookie and refreshes so server components re-render translated. */
export function LanguageSelector() {
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();

  const onChange = (code: string) => {
    document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(code)}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };

  return (
    <div className="space-y-2">
      <label htmlFor="language-select" className="text-sm font-medium">
        {t("settings.language.label")}
      </label>
      <select
        id="language-select"
        className="h-9 w-full max-w-xs rounded-md border bg-background px-3 text-sm"
        value={locale}
        onChange={(e) => onChange(e.target.value)}
      >
        {localeConfigData.locales.map((l) => (
          <option key={l.code} value={l.code}>
            {l.name}
          </option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground">{t("settings.language.hint")}</p>
    </div>
  );
}
