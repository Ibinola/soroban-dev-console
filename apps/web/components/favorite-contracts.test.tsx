import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { SidebarProvider } from "@devconsole/ui";
import { FavoriteContractButton } from "./favorite-contract-button";
import { FavoriteContractsSection } from "./favorite-contracts-section";
import { useContractStore } from "@/store/useContractStore";
import { useFavoriteContractsStore } from "@/store/useFavoriteContractsStore";

describe("favorite contracts", () => {
  beforeEach(() => {
    // jsdom has no matchMedia; the sidebar provider queries it for mobile mode.
    window.matchMedia ??= ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    useFavoriteContractsStore.setState({ ids: [] });
    useContractStore.setState({ contracts: [] });
  });

  it("the star button toggles the favorite state", () => {
    render(<FavoriteContractButton contractId="CABC" />);
    const button = screen.getByRole("button", { name: /add to favorites/i });
    expect(button).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(button);
    expect(screen.getByRole("button", { name: /remove from favorites/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(useFavoriteContractsStore.getState().ids).toEqual(["CABC"]);
  });

  it("the sidebar section is hidden with no favorites", () => {
    const { container } = render(
      <SidebarProvider>
        <FavoriteContractsSection />
      </SidebarProvider>,
    );
    expect(screen.queryByText("Favorites")).not.toBeInTheDocument();
    expect(container.querySelector("a")).toBeNull();
  });

  it("the sidebar section links to starred contracts using their saved names", () => {
    useContractStore.setState({
      contracts: [{ id: "CABCDEFGH", name: "My Token", network: "testnet", addedAt: 1 }],
    });
    useFavoriteContractsStore.setState({ ids: ["CABCDEFGH", "CZZZZ0000YYYY"] });
    render(
      <SidebarProvider>
        <FavoriteContractsSection />
      </SidebarProvider>,
    );
    expect(screen.getByText("Favorites")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /my token/i })).toHaveAttribute("href", "/contracts/CABCDEFGH");
    expect(screen.getByRole("link", { name: /CZZZ…YYYY/ })).toBeInTheDocument();
  });
});
