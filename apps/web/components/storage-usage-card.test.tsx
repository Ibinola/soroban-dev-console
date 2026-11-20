import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/i18n/locale-provider";
import { useContractStore } from "@/store/useContractStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { StorageUsageCard } from "./storage-usage-card";

const storageMessages = {
  settings: {
    storage: {
      title: "Local Storage Usage",
      description: "Storage description",
      usage: "Local storage usage",
      limitNote: "Estimated limit",
      warning: "Storage warning",
      workspaces: "Workspaces",
      contracts: "Contracts",
      deploymentLogs: "Deployment logs",
      clearLabel: "Select data to clear",
      clearCache: "Clear cache",
      confirm: "Clear selected data?",
      clearSuccess: "Data cleared",
      clearFailed: "Could not clear data",
    },
  },
};

function installLocalStorage() {
  const entries = new Map<string, string>();
  const storage = window.localStorage;
  Object.defineProperties(storage, {
    length: {
      configurable: true,
      get() {
        return entries.size;
      },
    },
    key: {
      configurable: true,
      value: (index: number) => Array.from(entries.keys())[index] ?? null,
    },
  });
  Object.assign(storage, {
    clear: () => entries.clear(),
    getItem: (key: string) => entries.get(key) ?? null,
    removeItem: (key: string) => entries.delete(key),
    setItem: (key: string, value: string) => entries.set(key, String(value)),
  });
  return storage;
}

function renderCard() {
  return render(
    <LocaleProvider locale="en" messages={storageMessages}>
      <StorageUsageCard />
    </LocaleProvider>,
  );
}

describe("StorageUsageCard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useContractStore.setState({ contracts: [], undoStack: [], redoStack: [] });
  });

  it("measures categorized storage and refreshes after a store update", async () => {
    const storage = installLocalStorage();
    storage.setItem("soroban-workspaces", "w".repeat(100));
    storage.setItem("soroban-contracts-storage", "c".repeat(200));
    storage.setItem("soroban-deployment-log-storage", "d".repeat(50));

    renderCard();

    expect(await screen.findByText("236 B")).toBeInTheDocument();
    expect(screen.getByText("450 B")).toBeInTheDocument();
    expect(screen.getByText("160 B")).toBeInTheDocument();
    expect(screen.getByText("846 B / 5.00 MB")).toBeInTheDocument();

    storage.setItem("soroban-contracts-storage", "c".repeat(400));
    act(() => {
      useContractStore.setState({ contracts: [] });
    });

    await waitFor(() => {
      expect(screen.getByText("850 B")).toBeInTheDocument();
      expect(screen.getByText("1246 B / 5.00 MB")).toBeInTheDocument();
    });
  });

  it("clears only the selected storage category", async () => {
    installLocalStorage();
    useContractStore.setState({
      contracts: [{ id: "C1", name: "Contract", network: "testnet", addedAt: 1 }],
      undoStack: [],
      redoStack: [],
    });
    const workspaceBeforeClear = useWorkspaceStore.getState().workspaces;
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderCard();
    fireEvent.click(screen.getByRole("checkbox", { name: "Contracts" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear cache" }));

    await waitFor(() => {
      expect(useContractStore.getState().contracts).toEqual([]);
    });
    expect(useWorkspaceStore.getState().workspaces).toBe(workspaceBeforeClear);
  });
});
