import { numberVariants } from "@/lib/scan/parse";
import { normalizeForSearch } from "./normalize";

export type PrintingQuery = {
  /** Spellings of the collector number to try ("001" → "001", "1"). */
  numbers: string[];
  /** The printed total, from "125/197". */
  total: number | null;
  /** The other words: each must be the set code or part of the card's name. */
  words: string[];
};

const NUMBER = /^#?(\d{1,4}[a-z]?)(?:\/(\d{1,4}))?$/;

/**
 * A typed search that names a printing rather than a card: a collector number plus a set code,
 * the printed total or part of the name — "obf 125", "125/197", "charizard 125", "m10 #146".
 * Returns null for anything else (a plain name search, or a bare number, which is too vague).
 */
export function parsePrintingQuery(query: string): PrintingQuery | null {
  let number: string | null = null;
  let total: number | null = null;
  const words: string[] = [];
  for (const token of normalizeForSearch(query).split(" ").filter(Boolean)) {
    const match: RegExpExecArray | null = number ? null : NUMBER.exec(token);
    if (match) {
      number = match[1];
      total = match[2] ? Number(match[2]) : null;
    } else {
      words.push(token);
    }
  }
  if (!number || (total == null && !words.length)) return null;
  return { numbers: numberVariants(number), total, words };
}
