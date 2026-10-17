import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LocaleProvider, useLocale, useTranslations } from "./locale-provider";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

function Probe() {
  const t = useTranslations();
  return (
    <p>
      {useLocale()}:{t("greeting", { name: "Ada" })}:{t("missing.key")}
    </p>
  );
}

describe("LocaleProvider", () => {
  it("provides translations and the locale to descendants", () => {
    render(
      <LocaleProvider locale="fr" messages={{ greeting: "Bonjour {name}" }}>
        <Probe />
      </LocaleProvider>,
    );
    expect(screen.getByText("fr:Bonjour Ada:missing.key")).toBeInTheDocument();
  });

  it("falls back to keys and English outside a provider", () => {
    render(<Probe />);
    expect(screen.getByText("en:greeting:missing.key")).toBeInTheDocument();
  });
});

describe("LanguageSelector", () => {
  it("lists the configured locales and stores the choice in a cookie", async () => {
    const { LanguageSelector } = await import("@/components/language-selector");
    render(
      <LocaleProvider locale="en" messages={{ settings: { language: { label: "Display language", hint: "hint" } } }}>
        <LanguageSelector />
      </LocaleProvider>,
    );
    const select = screen.getByLabelText("Display language") as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toContain("en");
    expect(select.value).toBe("en");

    // Selecting writes the cookie and refreshes server components.
    fireEvent.change(select, { target: { value: "en" } });
    expect(document.cookie).toContain("NEXT_LOCALE=en");
    expect(refresh).toHaveBeenCalled();
  });
});
