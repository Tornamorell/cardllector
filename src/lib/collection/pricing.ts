import { sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { catalogCards, items } from "@/db/schema";

type Finish = (typeof items.$inferSelect)["finish"];

interface PricedCard {
  priceEur: number | null;
  priceEurFoil: number | null;
}

/**
 * Unit price in EUR (Cardmarket, via Scryfall) for a copy with the given finish.
 * Scryfall has no EUR price for etched foils, so those stay unpriced.
 * Keep in sync with unitPriceEurSql below.
 */
export function unitPriceEur(finish: Finish, card: PricedCard | null): number | null {
  if (!card) return null;
  if (finish === "nonfoil") return card.priceEur;
  if (finish === "foil") return card.priceEurFoil;
  return null;
}

/**
 * SQL twin of unitPriceEur() over any pair of price columns: today's catalog prices, or a
 * day's row in price_snapshots.
 */
export function unitPriceSql(
  finish: SQLWrapper,
  eur: SQLWrapper,
  eurFoil: SQLWrapper,
): SQL<number | null> {
  return sql`(case ${finish} when 'nonfoil' then ${eur} when 'foil' then ${eurFoil} end)`;
}

/** Today's unit price of each stack, for queries over items joined to catalog_cards. */
export const unitPriceEurSql = unitPriceSql(
  items.finish,
  catalogCards.priceEur,
  catalogCards.priceEurFoil,
);

export interface StackValue {
  valueEur: number;
  cardCount: number;
  /** Copies with no known price. Reported separately instead of counted as zero. */
  unpricedCount: number;
}

export function sumValue(
  stacks: Array<{ quantity: number; finish: Finish; card: PricedCard | null }>,
): StackValue {
  let valueEur = 0;
  let cardCount = 0;
  let unpricedCount = 0;
  for (const s of stacks) {
    cardCount += s.quantity;
    const unit = unitPriceEur(s.finish, s.card);
    if (unit == null) unpricedCount += s.quantity;
    else valueEur += unit * s.quantity;
  }
  return { valueEur: Math.round(valueEur * 100) / 100, cardCount, unpricedCount };
}
