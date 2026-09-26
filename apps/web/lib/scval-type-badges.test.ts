import { describe, it, expect } from "vitest";
import { xdr } from "@stellar/stellar-sdk";
import {
  SCVAL_BADGE_CLASSES,
  childScvalWrappers,
  enumMemberFor,
  humanizeScvalType,
  scvalBadgeTitle,
  scvalEnumValue,
  scvalFamily,
  scvalWrapperKey,
} from "./scval-type-badges";

describe("enumMemberFor", () => {
  it("builds the SDK member name from a JSON wrapper key", () => {
    expect(enumMemberFor("vec")).toBe("scvVec");
    expect(enumMemberFor("u32")).toBe("scvU32");
    expect(enumMemberFor("ledger_key_nonce")).toBe("scvLedgerKeyNonce");
    expect(enumMemberFor("ledger_key_contract_instance")).toBe("scvLedgerKeyContractInstance");
  });
});

describe("scvalEnumValue", () => {
  it("resolves every ScVal type the SDK declares, to the SDK's own number", () => {
    const schema = (xdr as unknown as { ScValType: { schema: Record<string, unknown> } }).ScValType.schema;
    const members = Object.entries(schema).filter(([key, value]) => key.startsWith("scv") && typeof value === "number");
    expect(members.length).toBeGreaterThanOrEqual(20);

    for (const [member, value] of members) {
      // member: scvLedgerKeyNonce -> json key: ledger_key_nonce
      const jsonKey = member
        .slice(3)
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .toLowerCase();
      expect(scvalEnumValue(jsonKey), `json key ${jsonKey} (${member})`).toBe(value);
    }
  });

  it("uses the documented discriminants for the common wrappers", () => {
    expect(scvalEnumValue("bool")).toBe(0);
    expect(scvalEnumValue("void")).toBe(1);
    expect(scvalEnumValue("u32")).toBe(3);
    expect(scvalEnumValue("vec")).toBe(16);
    expect(scvalEnumValue("map")).toBe(17);
    expect(scvalEnumValue("address")).toBe(18);
  });

  it("returns undefined for keys that are not ScVal wrappers", () => {
    expect(scvalEnumValue("not_a_type")).toBeUndefined();
    expect(scvalEnumValue("")).toBeUndefined();
  });
});

describe("scvalBadgeTitle", () => {
  it("names the enum member and its integer for the hover tooltip", () => {
    expect(scvalBadgeTitle("vec")).toBe("ScValType.scvVec = 16");
    expect(scvalBadgeTitle("ledger_key_nonce")).toBe("ScValType.scvLedgerKeyNonce = 21");
  });

  it("falls back to the member name alone for unknown keys", () => {
    expect(scvalBadgeTitle("nope")).toBe("ScValType.scvNope");
  });
});

describe("scvalWrapperKey", () => {
  it("finds the wrapper key of a decoded ScVal", () => {
    expect(scvalWrapperKey({ vec: [{ bool: true }] })).toBe("vec");
    expect(scvalWrapperKey({ u32: 42 })).toBe("u32");
    expect(scvalWrapperKey({ ledger_key_nonce: { nonce: "1" } })).toBe("ledger_key_nonce");
  });

  it("ignores values that are not ScVal wrappers", () => {
    expect(scvalWrapperKey("plain")).toBeUndefined();
    expect(scvalWrapperKey([{ bool: true }])).toBeUndefined();
    expect(scvalWrapperKey({ unrelated: 1 })).toBeUndefined();
    expect(scvalWrapperKey(null)).toBeUndefined();
  });
});

describe("scvalFamily / badge classes", () => {
  it("maps every wrapper to a family with a distinct colour set", () => {
    const families = ["bool", "void", "error", "u32", "i128", "bytes", "string", "symbol", "vec", "map", "address", "ledger_key_nonce"];
    for (const key of families) {
      const family = scvalFamily(key);
      expect(family, key).toBeDefined();
      expect(SCVAL_BADGE_CLASSES[family!]).toMatch(/border-/);
    }
  });

  it("gives different families different colours", () => {
    expect(SCVAL_BADGE_CLASSES.integer).not.toBe(SCVAL_BADGE_CLASSES.text);
    expect(SCVAL_BADGE_CLASSES.collection).not.toBe(SCVAL_BADGE_CLASSES.address);
  });

  it("returns undefined for unknown keys", () => {
    expect(scvalFamily("nope")).toBeUndefined();
  });
});

describe("childScvalWrappers", () => {
  it("descends into vec items", () => {
    expect(childScvalWrappers("vec", [{ bool: true }, { u32: 1 }])).toHaveLength(2);
  });

  it("descends into both sides of map entries", () => {
    const children = childScvalWrappers("map", [
      { key: { symbol: "a" }, val: { u32: 1 } },
      { key: { symbol: "b" }, val: { vec: [] } },
    ]);
    expect(children).toHaveLength(4);
  });

  it("returns nothing for scalar wrappers", () => {
    expect(childScvalWrappers("u32", 42)).toEqual([]);
    expect(childScvalWrappers("bool", true)).toEqual([]);
  });
});

describe("humanizeScvalType", () => {
  it("turns underscores into spaces for the badge label", () => {
    expect(humanizeScvalType("ledger_key_nonce")).toBe("ledger key nonce");
    expect(humanizeScvalType("vec")).toBe("vec");
  });
});
