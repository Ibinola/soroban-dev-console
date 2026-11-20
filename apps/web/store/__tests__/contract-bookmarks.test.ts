import { describe, it, expect, beforeEach } from "vitest";
import { StrKey, Keypair } from "@stellar/stellar-sdk";
import {
  MAX_CONTRACT_BOOKMARKS,
  shortenContractId,
  useWorkspaceStore,
} from "../useWorkspaceStore";
import { STORE_SCHEMA_VERSION } from "../schema-version";

function contractAddress(): string {
  return StrKey.encodeContract(Keypair.random().rawPublicKey());
}

describe("contract bookmarks with labels (#1265)", () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      workspaces: [
        {
          version: STORE_SCHEMA_VERSION,
          id: "default",
          name: "Default Project",
          contractIds: [],
          savedCallIds: [],
          artifactRefs: [],
          selectedNetwork: "testnet",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      activeWorkspaceId: "default",
      contractBookmarks: {},
    });
  });

  it("stores a bookmark with a custom label", () => {
    const address = contractAddress();
    const bookmark = useWorkspaceStore
      .getState()
      .bookmarkContract("default", address, "testnet", "manual", "Treasury");

    expect(bookmark.label).toBe("Treasury");
    expect(
      useWorkspaceStore.getState().getContractBookmarks("default"),
    ).toEqual([
      expect.objectContaining({ contractId: address, label: "Treasury" }),
    ]);
  });

  it("falls back to a shortened address when no label is given", () => {
    const address = contractAddress();

    const bookmark = useWorkspaceStore
      .getState()
      .bookmarkContract("default", address, "testnet", "manual");

    expect(bookmark.label).toBe(shortenContractId(address));
    expect(bookmark.label).toContain("…");
  });

  it("keeps the label when an existing bookmark is refreshed", () => {
    const address = contractAddress();
    const { bookmarkContract } = useWorkspaceStore.getState();

    bookmarkContract("default", address, "testnet", "manual", "Treasury");
    bookmarkContract(
      "default",
      address,
      "testnet",
      "contracts-page",
      "Treasury",
    );

    const bookmarks = useWorkspaceStore
      .getState()
      .getContractBookmarks("default");
    expect(bookmarks).toHaveLength(1);
    expect(bookmarks[0]).toMatchObject({
      label: "Treasury",
      source: "contracts-page",
    });
  });

  it("updates and deletes a bookmark", () => {
    const address = contractAddress();
    const { bookmarkContract } = useWorkspaceStore.getState();
    const bookmark = bookmarkContract(
      "default",
      address,
      "testnet",
      "manual",
      "Old",
    );

    useWorkspaceStore
      .getState()
      .updateContractBookmark("default", bookmark.id, { label: "Escrow" });
    expect(
      useWorkspaceStore.getState().getContractBookmarks("default")[0].label,
    ).toBe("Escrow");

    useWorkspaceStore
      .getState()
      .updateContractBookmark("default", bookmark.id, {
        label: "   ",
      });
    expect(
      useWorkspaceStore.getState().getContractBookmarks("default")[0].label,
    ).toBe(shortenContractId(address));

    useWorkspaceStore.getState().removeContractBookmark("default", bookmark.id);
    expect(
      useWorkspaceStore.getState().getContractBookmarks("default"),
    ).toEqual([]);
  });

  it("searches bookmarks by label and by address", () => {
    const treasury = contractAddress();
    const escrow = contractAddress();
    const { bookmarkContract } = useWorkspaceStore.getState();

    bookmarkContract("default", treasury, "testnet", "manual", "Treasury");
    bookmarkContract("default", escrow, "testnet", "manual", "Escrow");

    expect(
      useWorkspaceStore
        .getState()
        .searchContractBookmarks("default", "treas")
        .map((entry) => entry.label),
    ).toEqual(["Treasury"]);

    expect(
      useWorkspaceStore
        .getState()
        .searchContractBookmarks("default", escrow.slice(0, 12))
        .map((entry) => entry.label),
    ).toEqual(["Escrow"]);

    expect(
      useWorkspaceStore.getState().searchContractBookmarks("default", ""),
    ).toHaveLength(2);
    expect(
      useWorkspaceStore
        .getState()
        .searchContractBookmarks("default", "missing"),
    ).toEqual([]);
  });

  it("lists favourites first", () => {
    const first = contractAddress();
    const second = contractAddress();
    const { bookmarkContract } = useWorkspaceStore.getState();

    const older = bookmarkContract(
      "default",
      first,
      "testnet",
      "manual",
      "Older",
    );
    bookmarkContract("default", second, "testnet", "manual", "Newer");
    useWorkspaceStore.getState().toggleBookmarkFavorite("default", older.id);

    expect(
      useWorkspaceStore
        .getState()
        .searchContractBookmarks("default", "")
        .map((entry) => entry.label),
    ).toEqual(["Older", "Newer"]);
  });

  it(`caps a workspace at ${MAX_CONTRACT_BOOKMARKS} bookmarks`, () => {
    const { bookmarkContract } = useWorkspaceStore.getState();

    for (let index = 0; index < MAX_CONTRACT_BOOKMARKS + 5; index++) {
      bookmarkContract(
        "default",
        contractAddress(),
        "testnet",
        "manual",
        `Bookmark ${index}`,
      );
    }

    const bookmarks = useWorkspaceStore
      .getState()
      .getContractBookmarks("default");
    expect(bookmarks).toHaveLength(MAX_CONTRACT_BOOKMARKS);
    // The most recent bookmark survives, the oldest were evicted.
    expect(bookmarks.map((entry) => entry.label)).toContain(
      `Bookmark ${MAX_CONTRACT_BOOKMARKS + 4}`,
    );
    expect(bookmarks.map((entry) => entry.label)).not.toContain("Bookmark 0");
  });
});
