import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { catalogCards, collections, items, sets } from "@/db/schema";
import { unitPriceEurSql } from "@/lib/collection/pricing";
import type { CatalogGameId, SetTypeFilter } from "@/lib/games";

/** Every set with cards, newest first — for pickers such as the scanner's fixed-set mode. */
export async function setOptions() {
  const result = await db.execute<{ game: CatalogGameId; code: string; name: string }>(sql`
    select game, code, name
    from sets
    where card_count > 0
    order by released_at desc nulls last, name
  `);
  return result.rows;
}

export async function catalogStats() {
  const result = await db.execute<{ game: CatalogGameId; cards: number; sets: number }>(sql`
    select game, count(*)::int as cards, count(distinct set_code)::int as sets
    from catalog_cards
    group by game
  `);
  return result.rows;
}

// Types, not interfaces: db.execute<T> needs T assignable to Record<string, unknown>.
export type SetSummary = {
  code: string;
  name: string;
  setType: string | null;
  releasedAt: string | null;
  iconUri: string | null;
  cardCount: number;
  /** Distinct printings of this set the user has, in any collection. */
  ownedDistinct: number;
  ownedCopies: number;
  ownedValue: number;
};

function list(values: string[]) {
  return sql.join(
    values.map((v) => sql`${v}`),
    sql`, `,
  );
}

/** Sets of a game with the user's progress on each, newest first. */
export async function listSets(
  game: CatalogGameId,
  ownerId: string,
  opts: { types?: SetTypeFilter | null; onlyOwned?: boolean; code?: string } = {},
): Promise<SetSummary[]> {
  const filters: SQL[] = [sql`${sets.game} = ${game}`, sql`${sets.cardCount} > 0`];
  if (opts.code) filters.push(sql`lower(${sets.code}) = lower(${opts.code})`);
  if (opts.types && "include" in opts.types) {
    filters.push(sql`${sets.setType} in (${list(opts.types.include)})`);
  }
  if (opts.types && "exclude" in opts.types) {
    filters.push(sql`(${sets.setType} is null or ${sets.setType} not in (${list(opts.types.exclude)}))`);
  }
  if (opts.onlyOwned) filters.push(sql`owned.set_code is not null`);

  const result = await db.execute<SetSummary>(sql`
    with owned as (
      select ${catalogCards.setCode} as set_code,
             count(distinct ${catalogCards.id})::int as distinct_cards,
             sum(${items.quantity})::int as copies,
             coalesce(sum(${items.quantity} * ${unitPriceEurSql}), 0)::float8 as value
      from ${items}
      join ${collections} on ${collections.id} = ${items.collectionId}
      join ${catalogCards} on ${catalogCards.id} = ${items.catalogCardId}
      where ${collections.ownerId} = ${ownerId} and ${catalogCards.game} = ${game}
      group by ${catalogCards.setCode}
    )
    select ${sets.code} as code,
           ${sets.name} as name,
           ${sets.setType} as "setType",
           ${sets.releasedAt}::text as "releasedAt",
           ${sets.iconUri} as "iconUri",
           ${sets.cardCount} as "cardCount",
           coalesce(owned.distinct_cards, 0) as "ownedDistinct",
           coalesce(owned.copies, 0) as "ownedCopies",
           coalesce(owned.value, 0) as "ownedValue"
    from ${sets}
    left join owned on owned.set_code = ${sets.code}
    where ${sql.join(filters, sql` and `)}
    order by ${sets.releasedAt} desc nulls last, ${sets.name}
  `);
  return result.rows;
}

export type SetCard = {
  id: string;
  name: string;
  collectorNumber: string;
  rarity: string | null;
  finishes: string[];
  imageSmall: string | null;
  imageNormal: string | null;
  priceEur: number | null;
  priceEurFoil: number | null;
  /** Copies the user has across all collections. */
  owned: number;
};

/** Every card of a set in collector-number order, with how many copies the user has. */
export async function listSetCards(game: CatalogGameId, setCode: string, ownerId: string) {
  const result = await db.execute<SetCard>(sql`
    select c.id, c.name, c.collector_number as "collectorNumber", c.rarity, c.finishes,
           c.image_small as "imageSmall", c.image_normal as "imageNormal",
           c.price_eur::float8 as "priceEur", c.price_eur_foil::float8 as "priceEurFoil",
           coalesce(o.qty, 0)::int as owned
    from catalog_cards c
    left join (
      select i.catalog_card_id, sum(i.quantity) as qty
      from items i
      join collections col on col.id = i.collection_id
      where col.owner_id = ${ownerId}
      group by i.catalog_card_id
    ) o on o.catalog_card_id = c.id
    where c.game = ${game} and c.set_code = ${setCode}
    -- "12a", "★1" and friends: numeric prefix first, then the raw string.
    order by nullif(substring(c.collector_number from '^[0-9]+'), '')::int nulls last,
             c.collector_number
  `);
  return result.rows;
}
