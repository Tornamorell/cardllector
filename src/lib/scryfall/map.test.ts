import { describe, expect, it } from "vitest";
import { mapOracleCard, mapPrintedName, mapScryfallCard, mapScryfallSet } from "./map";
import type { ScryfallCard, ScryfallSet } from "./types";

const updatedAt = new Date("2026-09-11T09:05:34Z");

const bolt: ScryfallCard = {
  object: "card",
  id: "e3285e6b-3e79-4d7c-bf96-d920f973b80d",
  oracle_id: "4457ed35-7c10-48c8-9776-456485fdf070",
  name: "Lightning Bolt",
  lang: "en",
  set: "m10",
  collector_number: "146",
  rarity: "common",
  type_line: "Instant",
  released_at: "2009-07-17",
  digital: false,
  finishes: ["nonfoil", "foil"],
  cardmarket_id: 20194,
  image_uris: { small: "https://img/small.jpg", normal: "https://img/normal.jpg" },
  prices: { eur: "2.06", eur_foil: "12.50", usd: "0.96", usd_foil: null },
};

const delver: ScryfallCard = {
  ...bolt,
  id: "11bf83bb-c95b-4b4f-9a56-ce7a1816307a",
  oracle_id: undefined,
  name: "Delver of Secrets // Insectile Aberration",
  set: "isd",
  collector_number: "51",
  type_line: undefined,
  image_uris: undefined,
  card_faces: [
    {
      name: "Delver of Secrets",
      oracle_id: "abc",
      type_line: "Creature — Human Wizard",
      image_uris: { small: "https://img/front-small.jpg", normal: "https://img/front.jpg" },
    },
    { name: "Insectile Aberration", image_uris: { small: "x", normal: "y" } },
  ],
};

describe("mapScryfallCard", () => {
  it("maps prices as numbers and keeps missing ones null", () => {
    const row = mapScryfallCard(bolt, updatedAt)!;
    expect(row).toMatchObject({
      game: "mtg",
      externalId: bolt.id,
      name: "Lightning Bolt",
      searchName: "lightning bolt",
      setCode: "m10",
      collectorNumber: "146",
      priceEur: 2.06,
      priceEurFoil: 12.5,
      priceUsd: 0.96,
      priceUsdFoil: null,
      imageNormal: "https://img/normal.jpg",
      pricesUpdatedAt: updatedAt,
    });
  });

  it("takes images, oracle id and type line from the front face of double-faced cards", () => {
    const row = mapScryfallCard(delver, updatedAt)!;
    expect(row.imageNormal).toBe("https://img/front.jpg");
    expect(row.oracleId).toBe("abc");
    expect(row.typeLine).toBe("Creature — Human Wizard");
  });

  it("skips digital-only printings", () => {
    expect(mapScryfallCard({ ...bolt, digital: true }, updatedAt)).toBeNull();
  });
});

describe("mapOracleCard", () => {
  it("keeps the rules side, and the legality of the main formats only", () => {
    const row = mapOracleCard({
      ...bolt,
      layout: "normal",
      mana_cost: "{R}",
      cmc: 1,
      colors: ["R"],
      color_identity: ["R"],
      oracle_text: "Lightning Bolt deals 3 damage to any target.",
      keywords: [],
      legalities: { commander: "legal", standard: "not_legal", modern: "legal", oathbreaker: "legal" },
      game_changer: false,
    })!;
    expect(row).toMatchObject({
      oracleId: bolt.oracle_id,
      name: "Lightning Bolt",
      searchName: "lightning bolt",
      manaCost: "{R}",
      cmc: 1,
      colors: ["R"],
      colorIdentity: ["R"],
      typeLine: "Instant",
      gameChanger: false,
    });
    expect(row.legalities).toMatchObject({ commander: "legal", modern: "legal", pauper: "not_legal" });
    expect(row.legalities).not.toHaveProperty("oathbreaker");
  });

  it("takes a double-faced card's cost, colours, types and text from its faces", () => {
    const row = mapOracleCard({
      ...delver,
      layout: "transform",
      cmc: 1,
      color_identity: ["U"],
      card_faces: [
        {
          name: "Delver of Secrets",
          oracle_id: "abc",
          type_line: "Creature — Human Wizard",
          mana_cost: "{U}",
          colors: ["U"],
          oracle_text: "At the beginning of your upkeep, look at the top card of your library.",
        },
        { name: "Insectile Aberration", type_line: "Creature — Human Insect", mana_cost: "", colors: ["U"], oracle_text: "Flying" },
      ],
    })!;
    expect(row).toMatchObject({
      oracleId: "abc",
      frontSearchName: "delver of secrets",
      manaCost: "{U}",
      colors: ["U"],
      typeLine: "Creature — Human Wizard // Creature — Human Insect",
    });
    expect(row.oracleText).toContain("\n//\nFlying");
  });

  it("needs an oracle id", () => {
    expect(mapOracleCard({ ...delver, card_faces: [{ name: "Delver of Secrets" }] })).toBeNull();
  });
});

describe("mapPrintedName", () => {
  it("returns the accent-free search name of a Spanish printing", () => {
    const row = mapPrintedName({ ...bolt, lang: "es", printed_name: "Relámpago" });
    expect(row).toEqual({
      setCode: "m10",
      collectorNumber: "146",
      lang: "es",
      printedName: "Relámpago",
      searchName: "relampago",
    });
  });

  it("joins the faces of double-faced printings", () => {
    const row = mapPrintedName({
      ...delver,
      lang: "es",
      card_faces: [
        { name: "Delver of Secrets", printed_name: "Descubridor de secretos" },
        { name: "Insectile Aberration", printed_name: "Aberración insectoide" },
      ],
    });
    expect(row?.printedName).toBe("Descubridor de secretos // Aberración insectoide");
  });

  it("ignores English printings and printings without a printed name", () => {
    expect(mapPrintedName(bolt)).toBeNull();
    expect(mapPrintedName({ ...bolt, lang: "es" })).toBeNull();
  });
});

describe("mapScryfallSet", () => {
  const set: ScryfallSet = {
    object: "set",
    code: "isd",
    name: "Innistrad",
    set_type: "expansion",
    released_at: "2011-09-30",
    card_count: 264,
    digital: false,
    icon_svg_uri: "https://svgs/isd.svg",
  };

  it("maps physical sets and skips digital ones", () => {
    expect(mapScryfallSet(set)).toMatchObject({ code: "isd", name: "Innistrad", cardCount: 264 });
    expect(mapScryfallSet({ ...set, digital: true })).toBeNull();
  });
});
