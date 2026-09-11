/**
 * Parsing of the OCR'd info strip in a card's bottom-left corner. Pure functions; the
 * catalog lookup that validates the result lives in src/lib/queries/scan.ts.
 *
 * What the strip looks like (see docs/scanner.md):
 *   Magic 2023+    "U 0001"     / "MKM • EN  ✎ Artist"
 *   Magic 2014-22  "001/280 C"  / "M20 • EN  ✎ Artist"
 *   Pokémon SV+    "G [PAL EN] 001/193 ●"
 *   Pokémon older  "F 001/195 ●"            (no set code: resolved via the printed total)
 */

const LANGS: Record<string, string> = {
  EN: "en",
  ES: "es",
  SP: "es",
  FR: "fr",
  DE: "de",
  IT: "it",
  PT: "pt",
  JA: "ja",
  JP: "ja",
  KO: "ko",
  KR: "ko",
  RU: "ru",
  ZHS: "zhs",
  ZHT: "zht",
  CS: "zhs",
  CT: "zht",
};

export interface CollectorLine {
  /** As printed: "0001", "107", "001". */
  number: string;
  /** The total after the slash, when printed. */
  total: string | null;
  /** Possible set codes, most likely first. Validated against the catalog. */
  setCodes: string[];
  /** Our language code, when the card prints one ("EN", "ES"…). */
  lang: string | null;
}

const isCode = (t: string) => /^[A-Z0-9]{3,5}$/.test(t) && /[A-Z]/.test(t);

export function parseCollectorLine(raw: string): CollectorLine | null {
  const text = raw
    .toUpperCase()
    .replace(/[•·∙●*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = text.split(" ");

  const codes: string[] = [];
  let lang: string | null = null;

  // "MKM EN", "PAL EN": a code right before a language code.
  for (let i = 1; i < tokens.length; i++) {
    if (LANGS[tokens[i]] && isCode(tokens[i - 1])) {
      lang ??= LANGS[tokens[i]];
      codes.push(tokens[i - 1]);
    }
  }

  let number: string | null = null;
  let total: string | null = null;
  const withTotal = /(\d{1,4}) ?\/ ?(\d{2,4})/.exec(text);
  if (withTotal) {
    number = withTotal[1];
    total = withTotal[2];
    // "PAL 001/193": a code right before the number.
    const before = text.slice(0, withTotal.index).trim().split(" ").pop();
    if (before && isCode(before)) codes.push(before);
  } else if (codes.length) {
    // "U 0001" (Magic 2023+) only counts when a set code was read too — a lone number is noise.
    number = /\b(\d{3,4})\b/.exec(text)?.[1] ?? null;
  }
  if (!number) return null;

  // OCR often glues a stray glyph in front of a code ("BPAL" for "PAL"): try its tails too.
  const setCodes = [...new Set(codes.flatMap((c) => [c, c.slice(-4), c.slice(-3)]))].filter(isCode);

  return { number, total, setCodes, lang };
}

/** Collector-number spellings to try: "0001" → "0001", "1", "001". */
export function numberVariants(number: string): string[] {
  const stripped = number.replace(/^0+(?=\d)/, "");
  return [...new Set([number, stripped, stripped.padStart(3, "0")])];
}

/** Two reads describe the same card (used to require consecutive agreement). */
export function sameLine(a: CollectorLine | null, b: CollectorLine | null): boolean {
  return (
    !!a &&
    !!b &&
    numberVariants(a.number)[1] === numberVariants(b.number)[1] &&
    a.total === b.total &&
    a.setCodes[0] === b.setCodes[0]
  );
}
