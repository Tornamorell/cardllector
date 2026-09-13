import { describe, expect, it } from "vitest";
import { formatDecklist, parseDecklist } from "./decklist";

describe("parseDecklist", () => {
  it("reads Arena/Moxfield lists: boards, quantities, printings and foils", () => {
    const { lines, unreadable } = parseDecklist(`
About
Name Atraxa superfriends

Commander
1 Atraxa, Praetors' Voice (C16) 28

Deck
1 Sol Ring (C21) 263 *F*
4x Island
Counterspell
1 Delver of Secrets // Insectile Aberration (ISD) 51

SIDEBOARD:
2 Swords to Plowshares
`);
    expect(unreadable).toEqual([]);
    expect(lines).toEqual([
      { board: "commander", quantity: 1, name: "Atraxa, Praetors' Voice", setCode: "c16", collectorNumber: "28", foil: false },
      { board: "main", quantity: 1, name: "Sol Ring", setCode: "c21", collectorNumber: "263", foil: true },
      { board: "main", quantity: 4, name: "Island", setCode: null, collectorNumber: null, foil: false },
      { board: "main", quantity: 1, name: "Counterspell", setCode: null, collectorNumber: null, foil: false },
      {
        board: "main",
        quantity: 1,
        name: "Delver of Secrets // Insectile Aberration",
        setCode: "isd",
        collectorNumber: "51",
        foil: false,
      },
      { board: "side", quantity: 2, name: "Swords to Plowshares", setCode: null, collectorNumber: null, foil: false },
    ]);
  });

  it("starts in the main deck, adds up repeats and skips comments", () => {
    const { lines } = parseDecklist("// a comment\n10 Forest\n# another\n5 forest\nMaybeboard\n1 Craterhoof Behemoth");
    expect(lines).toMatchObject([
      { board: "main", quantity: 15, name: "Forest" },
      { board: "maybe", quantity: 1, name: "Craterhoof Behemoth" },
    ]);
  });

  it("reports what it can't read", () => {
    expect(parseDecklist("0 Sol Ring").unreadable).toEqual(["0 Sol Ring"]);
  });
});

describe("formatDecklist", () => {
  it("writes boards under the headers Moxfield and Arena read, and reads back the same", () => {
    const cards = [
      { board: "commander" as const, quantity: 1, name: "Atraxa, Praetors' Voice", setCode: "c16", collectorNumber: "28" },
      { board: "main" as const, quantity: 30, name: "Island" },
      { board: "side" as const, quantity: 1, name: "Swords to Plowshares" },
    ];
    const text = formatDecklist(cards);
    expect(text).toBe(
      "Commander\n1 Atraxa, Praetors' Voice (C16) 28\n\nDeck\n30 Island\n\nSideboard\n1 Swords to Plowshares",
    );
    expect(parseDecklist(text).lines.map((l) => [l.board, l.quantity, l.name])).toEqual([
      ["commander", 1, "Atraxa, Praetors' Voice"],
      ["main", 30, "Island"],
      ["side", 1, "Swords to Plowshares"],
    ]);
  });
});
