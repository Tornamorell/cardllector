import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdown, safeHref } from "./markdown";

describe("parseInline", () => {
  it("reads bold, italics, code and links", () => {
    expect(parseInline("La **más cara** es *Sol Ring* (`C21 263`), en [tu mazo](/decks/abc).")).toEqual([
      { type: "text", text: "La " },
      { type: "strong", children: [{ type: "text", text: "más cara" }] },
      { type: "text", text: " es " },
      { type: "em", children: [{ type: "text", text: "Sol Ring" }] },
      { type: "text", text: " (" },
      { type: "code", text: "C21 263" },
      { type: "text", text: "), en " },
      { type: "link", href: "/decks/abc", children: [{ type: "text", text: "tu mazo" }] },
      { type: "text", text: "." },
    ]);
  });

  it("keeps a link off the app as plain text", () => {
    expect(parseInline("[Moxfield](https://moxfield.com)")).toEqual([{ type: "text", text: "Moxfield" }]);
  });

  it("leaves a lone asterisk alone", () => {
    expect(parseInline("2 * 3 = 6")).toEqual([{ type: "text", text: "2 * 3 = 6" }]);
  });
});

describe("safeHref", () => {
  it("allows the app's paths only", () => {
    expect(safeHref("/cards/81380ce2-a421?x=1")).toBe("/cards/81380ce2-a421?x=1");
    expect(safeHref("//evil.example")).toBeNull();
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("https://example.com")).toBeNull();
  });
});

describe("parseMarkdown", () => {
  it("splits headings, paragraphs and lists", () => {
    const blocks = parseMarkdown("## Resumen\nTienes 3 mazos\ny 2 colecciones.\n\n- uno\n- dos\n\n1. primero\n2. segundo");
    expect(blocks.map((b) => b.type)).toEqual(["heading", "paragraph", "list", "list"]);
    expect(blocks[1]).toEqual({ type: "paragraph", children: [{ type: "text", text: "Tienes 3 mazos y 2 colecciones." }] });
    expect(blocks[2]).toMatchObject({ ordered: false, items: [[{ text: "uno" }], [{ text: "dos" }]] });
    expect(blocks[3]).toMatchObject({ ordered: true });
  });

  it("reads a table", () => {
    const [table] = parseMarkdown("| Carta | Precio |\n|---|---:|\n| Sol Ring | 1,50 € |\n| **Pantlaza** | 15,37 € |");
    expect(table).toMatchObject({
      type: "table",
      head: [[{ text: "Carta" }], [{ text: "Precio" }]],
      rows: [
        [[{ text: "Sol Ring" }], [{ text: "1,50 €" }]],
        [[{ type: "strong" }], [{ text: "15,37 €" }]],
      ],
    });
  });

  it("copes with an answer still arriving", () => {
    expect(parseMarkdown("| Carta |")).toEqual([{ type: "paragraph", children: [{ type: "text", text: "| Carta |" }] }]);
    expect(parseMarkdown("Es **muy")).toEqual([{ type: "paragraph", children: [{ type: "text", text: "Es **muy" }] }]);
  });
});
