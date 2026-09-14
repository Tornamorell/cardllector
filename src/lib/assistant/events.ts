// What /api/assistant streams to the chat (D37): one JSON object per line.

export type ChatEvent =
  /** First: the conversation the answer is saved in (a new one gets its id here). */
  | { type: "thread"; id: string; title: string }
  /** It's looking something up: `tool` is the tool's name. */
  | { type: "tool"; tool: string }
  /** More of the answer. */
  | { type: "text"; text: string }
  | { type: "error"; message: string }
  /** The answer is complete: what it cost and what's left of the month's allowance. */
  | { type: "done"; costUsd: number; remainingUsd: number };

/** What the chat says while each tool runs. */
export const TOOL_LABELS: Record<string, string> = {
  overview: "Mirando tu resumen",
  search_my_cards: "Buscando en tus cartas",
  find_owned_magic_cards: "Buscando cartas tuyas que encajen",
  get_collection: "Abriendo la colección",
  get_deck: "Analizando el mazo",
  value_report: "Mirando la evolución del valor",
  search_catalog: "Buscando en el catálogo",
};
