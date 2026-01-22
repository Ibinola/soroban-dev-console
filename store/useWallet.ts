// store/useWallet.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isAllowed, setAllowed, getAddress } from "@stellar/freighter-api";
import albedo from "@albedo-link/intent";

interface WalletState {
    isConnected: boolean;
    address: string | null;
    walletType: "freighter" | "albedo" | null;
    connectFreighter: () => Promise<void>;
    connectAlbedo: () => Promise<void>;
    disconnect: () => void;
}

export const useWallet = create<WalletState>()(
    persist(
        (set) => ({
            isConnected: false,
            address: null,
            walletType: null,

            connectFreighter: async () => {
                try {
                    const { isAllowed: isFreighterAllowed } = await isAllowed();
                    if (!isFreighterAllowed) {
                        await setAllowed();
                    }
                    const { address } = await getAddress();
                    set({
                        isConnected: true,
                        address: address,
                        walletType: "freighter",
                    });
                } catch (e) {
                    console.error("Freighter connection failed", e);
                    throw e; // Re-throw so UI can handle error
                }
            },

            connectAlbedo: async () => {
                try {
                    const result = await albedo.publicKey({});
                    set({
                        isConnected: true,
                        address: result.pubkey,
                        walletType: "albedo",
                    });
                } catch (e) {
                    console.error("Albedo connection failed", e);
                    throw e;
                }
            },

            disconnect: () => {
                set({ isConnected: false, address: null, walletType: null });
            },
        }),
        {
            name: "soroban-wallet-storage",
        },
    ),
);
