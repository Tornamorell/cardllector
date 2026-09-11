import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { type catalogCards, priceSnapshots } from "@/db/schema";
import { unitPriceSql } from "@/lib/collection/pricing";
import type { Finish } from "@/lib/games";

/** Periods of the value section on the dashboard; the key is the `?period=` value. */
export const VALUE_PERIODS = { "7": "7 días", "30": "30 días", "90": "90 días", all: "Todo" } as const;
export type ValuePeriod = keyof typeof VALUE_PERIODS;

export function parsePeriod(value: unknown): ValuePeriod {
  return typeof value === "string" && value in VALUE_PERIODS ? (value as ValuePeriod) : "30";
}

const periodDays = (period: ValuePeriod) => (period === "all" ? null : Number(period));
const round2 = (n: number) => Math.round(n * 100) / 100;

export type ValuePoint = {
  date: string;
  valueEur: number;
  cardCount: number;
  unpricedCount: number;
};

/**
 * What the whole inventory was worth each day, oldest first. It also moves when cards are
 * added or removed, not only when prices change (see priceMoves for the latter).
 */
export async function valueHistory(ownerId: string, period: ValuePeriod): Promise<ValuePoint[]> {
  const days = periodDays(period);
  const { rows } = await db.execute<ValuePoint>(sql`
    select date::text as "date", value_eur::float8 as "valueEur",
      card_count::int as "cardCount", unpriced_count::int as "unpricedCount"
    from inventory_value_snapshots
    where owner_id = ${ownerId}
    ${
      days == null
        ? sql``
        : sql`and date >= (
            select max(date) from inventory_value_snapshots where owner_id = ${ownerId}
          ) - ${days}::int`
    }
    order by date
  `);
  return rows;
}

type MoveRow = {
  id: string;
  finish: Finish;
  quantity: number;
  /** The day the "before" price is from. */
  fromDate: string;
  thenEur: number;
  nowEur: number;
  game: (typeof catalogCards.$inferSelect)["game"];
  name: string;
  setCode: string;
  collectorNumber: string;
  imageSmall: string | null;
};

export type PriceMove = MoveRow & {
  /** How much this changed the value of your copies: quantity × (now − then). */
  impact: number;
};

/**
 * How prices moved the value of what you own now, per printing and finish: the latest saved
 * price against the one from `period` days earlier (the first saved one for "all"). Cards
 * without a price that old are left out, so the result only reflects price changes, never
 * cards added or removed. Copies with an estimated value of their own (graded…) are left out
 * too: they don't follow the market (D27).
 */
export async function priceMoves(ownerId: string, period: ValuePeriod, limit = 5) {
  const days = periodDays(period);
  const thenPrice = unitPriceSql(sql`o.finish`, sql`b.eur`, sql`b.eur_foil`);
  const nowPrice = unitPriceSql(sql`o.finish`, sql`l.eur`, sql`l.eur_foil`);
  const { rows } = await db.execute<MoveRow>(sql`
    with owned as (
      select catalog_card_id, finish, sum(quantity)::int as qty
      from items
      where owner_id = ${ownerId} and catalog_card_id is not null
        and estimated_value_eur is null
      group by catalog_card_id, finish
    ),
    latest as (
      select distinct on (ps.catalog_card_id) ps.catalog_card_id, ps.date, ps.eur, ps.eur_foil
      from price_snapshots ps
      where ps.catalog_card_id in (select catalog_card_id from owned)
      order by ps.catalog_card_id, ps.date desc
    ),
    base as (
      select distinct on (ps.catalog_card_id) ps.catalog_card_id, ps.date, ps.eur, ps.eur_foil
      from price_snapshots ps
      join latest l on l.catalog_card_id = ps.catalog_card_id
      where ${days == null ? sql`ps.date < l.date` : sql`ps.date <= l.date - ${days}::int`}
      order by ps.catalog_card_id, ps.date ${days == null ? sql`asc` : sql`desc`}
    )
    select c.id, o.finish, o.qty as "quantity", b.date::text as "fromDate",
      ${thenPrice}::float8 as "thenEur", ${nowPrice}::float8 as "nowEur",
      c.game, c.name, c.set_code as "setCode", c.collector_number as "collectorNumber",
      c.image_small as "imageSmall"
    from owned o
    join latest l on l.catalog_card_id = o.catalog_card_id
    join base b on b.catalog_card_id = o.catalog_card_id
    join catalog_cards c on c.id = o.catalog_card_id
    where ${thenPrice} is not null and ${nowPrice} is not null
  `);

  const moves: PriceMove[] = rows.map((r) => ({
    ...r,
    impact: round2(r.quantity * (r.nowEur - r.thenEur)),
  }));
  return {
    up: moves
      .filter((m) => m.impact > 0)
      .sort((a, b) => b.impact - a.impact)
      .slice(0, limit),
    down: moves
      .filter((m) => m.impact < 0)
      .sort((a, b) => a.impact - b.impact)
      .slice(0, limit),
    totalImpact: round2(moves.reduce((sum, m) => sum + m.impact, 0)),
    /** Value of the compared copies at the earlier prices: the base for a percentage. */
    baseValue: round2(moves.reduce((sum, m) => sum + m.quantity * m.thenEur, 0)),
    fromDate: moves.reduce<string | null>((min, m) => (!min || m.fromDate < min ? m.fromDate : min), null),
    compared: moves.length,
  };
}

export type PriceMoves = Awaited<ReturnType<typeof priceMoves>>;

/** Saved daily prices of a printing, oldest first. Only printings someone owns have them (D11). */
export async function priceHistory(printingId: string) {
  return db
    .select({ date: priceSnapshots.date, eur: priceSnapshots.eur, eurFoil: priceSnapshots.eurFoil })
    .from(priceSnapshots)
    .where(eq(priceSnapshots.catalogCardId, printingId))
    .orderBy(asc(priceSnapshots.date));
}
