import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { catalogCards, items, user } from "@/db/schema";
import { itemValueEurSql } from "@/lib/collection/pricing";

/**
 * Records the day's prices for every printing someone owns, and the value of each user's
 * inventory. Idempotent: re-running on the same date overwrites that date's snapshot.
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
    insert into inventory_value_snapshots (owner_id, date, value_eur, card_count, unpriced_count)
    select
      ${user.id},
      ${date}::date,
      coalesce(sum(${items.quantity} * ${itemValueEurSql}), 0),
      coalesce(sum(${items.quantity}), 0),
      coalesce(sum(${items.quantity}) filter (where ${items.id} is not null and ${itemValueEurSql} is null), 0)
    from ${user}
    left join ${items} on ${items.ownerId} = ${user.id}
    left join ${catalogCards} on ${catalogCards.id} = ${items.catalogCardId}
    group by ${user.id}
    on conflict (owner_id, date) do update set
      value_eur = excluded.value_eur,
      card_count = excluded.card_count,
      unpriced_count = excluded.unpriced_count
  `);

  return { printings: prices.rowCount ?? 0, owners: values.rowCount ?? 0 };
}
