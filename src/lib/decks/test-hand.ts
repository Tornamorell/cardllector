// The test hand (D35): the main deck shuffled, seven cards, London mulligans. Pure; the
// component brings the randomness.

export type LibraryCard = {
  oracleId: string;
  name: string;
  imageSmall: string | null;
  /** The bigger picture, to read the card in the hand; the small one if there's none. */
  imageNormal: string | null;
  printingId: string | null;
  isLand: boolean;
  quantity: number;
};

export type HandCard = Omit<LibraryCard, "quantity"> & { key: string };

/** One entry per copy. */
export function buildLibrary(cards: LibraryCard[]): HandCard[] {
  return cards.flatMap(({ quantity, ...card }) =>
    Array.from({ length: quantity }, (_, i) => ({ ...card, key: `${card.oracleId}-${i}` })),
  );
}

/** Fisher–Yates on a copy; `random` returns [0, 1). */
export function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** London mulligan in multiplayer Commander: the first one is free, then one card to the bottom each. */
export function cardsToBottom(mulligans: number): number {
  return Math.max(0, mulligans - 1);
}
