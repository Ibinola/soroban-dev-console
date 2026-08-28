import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  Contract,
  rpc as SorobanRpc,
  TransactionBuilder,
  TimeoutInfinite,
  scValToNative,
} from "@stellar/stellar-sdk";

export interface TrackedToken {
  contractId: string;
  name: string;
  symbol: string;
  decimals: number;
  networkId: string;
}

interface TrackedTokensState {
  tokens: TrackedToken[];
  addToken: (
    contractId: string,
    networkId: string,
    rpcUrl: string,
    networkPassphrase: string,
    address: string
  ) => Promise<void>;
  removeToken: (contractId: string, networkId: string) => void;
}

export const useTrackedTokensStore = create<TrackedTokensState>()(
  persist(
    (set, get) => ({
      tokens: [],
      addToken: async (contractId, networkId, rpcUrl, networkPassphrase, address) => {
        const server = new SorobanRpc.Server(rpcUrl);
        const contract = new Contract(contractId);

        const callView = async (method: string, args: any[] = []) => {
          const tx = new TransactionBuilder(
            {
              accountId: () => address,
              sequenceNumber: () => "0",
              incrementSequenceNumber: () => {},
            },
            { fee: "100", networkPassphrase }
          )
            .addOperation(contract.call(method, ...args))
            .setTimeout(TimeoutInfinite)
            .build();

          const sim = await server.simulateTransaction(tx);
          if (SorobanRpc.Api.isSimulationSuccess(sim) && sim.result?.retval) {
            return scValToNative(sim.result.retval);
          }
          throw new Error(`Failed to fetch ${method}`);
        };

        const [sym, dec, name] = await Promise.all([
          callView("symbol"),
          callView("decimals"),
          callView("name"),
        ]);

        const newToken: TrackedToken = {
          contractId,
          name: name?.toString() || "Unknown Token",
          symbol: sym?.toString() || "???",
          decimals: Number(dec),
          networkId,
        };

        set((state) => {
          if (
            state.tokens.find(
              (t) => t.contractId === contractId && t.networkId === networkId
            )
          ) {
            return state;
          }
          return { tokens: [...state.tokens, newToken] };
        });
      },
      removeToken: (contractId, networkId) =>
        set((state) => ({
          tokens: state.tokens.filter(
            (t) => !(t.contractId === contractId && t.networkId === networkId)
          ),
        })),
    }),
    {
      name: "soroban-tracked-tokens",
    }
  )
);
