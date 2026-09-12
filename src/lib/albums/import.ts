import { refreshSetCounts, upsertCatalogCards, upsertSets } from "@/lib/catalog/upsert";
import type { CatalogCardRow } from "@/lib/scryfall/map";
import { normalizeForSearch } from "@/lib/search/normalize";
import { parseCromosRepesList, toAlbumCards, type AlbumConfig } from "./cromosrepes";

/** An album's data file, data/albums/<album>.json (D29). */
export type AlbumMeta = AlbumConfig & {
  /** The set code in the catalog, unique among football albums: "megacracks-2526". */
  code: string;
  name: string;
  /** Product line, for the catalog tabs: "megacracks", "adrenalyn"… (see games.ts). */
  setType: string;
  publisher?: string;
  /** Where the checklist came from. */
  source?: string;
};

/**
 * Puts a football album and its cards in the catalog (game "sports"). Idempotent: running it
 * again updates names, series and dates, matching cards by album and collector number.
 */
export async function importAlbum(meta: AlbumMeta, checklist: string) {
  const cards = toAlbumCards(parseCromosRepesList(checklist), meta);
  if (!cards.length) {
    throw new Error("La lista no tiene cartas: ¿es el texto de la página «marcar faltas»?");
  }

  await upsertSets([
    { game: "sports", code: meta.code, name: meta.name, setType: meta.setType, releasedAt: meta.releasedAt },
  ]);
  const rows: CatalogCardRow[] = cards.map((c) => ({
    game: "sports",
    externalId: `${meta.code}:${c.collectorNumber}`,
    // Every card of the same player (or crest) together, like Pokémon's names (D19).
    oracleId: `sports:${normalizeForSearch(c.name)}`,
    name: c.name,
    searchName: normalizeForSearch(c.name),
    setCode: meta.code,
    collectorNumber: c.collectorNumber,
    rarity: c.rarity,
    typeLine: c.team,
    finishes: ["nonfoil"],
    releasedAt: c.releasedAt,
  }));
  for (let i = 0; i < rows.length; i += 500) await upsertCatalogCards(rows.slice(i, i + 500));
  await refreshSetCounts();

  const bySeries = new Map<string, number>();
  for (const c of cards) bySeries.set(c.rarity, (bySeries.get(c.rarity) ?? 0) + 1);
  return { cards: cards.length, bySeries: Object.fromEntries(bySeries) };
}
