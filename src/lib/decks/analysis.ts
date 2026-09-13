// Deck analysis, Moxfield-style (D35): mana curve, types, colours, Commander legality and price.
// Pure: the deck page feeds it each card with its rules data (oracle_cards).
import type { Board } from "./decklist";

export const COLORS = ["W", "U", "B", "R", "G"] as const;
export type Color = (typeof COLORS)[number];
export type ManaKey = Color | "C";
export const MANA_KEYS: ManaKey[] = ["W", "U", "B", "R", "G", "C"];
export const MANA_LABELS: Record<ManaKey, string> = {
  W: "Blanco",
  U: "Azul",
  B: "Negro",
  R: "Rojo",
  G: "Verde",
  C: "Incoloro",
};

export const TYPE_GROUPS = [
  "creature",
  "planeswalker",
  "battle",
  "instant",
  "sorcery",
  "artifact",
  "enchantment",
  "land",
  "other",
] as const;
export type TypeGroup = (typeof TYPE_GROUPS)[number];
export const TYPE_LABELS: Record<TypeGroup, string> = {
  creature: "Criaturas",
  planeswalker: "Planeswalkers",
  battle: "Batallas",
  instant: "Instantáneos",
  sorcery: "Conjuros",
  artifact: "Artefactos",
  enchantment: "Encantamientos",
  land: "Tierras",
  other: "Otras",
};

export type DeckCardInfo = {
  board: Board;
  quantity: number;
  name: string;
  typeLine: string | null;
  manaCost: string | null;
  cmc: number;
  colorIdentity: string[];
  producedMana: string[];
  oracleText: string | null;
  keywords: string[];
  /** Its legality in Commander: "legal", "banned", "not_legal"… */
  commanderLegality: string | null;
  gameChanger: boolean;
  /** Per copy: the chosen printing's, or the cheapest one's. */
  priceEur: number | null;
};

export type DeckIssue = { message: string; cards?: string[] };

export type DeckAnalysis = {
  copies: Record<Board, number>;
  /** Commander and main deck: what's played. */
  size: number;
  types: Record<TypeGroup, number>;
  /** Non-land cards by mana value, 0 to 7+ (the last). */
  curve: number[];
  curveByType: Array<Partial<Record<TypeGroup, number>>>;
  averageCmc: number | null;
  /** Spells with a land on the back (modal double-faced cards): extra land drops. */
  mdfcLands: number;
  /** Coloured symbols in the costs. */
  pips: Record<ManaKey, number>;
  /** Cards that make each colour: lands, and the rest (rocks, dorks). */
  landSources: Record<ManaKey, number>;
  otherSources: Record<ManaKey, number>;
  /** The commanders' colour identity. */
  identity: Color[];
  gameChangers: string[];
  issues: DeckIssue[];
  price: number;
  unpriced: number;
};

const front = (s: string | null) => (s ?? "").split(" // ")[0];
const zero = (): Record<ManaKey, number> => ({ W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });

const GROUP_BY_TYPE: Array<[RegExp, TypeGroup]> = [
  [/\bCreature\b/, "creature"],
  [/\bPlaneswalker\b/, "planeswalker"],
  [/\bBattle\b/, "battle"],
  [/\bInstant\b/, "instant"],
  [/\bSorcery\b/, "sorcery"],
  [/\bArtifact\b/, "artifact"],
  [/\bEnchantment\b/, "enchantment"],
];

/** Where a card is counted: lands if its front is one, else its first type, creatures first. */
export function typeGroup(typeLine: string | null): TypeGroup {
  const t = front(typeLine);
  if (/\bLand\b/.test(t)) return "land";
  return GROUP_BY_TYPE.find(([re]) => re.test(t))?.[1] ?? "other";
}

/** Symbols in the front face's cost: a hybrid one counts for each colour, a phyrexian one for its own. */
export function manaPips(cost: string | null): Record<ManaKey, number> {
  const pips = zero();
  for (const [, symbol] of front(cost).matchAll(/\{([^}]+)\}/g)) {
    for (const part of symbol.split("/")) if (part in pips) pips[part as ManaKey]++;
  }
  return pips;
}

/** What the Game Changers say about a deck's bracket; the other criteria aren't checked. */
export function bracketHint(gameChangers: number): string {
  if (gameChangers === 0) return "Sin Game Changers: cabe en los brackets 1 y 2 si el resto del mazo encaja.";
  if (gameChangers <= 3) return "Con hasta tres Game Changers: bracket 3 como mínimo.";
  return "Con cuatro o más Game Changers: bracket 4 como mínimo.";
}

const canCommand = (c: DeckCardInfo) =>
  (/\bLegendary\b/.test(front(c.typeLine)) && /\bCreature\b/.test(front(c.typeLine))) ||
  /can be your commander/i.test(c.oracleText ?? "");

/** Two commanders that may go together: Partner, Friends forever, a Background, the Doctor's companion. */
function pairUp(a: DeckCardInfo, b: DeckCardInfo) {
  const keyword = (c: DeckCardInfo, k: string) => c.keywords.some((x) => x.toLowerCase().startsWith(k));
  if (keyword(a, "partner") && keyword(b, "partner")) return true;
  if (keyword(a, "friends forever") && keyword(b, "friends forever")) return true;
  const background = (x: DeckCardInfo, y: DeckCardInfo) =>
    /choose a background/i.test(x.oracleText ?? "") && /\bBackground\b/.test(front(y.typeLine));
  const doctor = (x: DeckCardInfo, y: DeckCardInfo) =>
    /doctor's companion/i.test(x.oracleText ?? "") && /Time Lord Doctor/.test(front(y.typeLine));
  return background(a, b) || background(b, a) || doctor(a, b) || doctor(b, a);
}

const names = (cards: DeckCardInfo[]) => cards.map((c) => c.name);

function commanderIssues(played: DeckCardInfo[], commanders: DeckCardInfo[], identity: Color[]): DeckIssue[] {
  const issues: DeckIssue[] = [];
  if (!commanders.length) {
    issues.push({ message: "Falta el comandante: pon una criatura legendaria en «Comandante»." });
  } else if (commanders.length > 2) {
    issues.push({ message: "Hay más de dos comandantes:", cards: names(commanders) });
  } else {
    const [a, b] = commanders;
    const paired = !!b && pairUp(a, b);
    const cannot = commanders.filter((c) => !canCommand(c) && !(paired && /\bBackground\b/.test(front(c.typeLine))));
    if (cannot.length) issues.push({ message: "No pueden ser comandantes:", cards: names(cannot) });
    if (b && !paired) {
      issues.push({
        message: "Estos dos no pueden ir juntos como comandantes (hace falta Partner, Friends forever o un Background):",
        cards: names(commanders),
      });
    }
  }

  const size = played.reduce((n, c) => n + c.quantity, 0);
  if (size !== 100) issues.push({ message: `El mazo tiene ${size} cartas con el comandante; en Commander son 100.` });

  const byName = new Map<string, { card: DeckCardInfo; n: number }>();
  for (const c of played) {
    const seen = byName.get(c.name);
    byName.set(c.name, { card: c, n: (seen?.n ?? 0) + c.quantity });
  }
  const repeated = [...byName.values()].filter(
    ({ card, n }) =>
      n > 1 &&
      !/\bBasic\b/.test(front(card.typeLine)) &&
      !/A deck can have (any number of|up to \w+) cards named/i.test(card.oracleText ?? ""),
  );
  if (repeated.length) {
    issues.push({
      message: "Solo puede haber una copia de cada carta, salvo las tierras básicas:",
      cards: repeated.map(({ card, n }) => `${n} ${card.name}`),
    });
  }

  if (commanders.length) {
    const outside = played.filter(
      (c) => c.board === "main" && c.colorIdentity.some((col) => !identity.includes(col as Color)),
    );
    if (outside.length) issues.push({ message: "Fuera de la identidad de color del comandante:", cards: names(outside) });
  }
  const banned = played.filter((c) => c.commanderLegality === "banned");
  if (banned.length) issues.push({ message: "Prohibidas en Commander:", cards: names(banned) });
  const notLegal = played.filter((c) => c.commanderLegality === "not_legal");
  if (notLegal.length) issues.push({ message: "No son legales en Commander:", cards: names(notLegal) });
  return issues;
}

export function analyzeDeck(cards: DeckCardInfo[]): DeckAnalysis {
  const copies: Record<Board, number> = { commander: 0, main: 0, side: 0, maybe: 0 };
  for (const c of cards) copies[c.board] += c.quantity;
  const played = cards.filter((c) => c.board === "commander" || c.board === "main");
  const commanders = cards.filter((c) => c.board === "commander");

  const types = Object.fromEntries(TYPE_GROUPS.map((g) => [g, 0])) as Record<TypeGroup, number>;
  const curve = Array<number>(8).fill(0);
  const curveByType: Array<Partial<Record<TypeGroup, number>>> = Array.from({ length: 8 }, () => ({}));
  const pips = zero();
  const landSources = zero();
  const otherSources = zero();
  let cmcSum = 0;
  let spells = 0;
  let mdfcLands = 0;
  let price = 0;
  let unpriced = 0;

  for (const c of played) {
    const group = typeGroup(c.typeLine);
    types[group] += c.quantity;
    if (group !== "land") {
      const bucket = Math.min(7, Math.floor(c.cmc));
      curve[bucket] += c.quantity;
      curveByType[bucket][group] = (curveByType[bucket][group] ?? 0) + c.quantity;
      cmcSum += c.cmc * c.quantity;
      spells += c.quantity;
      const back = (c.typeLine ?? "").split(" // ")[1];
      if (back && /\bLand\b/.test(back)) mdfcLands += c.quantity;
    }
    const cardPips = manaPips(c.manaCost);
    for (const k of MANA_KEYS) pips[k] += cardPips[k] * c.quantity;
    const sources = group === "land" ? landSources : otherSources;
    for (const m of c.producedMana) if (m in sources) sources[m as ManaKey] += c.quantity;
    if (c.priceEur == null) unpriced += c.quantity;
    else price += c.priceEur * c.quantity;
  }

  const identity = COLORS.filter((col) => commanders.some((c) => c.colorIdentity.includes(col)));
  return {
    copies,
    size: copies.commander + copies.main,
    types,
    curve,
    curveByType,
    averageCmc: spells ? cmcSum / spells : null,
    mdfcLands,
    pips,
    landSources,
    otherSources,
    identity,
    gameChangers: played.filter((c) => c.gameChanger).map((c) => c.name),
    issues: commanderIssues(played, commanders, identity),
    price,
    unpriced,
  };
}
