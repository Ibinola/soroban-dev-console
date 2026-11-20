import { beforeEach, describe, expect, it } from "vitest";
import { useFavoriteContractsStore } from "./useFavoriteContractsStore";

describe("useFavoriteContractsStore", () => {
  beforeEach(() => {
    useFavoriteContractsStore.setState({ ids: [] });
  });

  it("stars and unstars a contract", () => {
    const { toggleFavorite, isFavorite } = useFavoriteContractsStore.getState();
    toggleFavorite("CABC");
    expect(isFavorite("CABC")).toBe(true);
    toggleFavorite("CABC");
    expect(isFavorite("CABC")).toBe(false);
  });

  it("lists the most recently starred first and never duplicates", () => {
    const { toggleFavorite } = useFavoriteContractsStore.getState();
    toggleFavorite("C1");
    toggleFavorite("C2");
    toggleFavorite("C1");
    toggleFavorite("C1");
    expect(useFavoriteContractsStore.getState().ids).toEqual(["C1", "C2"]);
  });
});
