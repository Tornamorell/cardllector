import { describe, expect, it } from "vitest";
import {
  defaultSetGroup,
  finishLabel,
  gameById,
  gameBySlug,
  rarityLabel,
  rarityRank,
  rarityTier,
  setTypeFilter,
  setTypeLabel,
} from "./games";

const magic = gameBySlug("magic")!;
const pokemon = gameBySlug("pokemon")!;

describe("games", () => {
  it("resolves games by URL slug and by id", () => {
    expect(magic.id).toBe("mtg");
    expect(gameById("pokemon")?.slug).toBe("pokemon");
    expect(gameBySlug("yugioh")).toBeNull();
  });

  it("includes the listed set types for a regular group", () => {
    expect(setTypeFilter(magic, "main")).toEqual({ include: ["core", "expansion"] });
    expect(setTypeFilter(pokemon, "sv")).toEqual({ include: ["sv"] });
  });

  it("excludes every other group's types for the catch-all group", () => {
    expect(setTypeFilter(magic, "special")).toEqual({
      exclude: ["core", "expansion", "commander", "promo", "token", "memorabilia"],
    });
    expect(setTypeFilter(pokemon, "older")).toEqual({
      exclude: ["me", "sv", "swsh", "sm", "xy", "bw"],
    });
  });

  it("has no type filter for unknown groups (show all)", () => {
    expect(setTypeFilter(magic, "all")).toBeNull();
  });

  it("defaults to the first group", () => {
    expect(defaultSetGroup(magic)).toBe("main");
    expect(defaultSetGroup(pokemon)).toBe("me");
  });

  it("labels rarities and set types, falling back to the raw value", () => {
    expect(rarityLabel(magic, "mythic")).toBe("Mythic");
    expect(rarityLabel(pokemon, "special illustration rare")).toBe("Special Illustration Rare");
    expect(rarityLabel(pokemon, "ace spec rare")).toBe("ACE SPEC Rare");
    expect(rarityLabel(pokemon, "four diamond")).toBe("Four diamond");
    expect(setTypeLabel(magic, "draft_innovation")).toBe("Draft");
    expect(setTypeLabel(pokemon, "swsh")).toBe("Espada y Escudo");
    expect(setTypeLabel(magic, "brand_new_type")).toBe("brand new type");
  });

  it("ranks unknown rarities after known ones", () => {
    expect(rarityRank(magic, "common")).toBeLessThan(rarityRank(magic, "mythic"));
    expect(rarityRank(magic, "weird")).toBe(magic.rarities.length);
  });

  it("maps rarities onto set-symbol colour tiers", () => {
    expect(rarityTier("common")).toBe("common");
    expect(rarityTier("uncommon")).toBe("uncommon");
    expect(rarityTier("rare")).toBe("rare");
    expect(rarityTier("rare holo")).toBe("rare");
    expect(rarityTier("mythic")).toBe("mythic");
    expect(rarityTier("special illustration rare")).toBe("mythic");
    expect(rarityTier("hyper rare")).toBe("mythic");
    expect(rarityTier("double rare")).toBe("special");
    expect(rarityTier("holo rare vmax")).toBe("special");
    expect(rarityTier("illustration rare")).toBe("special");
    expect(rarityTier("promo")).toBe("common");
    expect(rarityTier(null)).toBe("common");
  });

  it("names finishes per game", () => {
    expect(finishLabel("mtg", "foil")).toBe("Foil");
    expect(finishLabel("pokemon", "foil")).toBe("Reverse holo");
    expect(finishLabel(null, "nonfoil")).toBe("Normal");
  });
});
