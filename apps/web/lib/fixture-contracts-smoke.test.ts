/**
 * #1303: smoke tests for every fixture contract. These run offline (no RPC):
 * they verify that each fixture crate exists in the Cargo workspace, exposes
 * a contract with callable functions, is registered in the fixture manifest,
 * and that the manifest and workspace stay in sync in both directions.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { StrKey } from "@stellar/stellar-sdk";
import { FIXTURE_CONTRACTS } from "./fixture-manifest";

const CONTRACTS_DIR = path.resolve(__dirname, "../../../contracts");

function workspaceMembers(): string[] {
  const toml = readFileSync(path.join(CONTRACTS_DIR, "Cargo.toml"), "utf8");
  const block = /members\s*=\s*\[([^\]]*)\]/.exec(toml)?.[1] ?? "";
  return [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/** Manifest key for a crate directory: `counter-fixture` -> `counter`. */
const keyFor = (dir: string) => dir.replace(/-fixture$/, "");

const members = workspaceMembers();

describe("fixture contracts smoke (#1303)", () => {
  it("finds the fixture crates in the Cargo workspace", () => {
    expect(members.length).toBeGreaterThanOrEqual(8);
  });

  describe.each(members)("%s", (dir) => {
    const root = path.join(CONTRACTS_DIR, dir);
    const libPath = path.join(root, "src/lib.rs");

    it("has a Cargo manifest and contract source", () => {
      expect(existsSync(path.join(root, "Cargo.toml"))).toBe(true);
      expect(existsSync(libPath)).toBe(true);
    });

    it("declares a #[contract] with at least one public entry point", () => {
      const src = readFileSync(libPath, "utf8");
      expect(src).toContain("#![no_std]");
      expect(src).toMatch(/#\[contract\]/);
      const impl = src.slice(src.indexOf("#[contractimpl]"));
      expect(impl).toMatch(/pub fn \w+\(/);
    });

    it("builds as a contract crate (cdylib)", () => {
      const toml = readFileSync(path.join(root, "Cargo.toml"), "utf8");
      expect(toml).toMatch(/crate-type\s*=\s*\[[^\]]*"cdylib"/);
      expect(toml).toContain("soroban-sdk");
    });

    it("is registered in the fixture manifest", () => {
      expect(FIXTURE_CONTRACTS.map((f) => f.key)).toContain(keyFor(dir));
    });
  });

  it("every manifest fixture has a matching crate in the workspace", () => {
    const keys = new Set(members.map(keyFor));
    for (const fixture of FIXTURE_CONTRACTS) {
      expect(keys.has(fixture.key), `no crate for fixture '${fixture.key}'`).toBe(true);
    }
  });

  it("manifest entries are well-formed and unique", () => {
    const keys = FIXTURE_CONTRACTS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const f of FIXTURE_CONTRACTS) {
      expect(f.label.trim()).not.toBe("");
      expect(f.description.trim()).not.toBe("");
      expect(["local", "testnet"]).toContain(f.network);
    }
  });

  it("any configured fixture contract ID is a valid contract address", () => {
    for (const f of FIXTURE_CONTRACTS) {
      if (f.contractId !== null) {
        expect(StrKey.isValidContract(f.contractId), `${f.key}: ${f.contractId}`).toBe(true);
      }
    }
  });
});
