import { describe, expect, it } from "vitest";
import { toLine } from "./lines";

describe("toLine", () => {
  it("joins cells, keeping empty ones in between and dropping them at the end", () => {
    expect(toLine([1, "Sol Ring", "", "{1}", "", null, undefined])).toBe("1 | Sol Ring |  | {1}");
  });

  it("keeps a row on one line and its cells apart", () => {
    expect(toLine(["Draw a card.\nScry 1.", "Fire | Ice"])).toBe("Draw a card. / Scry 1. | Fire / Ice");
  });

  it("writes numbers as they are", () => {
    expect(toLine([0, 12.5])).toBe("0 | 12.5");
  });
});
