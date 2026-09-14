// Which of the app's pages the user has open, for the assistant (D37): «este mazo» means the
// one on screen. Pure: the server turns it into a line of context (queries/assistant.ts), the
// chat into a hint and suggestions.

export type PageRef =
  | { kind: "deck" | "collection" | "card"; id: string }
  /** A location's id, or "none" for the copies without one. */
  | { kind: "location"; id: string }
  | { kind: "set"; gameSlug: string; setCode: string }
  | { kind: "game"; gameSlug: string }
  | { kind: "home" | "inventory" | "decks" | "collections" | "locations" | "review" | "search" | "catalog" };

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const BY_ID: Array<[RegExp, "deck" | "collection" | "card" | "location"]> = [
  [new RegExp(`^/decks/(${UUID})$`, "i"), "deck"],
  [new RegExp(`^/collections/(${UUID})$`, "i"), "collection"],
  [new RegExp(`^/cards/(${UUID})$`, "i"), "card"],
  [new RegExp(`^/locations/(${UUID}|none)$`, "i"), "location"],
];
const LISTS = {
  "/": "home",
  "/inventory": "inventory",
  "/decks": "decks",
  "/collections": "collections",
  "/locations": "locations",
  "/review": "review",
  "/search": "search",
  "/catalog": "catalog",
} as const;

export function parsePagePath(path: string): PageRef | null {
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  for (const [re, kind] of BY_ID) {
    const m = re.exec(clean);
    if (m) return { kind, id: m[1].toLowerCase() };
  }
  const set = /^\/catalog\/([\w-]+)\/([^/]+)$/.exec(clean);
  if (set) {
    try {
      return { kind: "set", gameSlug: set[1], setCode: decodeURIComponent(set[2]) };
    } catch {
      return null;
    }
  }
  const game = /^\/catalog\/([\w-]+)$/.exec(clean);
  if (game) return { kind: "game", gameSlug: game[1] };
  return clean in LISTS ? { kind: LISTS[clean as keyof typeof LISTS] } : null;
}

/** «Sabe que estás viendo …». */
export const PAGE_LABELS: Record<PageRef["kind"], string> = {
  deck: "este mazo",
  collection: "esta colección",
  card: "esta carta",
  location: "esta ubicación",
  set: "esta expansión",
  game: "este juego del catálogo",
  home: "tu resumen",
  inventory: "tus cartas",
  decks: "tus mazos",
  collections: "tus colecciones",
  locations: "tus ubicaciones",
  review: "lo que tienes por revisar",
  search: "la búsqueda",
  catalog: "el catálogo",
};

const GENERAL = [
  "¿Cuáles son mis 10 cartas más valiosas y dónde están?",
  "¿Cuánto ha cambiado el valor de mis cartas este mes?",
  "¿Qué me falta para completar mis colecciones y cuánto costaría?",
  "¿A alguno de mis mazos le falta rampa o robo? ¿Qué tengo suelto que encaje?",
];

/** Questions to start with, about what's on screen. */
export function suggestionsFor(page: PageRef | null): string[] {
  switch (page?.kind) {
    case "deck":
      return [
        "¿Qué le falta a este mazo?",
        "¿Qué cartas de este mazo no tengo y cuánto costarían?",
        "¿Qué tengo suelto que encaje en este mazo?",
      ];
    case "collection":
      return ["¿Qué me falta de esta colección y cuánto costaría?", "¿Qué es lo más valioso que tengo de esta colección?"];
    case "card":
      return ["¿Cuánto vale esta carta y qué otras ediciones hay?", "¿Dónde tengo mis copias de esta carta?"];
    case "location":
      return ["¿Qué es lo más valioso que hay aquí?", "¿Cuánto vale todo lo que hay en esta ubicación?"];
    case "set":
      return ["¿Qué tengo de esta expansión y cuánto vale?", "¿Cuáles son las cartas más caras de esta expansión que no tengo?"];
    default:
      return GENERAL;
  }
}
