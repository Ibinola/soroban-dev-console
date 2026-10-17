# Adding translations

The web app's UI text lives in locale files under `apps/web/i18n/`. English is the
default language and the source of truth; other languages are layered on top of it,
so a partly translated language still renders every string (missing keys fall back
to English).

```
apps/web/i18n/
├── locales.json          # list of supported languages
└── messages/
    ├── en.json           # source strings
    └── <code>.json       # one file per additional language
```

## Add a language

No application code changes are needed.

1. Copy `apps/web/i18n/messages/en.json` to `apps/web/i18n/messages/<code>.json`
   (`<code>` is a language tag such as `fr` or `pt-BR`).
2. Translate the **values**. Keep the keys and the structure exactly as they are.
3. Keep every `{placeholder}` in the translated text. Placeholders are filled in at
   runtime (`"{label} added"` → `"Counter added"`); you may move them within the
   sentence but not rename or drop them.
4. Add the language to `apps/web/i18n/locales.json`:

   ```json
   { "code": "fr", "name": "Français" }
   ```

   `name` is how the language is shown in the language selector, written in that
   language.
5. Run the tests: `npm run test:run -w web -- i18n`. They check that every listed
   language has a messages file, that no key is missing, and that placeholders match
   English.

The language then appears under **Settings → Language**. The choice is stored in the
`NEXT_LOCALE` cookie.

## Add or change a string

- Add the English text to `messages/en.json` under the page or feature it belongs to
  (`settings.*`, `contracts.*`, …) and use it with `t("settings.title")`:
  - client components: `const t = useTranslations()` from `@/i18n/locale-provider`;
  - server components: `const t = await getTranslations()` from `@/i18n/server`.
- Use `{name}` placeholders instead of string concatenation:
  `t("contracts.toasts.fixtureAdded", { label })`.
- Keys that no source file uses fail the `i18n` tests, so remove strings you stop using.

## Notes

- Translating a key in one language does not require translating it in all of them.
- Do not translate keys, placeholder names or code snippets.
- Dates and numbers already follow the browser locale (`toLocaleDateString`, `Intl`).
