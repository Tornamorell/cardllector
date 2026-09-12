import { describe, expect, it } from "vitest";
import type { ScanMatch } from "@/lib/queries/scan";
import { entryUnitPrice, sessionTotals, type SessionEntry } from "./session";

const match = (priceEur: number | null, priceEurFoil: number | null) =>
  ({ priceEur, priceEurFoil }) as ScanMatch;

const entry = (m: ScanMatch, finish: SessionEntry["finish"], count = 1): SessionEntry => ({
  key: crypto.randomUUID(),
  itemId: crypto.randomUUID(),
  match: m,
  lang: null,
  count,
  finish,
  addedAt: 0,
});

describe("entryUnitPrice", () => {
  it("uses the price of the copy's finish", () => {
    expect(entryUnitPrice(entry(match(2, 12.5), "nonfoil"))).toBe(2);
    expect(entryUnitPrice(entry(match(2, 12.5), "foil"))).toBe(12.5);
    expect(entryUnitPrice(entry(match(2, 12.5), "etched"))).toBeNull();
  });
});

describe("sessionTotals", () => {
  it("adds up copies and value, and counts unpriced copies apart", () => {
    const totals = sessionTotals([
      entry(match(2.06, 5.73), "nonfoil", 3),
      entry(match(2.06, 5.73), "foil"),
      entry(match(1, null), "foil", 2),
    ]);
    expect(totals).toEqual({ cards: 6, valueEur: 11.91, unpriced: 2 });
  });

  it("is zero for a new session", () => {
    expect(sessionTotals([])).toEqual({ cards: 0, valueEur: 0, unpriced: 0 });
  });
});
