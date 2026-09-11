/**
 * Lowercases and strips diacritics so "Relámpago" and "relampago" match.
 * Stored in `search_name` columns and applied to queries before trigram matching.
 */
export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
