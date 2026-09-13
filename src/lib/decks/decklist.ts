// Deck lists as text (D35), the way Moxfield and MTG Arena export them:
//
//   Commander
//   1 Atraxa, Praetors' Voice (C16) 28
//
//   Deck
//   1 Sol Ring (C21) 263 *F*
//   30 Island
//
// Headers name the board; lines are "[quantity[x]] name [(SET) number] [*F*]". Pure: parsed on
// import, written on export.

export const BOARDS = ["commander", "main", "side", "maybe"] as const;
export type Board = (typeof BOARDS)[number];

export const BOARD_LABELS: Record<Board, string> = {
  commander: "Comandante",
  main: "Mazo",
  side: "Banquillo",
  maybe: "Quizá",
};

/** The header each board is written under; Moxfield and Arena read them back. */
const EXPORT_HEADERS: Record<Board, string> = {
  commander: "Commander",
  main: "Deck",
  side: "Sideboard",
  maybe: "Maybeboard",
};

const HEADERS: Array<[RegExp, Board | null]> = [
  [/^(commanders?|comandantes?)$/i, "commander"],
  [/^(deck|main|mainboard|mazo|mazo principal)$/i, "main"],
  [/^(sideboard|side|banquillo|companion)$/i, "side"],
  [/^(maybe|maybeboard|considering|quiz[aá])$/i, "maybe"],
  // Arena's "About" block names the deck: no cards in it.
  [/^about$/i, null],
];

const LINE = /^(?:(\d+)\s*[xX]?\s+)?(.+?)(?:\s+\(([A-Za-z0-9]{2,6})\)(?:\s+(\S+?))?)?((?:\s+\*[A-Z]\*)*)$/;

export type DecklistLine = {
  board: Board;
  quantity: number;
  name: string;
  /** The printing, when the line names it: "(C21) 263". Lowercased like our set codes. */
  setCode: string | null;
  collectorNumber: string | null;
  foil: boolean;
};

/** The lines of a list; the same card twice on a board adds up. `unreadable` lines are shown back. */
export function parseDecklist(text: string): { lines: DecklistLine[]; unreadable: string[] } {
  const byKey = new Map<string, DecklistLine>();
  const unreadable: string[] = [];
  let board: Board | null = "main";
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const bare = line.replace(/^\/\/\s*/, "").replace(/:$/, "").trim();
    const header = HEADERS.find(([re]) => re.test(bare));
    if (header) {
      board = header[1];
      continue;
    }
    if (board === null || line.startsWith("//") || line.startsWith("#")) continue;
    const m = LINE.exec(line);
    const quantity = Number(m?.[1] ?? 1);
    if (!m || !m[2] || quantity < 1) {
      unreadable.push(line);
      continue;
    }
    const name = m[2].trim();
    const key = `${board}|${name.toLowerCase()}`;
    const seen = byKey.get(key);
    if (seen) {
      seen.quantity += quantity;
      continue;
    }
    byKey.set(key, {
      board,
      quantity,
      name,
      setCode: m[3]?.toLowerCase() ?? null,
      collectorNumber: m[4] ?? null,
      foil: /\*[FE]\*/.test(m[5] ?? ""),
    });
  }
  return { lines: [...byKey.values()], unreadable };
}

export type ExportCard = {
  board: Board;
  quantity: number;
  name: string;
  setCode?: string | null;
  collectorNumber?: string | null;
};

/** A deck as text, board by board, with each card's printing when known. */
export function formatDecklist(cards: ExportCard[]): string {
  return BOARDS.flatMap((board) => {
    const rows = cards.filter((c) => c.board === board);
    if (!rows.length) return [];
    const lines = rows.map(
      (c) =>
        `${c.quantity} ${c.name}` +
        (c.setCode && c.collectorNumber ? ` (${c.setCode.toUpperCase()}) ${c.collectorNumber}` : ""),
    );
    return [[EXPORT_HEADERS[board], ...lines].join("\n")];
  }).join("\n\n");
}
