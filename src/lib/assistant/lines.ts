// Tool results as lines of cells rather than JSON objects (D37): the model reads the column
// names once instead of every key on every row. A deck's hundred cards as objects took ~12,000
// tokens, mostly repeated keys. Pure.

/**
 * One row: cells joined with " | ". Empty cells in between stay (they're columns); empty ones at
 * the end are dropped. Line breaks and pipes inside a cell are flattened so a row stays a row.
 */
export function toLine(cells: Array<string | number | null | undefined>): string {
  const out = cells.map((c) => (c == null ? "" : String(c).replace(/\s*\n\s*/g, " / ").replace(/\|/g, "/")));
  while (out.length && out[out.length - 1] === "") out.pop();
  return out.join(" | ");
}
