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

export const CONDITIONS = ["MT", "NM", "EX", "GD", "LP", "PL", "PO"] as const;

export const FINISH_LABELS = { nonfoil: "Normal", foil: "Foil", etched: "Etched" } as const;
