import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { catalogCards, collections, items } from "@/db/schema";
import { unitPriceEurSql } from "@/lib/collection/pricing";

/**
 * Records the day's prices for every printing the user owns, and the value of every
 * collection. Idempotent: re-running on the same date overwrites that date's snapshot.
 *
 * @param date YYYY-MM-DD — the date of the price data, not of the run.
 */
export async function snapshotPrices(date: string) {
  const prices = await db.execute(sql`
    insert into price_snapshots (catalog_card_id, date, eur, eur_foil, usd, usd_foil)
    select c.id, ${date}::date, c.price_eur, c.price_eur_foil, c.price_usd, c.price_usd_foil
    from catalog_cards c
    where exists (select 1 from items i where i.catalog_card_id = c.id)
    on conflict (catalog_card_id, date) do update set
      eur = excluded.eur, eur_foil = excluded.eur_foil,
      usd = excluded.usd, usd_foil = excluded.usd_foil
  `);

  const values = await db.execute(sql`
    insert into collection_value_snapshots (collection_id, date, value_eur, card_count, unpriced_count)
    select
      ${collections.id},
      ${date}::date,
      coalesce(sum(${items.quantity} * ${unitPriceEurSql}), 0),
      coalesce(sum(${items.quantity}), 0),
      coalesce(sum(${items.quantity}) filter (where ${unitPriceEurSql} is null), 0)
    from ${collections}
    left join ${items} on ${items.collectionId} = ${collections.id}
    left join ${catalogCards} on ${catalogCards.id} = ${items.catalogCardId}
    group by ${collections.id}
    on conflict (collection_id, date) do update set
      value_eur = excluded.value_eur,
      card_count = excluded.card_count,
      unpriced_count = excluded.unpriced_count
  `);

  return { printings: prices.rowCount ?? 0, collections: values.rowCount ?? 0 };
}
