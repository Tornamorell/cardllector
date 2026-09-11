import { describe, expect, it } from "vitest";
import { sumValue, unitPriceEur } from "./pricing";

const card = { priceEur: 2.06, priceEurFoil: 12.5 };

describe("unitPriceEur", () => {
  it("uses the price matching the finish", () => {
    expect(unitPriceEur("nonfoil", card)).toBe(2.06);
    expect(unitPriceEur("foil", card)).toBe(12.5);
  });

  it("has no price for etched foils or cards without catalog entry", () => {
    expect(unitPriceEur("etched", card)).toBeNull();
    expect(unitPriceEur("nonfoil", null)).toBeNull();
  });
});

describe("sumValue", () => {
  it("multiplies by quantity and reports unpriced copies separately", () => {
    const value = sumValue([
      { quantity: 3, finish: "nonfoil", card },
      { quantity: 1, finish: "foil", card },
      { quantity: 2, finish: "foil", card: { priceEur: 1, priceEurFoil: null } },
    ]);
    expect(value).toEqual({ valueEur: 18.68, cardCount: 6, unpricedCount: 2 });
  });

  it("is zero for an empty collection", () => {
    expect(sumValue([])).toEqual({ valueEur: 0, cardCount: 0, unpricedCount: 0 });
  });
});
