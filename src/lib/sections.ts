import type { SectionOption } from "@/lib/queries/locations";

// Pure helpers for dividers inside a location (D28), shared by the pickers.

/** "87/100", or just the count for a divider without limit. */
export const sectionFill = (s: SectionOption) =>
  s.capacity ? `${s.count}/${s.capacity}` : String(s.count);

/** Where new copies go by default: the last divider with cards in it, else the first. */
export function currentSectionId(sections: SectionOption[]): string | null {
  const withCards = sections.filter((s) => s.count > 0);
  return (withCards.at(-1) ?? sections[0])?.id ?? null;
}
