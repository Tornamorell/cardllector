import { describe, expect, it } from "vitest";
import { MAX_TURN_CHARS, titleFrom, toApiMessages, type ChatTurn } from "./history";

describe("titleFrom", () => {
  it("names a conversation by its first question, on one line", () => {
    expect(titleFrom("  ¿Qué le falta\na este mazo?  ")).toBe("¿Qué le falta a este mazo?");
    expect(titleFrom("x".repeat(100))).toBe(`${"x".repeat(79)}…`);
    expect(titleFrom("   ")).toBe("Conversación");
  });
});

describe("toApiMessages", () => {
  it("drops empty turns and joins the same speaker's", () => {
    const turns: ChatTurn[] = [
      { role: "user", content: "¿Cuánto vale" },
      { role: "user", content: "mi colección?" },
      { role: "assistant", content: "  " },
      { role: "assistant", content: "Unos 300 €." },
    ];
    expect(toApiMessages(turns)).toEqual([
      { role: "user", content: "¿Cuánto vale\n\nmi colección?" },
      { role: "assistant", content: "Unos 300 €." },
    ]);
  });

  it("keeps the recent turns, starting with a question", () => {
    const turns: ChatTurn[] = Array.from({ length: 7 }, (_, i) => ({
      role: i % 2 ? "assistant" : "user",
      content: `t${i}`,
    }));
    // The last 4 would start with an answer (t3): it goes too.
    expect(toApiMessages(turns, 4).map((t) => t.content)).toEqual(["t4", "t5", "t6"]);
  });

  it("cuts a runaway turn", () => {
    const [t] = toApiMessages([{ role: "user", content: "x".repeat(MAX_TURN_CHARS + 50) }]);
    expect(t.content).toHaveLength(MAX_TURN_CHARS);
  });

  it("doesn't touch what it's given", () => {
    const turns: ChatTurn[] = [
      { role: "user", content: "a" },
      { role: "user", content: "b" },
    ];
    toApiMessages(turns);
    expect(turns[0].content).toBe("a");
  });
});
