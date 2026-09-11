import { describe, expect, it } from "vitest";
import { normalizeForSearch } from "./normalize";

describe("normalizeForSearch", () => {
  it("strips accents and lowercases", () => {
    expect(normalizeForSearch("Relámpago Ígneo")).toBe("relampago igneo");
  });

  it("keeps ñ as n and collapses whitespace", () => {
    expect(normalizeForSearch("  Señor   de  la Guerra ")).toBe("senor de la guerra");
  });

  it("leaves punctuation used in card names", () => {
    expect(normalizeForSearch("Jace, the Mind Sculptor")).toBe("jace, the mind sculptor");
  });
});
