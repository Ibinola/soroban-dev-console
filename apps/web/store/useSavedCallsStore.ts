import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ContractArg } from "@devconsole/soroban-utils";

export interface SavedCall {
  id: string;
  name: string;
  contractId: string;
  fnName: string;
  args: ContractArg[];
  network: string;
  createdAt: number;
  workspaceId?: string;
}

export interface CartItem extends SavedCall {
  cartItemId: string;
}

export interface OperationPreset {
  id: string;
  name: string;
  contractId: string;
  fnName: string;
  args: ContractArg[];
  network: string;
  source: "token" | "admin" | "explorer" | "custom";
  createdAt: number;
  lastUsedAt?: number;
}

interface SavedCallsState {
  savedCalls: SavedCall[];
  cartItems: CartItem[];
  presets: OperationPreset[];
  saveCall: (call: Omit<SavedCall, "id" | "createdAt">) => SavedCall;
  removeCall: (id: string) => void;
  getCallsForContract: (contractId: string) => SavedCall[];
  addToCart: (call: SavedCall) => void;
  removeFromCart: (cartItemId: string) => void;
  moveCartItem: (cartItemId: string, direction: "up" | "down") => void;
  clearCart: () => void;
  getCallsForWorkspace: (workspaceId: string) => SavedCall[];
  assignCallToWorkspace: (callId: string, workspaceId: string) => void;
  unassignCallFromWorkspace: (callId: string) => void;
  /** FE-056: persist reusable operation presets */
  savePreset: (preset: Omit<OperationPreset, "id" | "createdAt" | "lastUsedAt">) => OperationPreset;
  removePreset: (presetId: string) => void;
  getPresetsForContract: (contractId: string) => OperationPreset[];
  /** FE-056: apply a preset by creating a saved call and adding it to cart */
  applyPresetToCart: (presetId: string, options?: { workspaceId?: string }) => SavedCall | null;
  /** FE-056: recover stale preset by switching network context */
  repairPresetNetwork: (presetId: string, network: string) => void;
  /** #780: export saved calls (optionally scoped to a workspace) as portable JSON */
  exportSavedCalls: (workspaceId?: string) => string;
  /** #780: import saved calls from exported JSON, merging without overwriting duplicates */
  importSavedCalls: (json: string) => { imported: number; skipped: number };
}

/** #780: portable export envelope for sharing saved call sequences. */
interface SavedCallsExport {
  type: "soroban-dev-console/saved-calls";
  version: 1;
  exportedAt: number;
  calls: Array<Pick<SavedCall, "name" | "contractId" | "fnName" | "args" | "network">>;
}

/** #780: dedupe key for a saved call — matches on the call's meaningful fields. */
function savedCallHash(
  call: Pick<SavedCall, "contractId" | "fnName" | "network" | "args">,
): string {
  return JSON.stringify([call.contractId, call.fnName, call.network, call.args]);
}

export const useSavedCallsStore = create<SavedCallsState>()(
  persist(
    (set, get) => ({
      savedCalls: [],
      cartItems: [],
      presets: [],

      saveCall: (call) => {
        const savedCall: SavedCall = {
          ...call,
          id: crypto.randomUUID(),
          createdAt: Date.now(),
        };
        set((state) => ({ savedCalls: [savedCall, ...state.savedCalls] }));
        return savedCall;
      },

      removeCall: (id) =>
        set((state) => ({
          savedCalls: state.savedCalls.filter((c) => c.id !== id),
        })),

      getCallsForContract: (contractId) =>
        get().savedCalls.filter((c) => c.contractId === contractId),

      addToCart: (call) =>
        set((state) => ({
          cartItems: [
            ...state.cartItems,
            { ...call, cartItemId: crypto.randomUUID() },
          ],
        })),

      removeFromCart: (cartItemId) =>
        set((state) => ({
          cartItems: state.cartItems.filter((c) => c.cartItemId !== cartItemId),
        })),

      moveCartItem: (cartItemId, direction) =>
        set((state) => {
          const items = [...state.cartItems];
          const index = items.findIndex((c) => c.cartItemId === cartItemId);
          if (index === -1) return state;
          const target = direction === "up" ? index - 1 : index + 1;
          if (target < 0 || target >= items.length) return state;
          [items[index], items[target]] = [items[target], items[index]];
          return { cartItems: items };
        }),

      clearCart: () => set({ cartItems: [] }),

      getCallsForWorkspace: (workspaceId) =>
        get().savedCalls.filter((c) => c.workspaceId === workspaceId),

      assignCallToWorkspace: (callId, workspaceId) =>
        set((state) => ({
          savedCalls: state.savedCalls.map((c) =>
            c.id === callId ? { ...c, workspaceId } : c,
          ),
        })),

      unassignCallFromWorkspace: (callId) =>
        set((state) => ({
          savedCalls: state.savedCalls.map((c) =>
            c.id === callId ? { ...c, workspaceId: undefined } : c,
          ),
        })),

      savePreset: (preset) => {
        const next: OperationPreset = {
          ...preset,
          id: crypto.randomUUID(),
          createdAt: Date.now(),
        };
        set((state) => ({ presets: [next, ...state.presets] }));
        return next;
      },

      removePreset: (presetId) =>
        set((state) => ({
          presets: state.presets.filter((preset) => preset.id !== presetId),
        })),

      getPresetsForContract: (contractId) =>
        get().presets.filter((preset) => preset.contractId === contractId),

      applyPresetToCart: (presetId, options) => {
        const preset = get().presets.find((entry) => entry.id === presetId);
        if (!preset) return null;

        const savedCall: SavedCall = {
          id: crypto.randomUUID(),
          name: preset.name,
          contractId: preset.contractId,
          fnName: preset.fnName,
          args: preset.args,
          network: preset.network,
          createdAt: Date.now(),
          workspaceId: options?.workspaceId,
        };

        set((state) => ({
          savedCalls: [savedCall, ...state.savedCalls],
          cartItems: [...state.cartItems, { ...savedCall, cartItemId: crypto.randomUUID() }],
          presets: state.presets.map((entry) =>
            entry.id === presetId ? { ...entry, lastUsedAt: Date.now() } : entry,
          ),
        }));

        return savedCall;
      },

      repairPresetNetwork: (presetId, network) =>
        set((state) => ({
          presets: state.presets.map((preset) =>
            preset.id === presetId ? { ...preset, network } : preset,
          ),
        })),

      exportSavedCalls: (workspaceId) => {
        const calls = get().savedCalls.filter(
          (c) => !workspaceId || c.workspaceId === workspaceId,
        );
        const payload: SavedCallsExport = {
          type: "soroban-dev-console/saved-calls",
          version: 1,
          exportedAt: Date.now(),
          calls: calls.map(({ name, contractId, fnName, args, network }) => ({
            name,
            contractId,
            fnName,
            args,
            network,
          })),
        };
        return JSON.stringify(payload, null, 2);
      },

      importSavedCalls: (json) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(json);
        } catch {
          throw new Error("Invalid JSON: could not parse the import file.");
        }

        const envelope = parsed as Partial<SavedCallsExport>;
        if (
          !envelope ||
          envelope.type !== "soroban-dev-console/saved-calls" ||
          !Array.isArray(envelope.calls)
        ) {
          throw new Error("Unrecognized format: expected a saved-calls export file.");
        }

        const existing = new Set(get().savedCalls.map((c) => savedCallHash(c)));
        let imported = 0;
        let skipped = 0;
        const additions: SavedCall[] = [];

        for (const raw of envelope.calls) {
          if (
            !raw ||
            typeof raw.contractId !== "string" ||
            typeof raw.fnName !== "string" ||
            typeof raw.network !== "string" ||
            !Array.isArray(raw.args)
          ) {
            skipped++;
            continue;
          }
          const hash = savedCallHash(raw);
          if (existing.has(hash)) {
            skipped++;
            continue;
          }
          existing.add(hash);
          additions.push({
            id: crypto.randomUUID(),
            name: typeof raw.name === "string" ? raw.name : raw.fnName,
            contractId: raw.contractId,
            fnName: raw.fnName,
            args: raw.args,
            network: raw.network,
            createdAt: Date.now(),
          });
          imported++;
        }

        if (additions.length > 0) {
          set((state) => ({ savedCalls: [...additions, ...state.savedCalls] }));
        }

        return { imported, skipped };
      },
    }),
    { name: "soroban-saved-calls" },
  ),
);
