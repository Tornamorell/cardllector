const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const int = new Intl.NumberFormat("es-ES");

export function formatEur(value: number | null | undefined): string {
  return value == null ? "—" : eur.format(value);
}

export function formatInt(value: number): string {
  return int.format(value);
}

/** "Caja 1 › 3": a location and, if any, the divider inside it (D28). */
export function placeLabel(location: string | null | undefined, section?: string | null): string | null {
  if (!location) return null;
  return section ? `${location} › ${section}` : location;
}

export const LANGUAGES: Record<string, string> = {
  es: "Español",
  en: "Inglés",
  fr: "Francés",
  de: "Alemán",
  it: "Italiano",
  pt: "Portugués",
  ja: "Japonés",
  ko: "Coreano",
  ru: "Ruso",
  zhs: "Chino simp.",
  zht: "Chino trad.",
};

/** Flags for the card languages above. English uses the UK flag, as on Cardmarket. */
export const LANGUAGE_FLAGS: Record<string, string> = {
  es: "🇪🇸",
  en: "🇬🇧",
  fr: "🇫🇷",
  de: "🇩🇪",
  it: "🇮🇹",
  pt: "🇵🇹",
  ja: "🇯🇵",
  ko: "🇰🇷",
  ru: "🇷🇺",
  zhs: "🇨🇳",
  zht: "🇹🇼",
};

export const CONDITIONS = ["MT", "NM", "EX", "GD", "LP", "PL", "PO"] as const;
export type Condition = (typeof CONDITIONS)[number];

/** Cardmarket's names for each condition, in English like collectors use them (D21). */
export const CONDITION_NAMES: Record<Condition, string> = {
  MT: "Mint",
  NM: "Near Mint",
  EX: "Excellent",
  GD: "Good",
  LP: "Light Played",
  PL: "Played",
  PO: "Poor",
};

export const FINISH_LABELS = { nonfoil: "Normal", foil: "Foil", etched: "Etched" } as const;
