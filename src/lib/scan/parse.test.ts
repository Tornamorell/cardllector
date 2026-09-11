import { describe, expect, it } from "vitest";
import { numberVariants, parseCollectorLine, sameLine } from "./parse";

// Inputs are real Tesseract outputs on card scans (2026-09-11, see docs/scanner.md),
// with "⏎" where Tesseract returned a line break.
const ocr = (s: string) => s.replaceAll("⏎", "\n");

describe("parseCollectorLine", () => {
  it("reads a 2014–2022 Magic frame: number/total and set code + language", () => {
    expect(parseCollectorLine(ocr("107/281 M ⏎ DMU EN CHRIS RAHN ⏎"))).toEqual({
      number: "107",
      total: "281",
      setCodes: ["DMU"],
      lang: "en",
    });
    expect(parseCollectorLine(ocr("A ⏎ 001/280 C ⏎ M20 EN DAN SCOTT ⏎"))?.setCodes).toEqual(["M20"]);
  });

  it("reads a 2023+ Magic frame: 4-digit number without total", () => {
    expect(parseCollectorLine(ocr("EEA ⏎ U 0001 ⏎ MKM EN PETER POLACH ⏎"))).toEqual({
      number: "0001",
      total: null,
      setCodes: ["MKM"],
      lang: "en",
    });
  });

  it("reads the Spanish language code", () => {
    expect(parseCollectorLine("R 0123 WOE • ES ARTISTA")?.lang).toBe("es");
  });

  it("reads Pokémon number/total and tries the tails of a glued code", () => {
    expect(parseCollectorLine(ocr("H. Y B ⏎ BPAL 001/193 ⏎"))).toEqual({
      number: "001",
      total: "193",
      setCodes: ["BPAL", "PAL"],
      lang: null,
    });
  });

  it("keeps number/total when there's no set code (older Pokémon, resolved by total)", () => {
    expect(parseCollectorLine(ocr("M. S ⏎ F 001/195 ⏎"))).toEqual({
      number: "001",
      total: "195",
      setCodes: [],
      lang: null,
    });
  });

  it("rejects noise: no number/total and no set code", () => {
    expect(parseCollectorLine(ocr("OR T ⏎ C A C SCP TE RAN ⏎ 4 TN ES 5 ⏎ 7. 2009 X HT 2"))).toBeNull();
    expect(parseCollectorLine(ocr("11/NK J2 ⏎ B MW ⏎ 119971658203 ⏎"))).toBeNull();
    expect(parseCollectorLine("")).toBeNull();
  });
});

describe("numberVariants", () => {
  it("covers zero-padded and unpadded spellings", () => {
    expect(numberVariants("0001")).toEqual(["0001", "1", "001"]);
    expect(numberVariants("107")).toEqual(["107"]);
    expect(numberVariants("12a")).toEqual(["12a"]);
    expect(numberVariants("7")).toEqual(["7", "007"]);
  });
});

describe("sameLine", () => {
  it("treats 0001 and 001 of the same set as the same read", () => {
    const a = parseCollectorLine("U 0001 MKM EN");
    const b = parseCollectorLine("U 001 MKM EN");
    expect(sameLine(a, b)).toBe(true);
    expect(sameLine(a, parseCollectorLine("U 0002 MKM EN"))).toBe(false);
    expect(sameLine(a, null)).toBe(false);
  });
});
