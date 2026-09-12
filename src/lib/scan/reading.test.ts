import { describe, expect, it } from "vitest";
import { identifyCostUsd, seriesFirst, splitNumber } from "./reading";

describe("identifyCostUsd", () => {
  it("prices a typical card photo", () => {
    // The Élite Power test photo: 1 205 tokens in at 2 $/M, 51 out at 10 $/M.
    expect(identifyCostUsd({ input_tokens: 1205, output_tokens: 51 })).toBeCloseTo(0.00292, 8);
  });
});

describe("splitNumber", () => {
  it("splits number and total", () => {
    expect(splitNumber("123/280")).toEqual({ number: "123", total: "280" });
    expect(splitNumber(" 001 / 193 ")).toEqual({ number: "001", total: "193" });
  });

  it("keeps a number without total", () => {
    expect(splitNumber("0001")).toEqual({ number: "0001", total: null });
    expect(splitNumber("TG12")).toEqual({ number: "TG12", total: null });
  });

  it("drops a leading # or Nº", () => {
    expect(splitNumber("#88")).toEqual({ number: "88", total: null });
    expect(splitNumber("Nº 88")).toEqual({ number: "88", total: null });
  });

  it("rejects text without digits", () => {
    expect(splitNumber("")).toBeNull();
    expect(splitNumber("SOB")).toBeNull();
  });
});

describe("seriesFirst", () => {
  const cards = [
    { id: "9", rarity: "élite" },
    { id: "9-POWER", rarity: "élite power" },
    { id: "88", rarity: "básica" },
  ];

  it("puts the series the model saw first, whatever the case", () => {
    expect(seriesFirst(cards, "Élite Power").map((c) => c.id)).toEqual(["9-POWER", "9", "88"]);
  });

  it("never drops a card", () => {
    expect(seriesFirst(cards, "Nuevo Fichaje").map((c) => c.id)).toEqual(["9", "9-POWER", "88"]);
    expect(seriesFirst(cards, null)).toBe(cards);
  });
});
