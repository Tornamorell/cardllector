import { describe, expect, it } from "vitest";
import { parsePagePath, suggestionsFor } from "./page";

const ID = "8ECB0F4E-1ec1-4798-98e3-a3fa5fae4f60";

describe("parsePagePath", () => {
  it("reads the pages about one thing", () => {
    expect(parsePagePath(`/decks/${ID}`)).toEqual({ kind: "deck", id: ID.toLowerCase() });
    expect(parsePagePath(`/collections/${ID}?filter=missing`)).toEqual({ kind: "collection", id: ID.toLowerCase() });
    expect(parsePagePath(`/cards/${ID}/`)).toEqual({ kind: "card", id: ID.toLowerCase() });
    expect(parsePagePath("/locations/none")).toEqual({ kind: "location", id: "none" });
  });

  it("reads the catalog's sets and games", () => {
    expect(parsePagePath("/catalog/pokemon/sv03.5")).toEqual({ kind: "set", gameSlug: "pokemon", setCode: "sv03.5" });
    expect(parsePagePath("/catalog/magic")).toEqual({ kind: "game", gameSlug: "magic" });
  });

  it("reads the lists, and nothing else", () => {
    expect(parsePagePath("/")).toEqual({ kind: "home" });
    expect(parsePagePath("/inventory?loc=none")).toEqual({ kind: "inventory" });
    expect(parsePagePath("/decks/not-an-id")).toBeNull();
    expect(parsePagePath("/admin")).toBeNull();
    expect(parsePagePath("/catalog/magic/%E0%A4%A")).toBeNull();
  });
});

describe("suggestionsFor", () => {
  it("asks about what's on screen", () => {
    expect(suggestionsFor({ kind: "deck", id: "x" })[0]).toBe("¿Qué le falta a este mazo?");
    expect(suggestionsFor(null)).toHaveLength(4);
  });
});
