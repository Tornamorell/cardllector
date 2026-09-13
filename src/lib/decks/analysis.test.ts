import { describe, expect, it } from "vitest";
import {
  analyzeDeck,
  bracketHint,
  hypergeometric,
  manaPips,
  openingHandLands,
  typeGroup,
  type DeckCardInfo,
} from "./analysis";

const card = (c: Partial<DeckCardInfo> & Pick<DeckCardInfo, "name">): DeckCardInfo => ({
  board: "main",
  quantity: 1,
  typeLine: null,
  manaCost: null,
  cmc: 0,
  colorIdentity: [],
  producedMana: [],
  oracleText: null,
  keywords: [],
  commanderLegality: "legal",
  gameChanger: false,
  priceEur: null,
  ...c,
});

const atraxa = card({
  board: "commander",
  name: "Atraxa, Praetors' Voice",
  typeLine: "Legendary Creature — Phyrexian Angel Horror",
  manaCost: "{G}{W}{U}{B}",
  cmc: 4,
  colorIdentity: ["W", "U", "B", "G"],
});

const deck: DeckCardInfo[] = [
  atraxa,
  card({ name: "Sol Ring", typeLine: "Artifact", manaCost: "{1}", cmc: 1, producedMana: ["C"], priceEur: 1.5 }),
  card({ name: "Island", quantity: 30, typeLine: "Basic Land — Island", manaCost: "", colorIdentity: ["U"], producedMana: ["U"], priceEur: 0.1 }),
  card({ name: "Counterspell", quantity: 2, typeLine: "Instant", manaCost: "{U}{U}", cmc: 2, colorIdentity: ["U"] }),
  card({ name: "Lightning Bolt", typeLine: "Instant", manaCost: "{R}", cmc: 1, colorIdentity: ["R"] }),
  card({
    name: "Relentless Rats",
    quantity: 3,
    typeLine: "Creature — Rat",
    manaCost: "{1}{B}{B}",
    cmc: 3,
    colorIdentity: ["B"],
    oracleText: "A deck can have any number of cards named Relentless Rats.",
  }),
  card({ name: "Emeria's Call // Emeria, Shattered Skyclave", typeLine: "Sorcery // Land", manaCost: "{4}{W}{W}{W}", cmc: 7, colorIdentity: ["W"], producedMana: ["W"] }),
  card({ name: "The One Ring", typeLine: "Legendary Artifact", manaCost: "{4}", cmc: 4, gameChanger: true }),
  card({ name: "Primeval Titan", typeLine: "Creature — Giant", manaCost: "{4}{G}{G}", cmc: 6, colorIdentity: ["G"], commanderLegality: "banned" }),
  card({ name: "Kitchen Finks", typeLine: "Creature — Ouphe", manaCost: "{1}{G/W}{G/W}", cmc: 3, colorIdentity: ["G", "W"] }),
  card({ board: "side", name: "Swords to Plowshares", typeLine: "Instant", manaCost: "{W}", cmc: 1, colorIdentity: ["W"] }),
];

describe("typeGroup", () => {
  it("counts lands first, then creatures, then the first type", () => {
    expect(typeGroup("Artifact Creature — Golem")).toBe("creature");
    expect(typeGroup("Artifact Land")).toBe("land");
    expect(typeGroup("Sorcery // Land")).toBe("sorcery");
    expect(typeGroup("Legendary Enchantment — Background")).toBe("enchantment");
    expect(typeGroup(null)).toBe("other");
  });
});

describe("manaPips", () => {
  it("counts coloured symbols of the front face, hybrid for each colour, phyrexian for its own", () => {
    expect(manaPips("{2/W}{W/P}{C}{X}")).toEqual({ W: 2, U: 0, B: 0, R: 0, G: 0, C: 1 });
    expect(manaPips("{G/W}{G/W} // {3}{R}")).toMatchObject({ G: 2, W: 2, R: 0 });
  });
});

describe("analyzeDeck", () => {
  const a = analyzeDeck(deck);

  it("counts boards, types and the curve of what's played", () => {
    expect(a.copies).toEqual({ commander: 1, main: 41, side: 1, maybe: 0 });
    expect(a.size).toBe(42);
    expect(a.types).toMatchObject({ creature: 6, artifact: 2, land: 30, instant: 3, sorcery: 1 });
    expect(a.curve).toEqual([0, 2, 2, 4, 2, 0, 1, 1]);
    expect(a.curveByType[3]).toEqual({ creature: 4 });
    expect(a.averageCmc).toBeCloseTo(39 / 12);
    expect(a.mdfcLands).toBe(1);
  });

  it("sets colour symbols against the sources that make them", () => {
    expect(a.pips).toEqual({ W: 6, U: 5, B: 7, R: 1, G: 5, C: 0 });
    expect(a.landSources.U).toBe(30);
    expect(a.otherSources).toMatchObject({ C: 1, W: 1 });
    expect(a.identity).toEqual(["W", "U", "B", "G"]);
  });

  it("flags what Commander doesn't allow", () => {
    const messages = a.issues.map((i) => i.message);
    expect(messages).toContain("El mazo tiene 42 cartas con el comandante; en Commander son 100.");
    expect(a.issues.find((i) => i.message.startsWith("Solo puede haber una copia"))?.cards).toEqual(["2 Counterspell"]);
    expect(a.issues.find((i) => i.message.startsWith("Fuera de la identidad"))?.cards).toEqual(["Lightning Bolt"]);
    expect(a.issues.find((i) => i.message.startsWith("Prohibidas"))?.cards).toEqual(["Primeval Titan"]);
  });

  it("lists the Game Changers and adds up the price", () => {
    expect(a.gameChangers).toEqual(["The One Ring"]);
    expect(a.price).toBeCloseTo(4.5);
    expect(a.unpriced).toBe(11);
  });

  it("checks commanders and their pairs", () => {
    const partner = (name: string) =>
      card({ board: "commander", name, typeLine: "Legendary Creature — Human", keywords: ["Partner"] });
    const hint = (cards: DeckCardInfo[]) => analyzeDeck(cards).issues.map((i) => i.message)[0];
    expect(hint([])).toMatch(/^Falta el comandante/);
    expect(hint([partner("Tymna"), partner("Thrasios")])).toMatch(/^El mazo tiene/);
    expect(hint([atraxa, partner("Thrasios")])).toMatch(/^Estos dos no pueden ir juntos/);
    const background = card({
      board: "commander",
      name: "Candlekeep Sage",
      typeLine: "Legendary Enchantment — Background",
    });
    const chooser = card({
      board: "commander",
      name: "Wilson, Refined Grizzly",
      typeLine: "Legendary Creature — Bear Warrior",
      oracleText: "Choose a Background",
    });
    expect(hint([chooser, background])).toMatch(/^El mazo tiene/);
    expect(hint([card({ board: "commander", name: "Sol Ring", typeLine: "Artifact" })])).toMatch(/^No pueden ser comandantes/);
  });
});

describe("hypergeometric and opening hands", () => {
  it("computes exact odds", () => {
    // 10 cards, 5 hits, draw 2: exactly one hit = 5·5 / C(10,2) = 25/45.
    expect(hypergeometric(10, 5, 2, 1)).toBeCloseTo(25 / 45);
    const total = [0, 1, 2, 3, 4, 5, 6, 7].reduce((s, k) => s + hypergeometric(99, 37, 7, k), 0);
    expect(total).toBeCloseTo(1);
  });

  it("gives a 37-land Commander deck its odds", () => {
    // Checked with exact integer combinations: 81.42 % and 74.84 %.
    const odds = openingHandLands(99, 37);
    expect(odds.atLeastTwo).toBeCloseTo(0.8142, 3);
    expect(odds.twoToFour).toBeCloseTo(0.7484, 3);
  });
});

describe("bracketHint", () => {
  it("reads the Game Changers count", () => {
    expect(bracketHint(0)).toMatch(/brackets 1 y 2/);
    expect(bracketHint(3)).toMatch(/bracket 3/);
    expect(bracketHint(4)).toMatch(/bracket 4/);
  });
});
