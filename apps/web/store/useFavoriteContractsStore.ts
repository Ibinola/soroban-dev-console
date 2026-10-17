import { create } from "zustand";
import { persist } from "zustand/middleware";

interface FavoriteContractsState {
  /** Contract ids the user has starred, most recently starred first. */
  ids: string[];
  toggleFavorite: (contractId: string) => void;
  isFavorite: (contractId: string) => boolean;
}

export const useFavoriteContractsStore = create<FavoriteContractsState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggleFavorite: (contractId) =>
        set((state) => ({
          ids: state.ids.includes(contractId)
            ? state.ids.filter((id) => id !== contractId)
            : [contractId, ...state.ids],
        })),
      isFavorite: (contractId) => get().ids.includes(contractId),
    }),
    { name: "soroban-favorite-contracts" },
  ),
);
