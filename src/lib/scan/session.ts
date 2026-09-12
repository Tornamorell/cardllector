import type { ScanMatch } from "@/lib/queries/scan";

export type Finish = "nonfoil" | "foil" | "etched";

/** One line of the scanner's session history: copies of a printing added in a row. */
export type SessionEntry = {
  key: string;
  /** The stack the copies went into: the −/+ buttons and "add the session to a collection" use it. */
  itemId: string;
  match: ScanMatch;
  lang: string | null;
  count: number;
  finish: Finish;
  /** When it was first added (ms since epoch). */
  addedAt: number;
};

/** What one copy is worth: the price for its finish when it was read. Etched has none (D12). */
export function entryUnitPrice(e: Pick<SessionEntry, "match" | "finish">): number | null {
  if (e.finish === "nonfoil") return e.match.priceEur;
  if (e.finish === "foil") return e.match.priceEurFoil;
  return null;
}

/** The session's running total. Copies without a price are counted apart, not as zero. */
export function sessionTotals(entries: SessionEntry[]) {
  let cards = 0;
  let valueEur = 0;
  let unpriced = 0;
  for (const e of entries) {
    cards += e.count;
    const unit = entryUnitPrice(e);
    if (unit == null) unpriced += e.count;
    else valueEur += unit * e.count;
  }
  return { cards, valueEur: Math.round(valueEur * 100) / 100, unpriced };
}
