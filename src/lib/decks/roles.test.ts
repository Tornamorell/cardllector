import { describe, expect, it } from "vitest";
import { cardRoles, roleCounts } from "./roles";

const roles = (oracleText: string, typeLine = "Instant", producedMana: string[] = []) =>
  cardRoles({ typeLine, oracleText, producedMana });

describe("cardRoles", () => {
  it("finds ramp: mana makers, land fetching, extra lands, treasures", () => {
    expect(roles("{T}: Add {C}{C}.", "Artifact", ["C"])).toEqual(["ramp"]); // Sol Ring
    expect(roles("Flying\n{T}: Add one mana of any color.", "Creature — Bird", ["W", "U", "B", "R", "G"])).toEqual(["ramp"]);
    expect(
      roles(
        "Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.",
        "Sorcery",
      ),
    ).toEqual(["ramp"]); // Cultivate: not a tutor
    expect(roles("You may play an additional land on each of your turns.", "Enchantment")).toEqual(["ramp"]);
    expect(roles("When this enters, create a Treasure token for each artifact and creature your opponents control.", "Creature — Goblin Pirate")).toContain(
      "ramp",
    );
  });

  it("finds draw, ignoring reminder text", () => {
    expect(roles("Draw three cards.")).toEqual(["draw"]); // Harmonize
    expect(roles("Whenever an opponent casts a spell, you may draw a card unless that player pays {1}.", "Enchantment")).toEqual(["draw"]);
    expect(roles("Cycling {2} ({2}, Discard this card: Draw a card.)", "Creature — Beast")).toEqual([]);
  });

  it("tells removal from sweepers", () => {
    expect(roles("Exile target creature. Its controller gains life equal to its power.")).toEqual(["removal"]); // Swords
    expect(roles("Destroy target permanent. Its controller creates a 3/3 green Beast creature token.")).toEqual(["removal"]);
    expect(roles("Lightning Bolt deals 3 damage to any target.")).toEqual(["removal"]);
    expect(roles("Return target nonland permanent you don't control to its owner's hand.")).toEqual(["removal"]);
    expect(roles("Destroy all creatures. They can't be regenerated.", "Sorcery")).toEqual(["wipe"]); // Wrath
    expect(roles("Blasphemous Act deals 13 damage to each creature.", "Sorcery")).toEqual(["wipe"]);
    expect(roles("Destroy each artifact, creature, and enchantment with mana value X or less.", "Enchantment")).toEqual(["wipe"]);
  });

  it("finds counterspells and tutors", () => {
    expect(roles("Counter target spell.")).toEqual(["counter"]);
    expect(roles("Search your library for a card, put that card into your hand, then shuffle.", "Sorcery")).toEqual(["tutor"]);
    expect(roles("Search your library for a creature card, reveal it, then shuffle and put the card on top.", "Sorcery")).toEqual(["tutor"]);
  });

  it("gives lands no roles, even fetchlands", () => {
    expect(
      roles("{T}, Pay 1 life, Sacrifice this land: Search your library for a Mountain or Forest card, put it onto the battlefield, then shuffle.", "Land"),
    ).toEqual([]);
    expect(roles("{T}: Add {C}.", "Land", ["C"])).toEqual([]);
  });

  it("returns nothing for a vanilla creature", () => {
    expect(roles("", "Creature — Bear")).toEqual([]);
  });
});

describe("roleCounts", () => {
  it("adds up the copies of the played cards", () => {
    expect(
      roleCounts([
        { board: "main", quantity: 2, roles: ["ramp", "draw"] },
        { board: "commander", quantity: 1, roles: ["draw"] },
        { board: "side", quantity: 5, roles: ["removal"] },
      ]),
    ).toMatchObject({ ramp: 2, draw: 3, removal: 0 });
  });
});
