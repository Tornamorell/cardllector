import { describe, expect, it } from "vitest";
import { parsePrintingQuery } from "./printing-query";

describe("parsePrintingQuery", () => {
  it("reads a set code and a number", () => {
    expect(parsePrintingQuery("OBF 125")).toEqual({ numbers: ["125"], total: null, words: ["obf"] });
    expect(parsePrintingQuery("m10 #146")).toEqual({ numbers: ["146"], total: null, words: ["m10"] });
  });

  it("reads a number with the printed total", () => {
    expect(parsePrintingQuery("125/197")).toEqual({ numbers: ["125"], total: 197, words: [] });
    expect(parsePrintingQuery("001/165")).toEqual({ numbers: ["001", "1"], total: 165, words: [] });
  });

  it("reads part of the name and a number", () => {
    expect(parsePrintingQuery("Charizard ex 125")).toEqual({
      numbers: ["125"],
      total: null,
      words: ["charizard", "ex"],
    });
  });

  it("keeps only the first number; later ones are words", () => {
    expect(parsePrintingQuery("mew 151 2")?.words).toEqual(["mew", "2"]);
  });

  it("ignores plain name searches and bare numbers", () => {
    expect(parsePrintingQuery("charizard ex")).toBeNull();
    expect(parsePrintingQuery("Relámpago")).toBeNull();
    expect(parsePrintingQuery("125")).toBeNull();
    expect(parsePrintingQuery("")).toBeNull();
  });
});
