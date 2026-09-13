// What a card does in a deck (D35): ramp, draw, removal… guessed from its rules text, like
// Moxfield's tags. A guess: the owner can correct it per card (deck_cards.roles). Pure.

export const ROLES = ["ramp", "draw", "removal", "wipe", "counter", "tutor"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ramp: "Rampa",
  draw: "Robo",
  removal: "Eliminación",
  wipe: "Barrido",
  counter: "Contrahechizo",
  tutor: "Tutor",
};

/** A reference widely used for Commander decks: a guide, not a rule. */
export const ROLE_REFERENCE: Partial<Record<Role, number>> = { ramp: 10, draw: 10, removal: 10, wipe: 3 };

type RulesCard = { typeLine: string | null; oracleText: string | null; producedMana: string[] };

const PERMANENT = "(creature|artifact|enchantment|planeswalker|permanent|battle)";
const NUMBER = "(a|an|one|two|three|four|five|six|seven|x|\\d+|that many)";

// Matched against the lowercased text, reminder text removed.
const RULES: Array<[Role, RegExp[]]> = [
  [
    "ramp",
    [
      /search your library for [^.]*\bland cards?\b[^.]*onto the battlefield/,
      /put (a|up to \w+) land cards? from your hand onto the battlefield/,
      /you may play (an|two) additional lands?/,
      new RegExp(`create ${NUMBER} treasure tokens?`),
    ],
  ],
  ["draw", [new RegExp(`\\bdraws? ${NUMBER} cards?\\b`), /\bdraws? cards equal to\b/]],
  [
    "removal",
    [
      new RegExp(`\\b(destroy|exile) target (\\w+ )?${PERMANENT}`),
      /damage to (any target|target (creature|planeswalker|creature or planeswalker|battle))/,
      /return target (\w+ )?(creature|nonland permanent|permanent)[^.]* to (its|their) owner['’]?s['’]? hands?/,
      /(target (player|opponent)|each opponent) sacrifices (a|an) (creature|nonland permanent|permanent)/,
      /\bfights? target creature\b/,
      /target creature (an opponent controls )?gets -(\d+|x)\/-(\d+|x)/,
    ],
  ],
  [
    "wipe",
    [
      /\b(destroy|exile) (all|each) (other )?(nonland |nontoken |tapped |untapped |attacking )?(artifact|creature|enchantment|land|permanent|planeswalker)s?\b/,
      /damage to each creature\b/,
      /\b(all|each) creatures? gets? -(\d+|x)\/-(\d+|x)/,
      /return all (\w+ )?(creatures|nonland permanents|permanents) to their owners['’]? hands?/,
    ],
  ],
  ["counter", [/\bcounter target\b/]],
  // Any card but a land: fetching lands is ramp.
  ["tutor", [/search your library for (?![^.]*\bland cards?\b)[^.]*\bcards?\b/]],
];

/** The roles a card's text suggests. Lands have none: they're counted apart. */
export function cardRoles(card: RulesCard): Role[] {
  const front = (card.typeLine ?? "").split(" // ")[0];
  if (/\bLand\b/.test(front)) return [];
  const text = (card.oracleText ?? "").replace(/\([^)]*\)/g, "").toLowerCase();
  const found = new Set<Role>();
  // Rocks, dorks and rituals.
  if (card.producedMana.length) found.add("ramp");
  for (const [role, patterns] of RULES) if (patterns.some((re) => re.test(text))) found.add(role);
  return ROLES.filter((r) => found.has(r));
}

/** How many copies of the played cards (commander and main deck) do each thing. */
export function roleCounts(cards: Array<{ board: string; quantity: number; roles: Role[] }>): Record<Role, number> {
  const counts = Object.fromEntries(ROLES.map((r) => [r, 0])) as Record<Role, number>;
  for (const c of cards) {
    if (c.board !== "commander" && c.board !== "main") continue;
    for (const r of c.roles) counts[r] += c.quantity;
  }
  return counts;
}
