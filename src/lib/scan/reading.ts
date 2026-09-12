// Identifying a card from a photo with Claude (D31): the pure parts. The API call is in
// identify.ts, the catalog lookup in queries/scan.ts.

/** The only model that got both the player and the series right in the test (D31). */
export const IDENTIFY_MODEL = "claude-sonnet-5";

/** Its price in $ per million tokens (platform.claude.com/docs/en/about-claude/pricing, 2026-09-12). */
export const IDENTIFY_PRICE = { input: 2, output: 10 };

/** What the model read on the card. */
export type CardReading = {
  isCard: boolean;
  /** As printed, in the card's language. */
  name: string;
  team: string | null;
  /** As printed: "123/280", "0001", "88". */
  number: string | null;
  /** Magic and Pokémon, when printed near the number. */
  setCode: string | null;
  /** Football albums: one of the album's series, as labelled in games.ts. */
  series: string | null;
};

/** What the model is told about the fixed set, if there is one. */
export type IdentifyContext = {
  game: string | null;
  setName: string | null;
  /** A football album's series (labels), for the model to choose from. Empty otherwise. */
  series: string[];
};

export function identifyCostUsd(usage: { input_tokens: number; output_tokens: number }) {
  return (usage.input_tokens * IDENTIFY_PRICE.input + usage.output_tokens * IDENTIFY_PRICE.output) / 1e6;
}

/** "123/280" → 123 of 280; "#88" and "Nº 88" → 88. Null when there's no number in it. */
export function splitNumber(printed: string): { number: string; total: string | null } | null {
  const [number, total] = printed
    .trim()
    .replace(/^(#|n[º°o.]*\s)\s*/i, "")
    .split("/")
    .map((s) => s.trim());
  if (!number || !/\d/.test(number)) return null;
  return { number, total: total && /\d/.test(total) ? total : null };
}

/**
 * The cards of the series the model saw, first; the rest after, never dropped: the series is
 * the least reliable part of a reading (Élite and Élite Power differ by one small word).
 */
export function seriesFirst<T extends { rarity: string | null }>(cards: T[], series: string | null): T[] {
  if (!series) return cards;
  const s = series.toLowerCase();
  const same = (c: T) => c.rarity?.toLowerCase() === s;
  return [...cards.filter(same), ...cards.filter((c) => !same(c))];
}
