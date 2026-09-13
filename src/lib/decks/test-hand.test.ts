import { describe, expect, it } from "vitest";
import { buildLibrary, cardsToBottom, shuffle } from "./test-hand";

const card = (oracleId: string, quantity: number, isLand = false) => ({
  oracleId,
  name: oracleId,
  imageSmall: null,
  printingId: null,
  isLand,
  quantity,
});

describe("buildLibrary", () => {
  it("has one entry per copy, each with its own key", () => {
    const library = buildLibrary([card("island", 3, true), card("sol-ring", 1)]);
    expect(library).toHaveLength(4);
    expect(new Set(library.map((c) => c.key)).size).toBe(4);
    expect(library.filter((c) => c.isLand)).toHaveLength(3);
  });
});

describe("shuffle", () => {
  it("keeps every card and leaves the input alone", () => {
    const items = [1, 2, 3, 4, 5, 6];
    let seed = 42;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const out = shuffle(items, random);
    expect([...out].sort()).toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6]);
    expect(out).not.toEqual(items);
  });
});

describe("cardsToBottom", () => {
  it("makes the first mulligan free", () => {
    expect([0, 1, 2, 3].map(cardsToBottom)).toEqual([0, 0, 1, 2]);
  });
});
