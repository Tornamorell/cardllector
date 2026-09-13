// Checklists of sports card collections, from CromosRepes (D29). CromosRepes only shows the
// full list to a signed-in user who follows the collection, on its "marcar faltas" page; its
// text, copied as is, is what this parses. Pure: scripts/import-album.ts puts it in the catalog.

/** One line of the checklist: its section and label, and how many the user had marked. */
export type RawItem = { section: string; label: string; marked: number };

/**
 * The page text as sections and items. A section title follows a "check_box" line, items start
 * with "·", and a line with just a number before an item is the user's own mark on it (how many
 * are missing, or repeated): kept as `marked`, never needed for the catalog.
 */
export function parseCromosRepesList(text: string): RawItem[] {
  const items: RawItem[] = [];
  let section = "";
  let expectSection = false;
  let marked = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line === "check_box") {
      expectSection = true;
    } else if (expectSection) {
      section = line;
      expectSection = false;
      marked = 0;
    } else if (/^\d+$/.test(line)) {
      marked = Number(line);
    } else if (line.startsWith("·")) {
      items.push({ section, label: line.slice(1).trim(), marked });
      marked = 0;
    }
    // Anything else is page chrome: "disabled_by_default", "4 faltas"…
  }
  return items;
}

export type AlbumConfig = {
  /** Date of the first edition; cards without an edition mark came out then. */
  releasedAt: string;
  /** Edition marks ("II", "III") → the date those cards came out. */
  editions: Record<string, string>;
  /** Team codes on the special series ("RMA") → the team's name, as its section is titled. */
  teams: Record<string, string>;
};

export type AlbumCard = {
  /** Unique within the album: "16", "16-POWER", "21-BIS", "SOB-1", "EDL-01", "AO-01". */
  collectorNumber: string;
  name: string;
  /** The series, lowercased: the sports rarities in src/lib/games.ts. */
  rarity: string;
  team: string | null;
  releasedAt: string;
  marked: number;
};

/** Series codes before the name, "16 ELI-POWER Raphinha BAR": the rarity and a number suffix. */
const SERIES: Record<string, { rarity: string; power?: true }> = {
  ELI: { rarity: "élite" },
  "ELI-POWER": { rarity: "élite power", power: true },
  NELI: { rarity: "élite" },
  "NELI-POWER": { rarity: "élite power", power: true },
  VER: { rarity: "vértigo" },
  "VER-POWER": { rarity: "vértigo power", power: true },
  NVER: { rarity: "vértigo" },
  "NVER-POWER": { rarity: "vértigo power", power: true },
  VIP: { rarity: "zona vip" },
  "VIP-POWER": { rarity: "zona vip power", power: true },
  NVIP: { rarity: "zona vip" },
  "NVIP-POWER": { rarity: "zona vip power", power: true },
  MRK: { rarity: "master rookie" },
  NMRK: { rarity: "master rookie" },
  FBK: { rarity: "flashback" },
  NFBK: { rarity: "flashback" },
  "FBK-ANT": { rarity: "flashback anthology" },
  "NFBK-ANT": { rarity: "flashback anthology" },
  NFI: { rarity: "nuevo fichaje" },
  // New in 2026-27.
  ENJ: { rarity: "enjoy" },
  "ENJ-POWER": { rarity: "enjoy power", power: true },
  NENJ: { rarity: "enjoy" },
  "NENJ-POWER": { rarity: "enjoy power", power: true },
  STARS: { rarity: "stars on 25" },
  "MRK-POWER": { rarity: "master rookie power", power: true },
};

/** "CRISTIANO RONALDO" → "Cristiano Ronaldo"; names already in mixed case are left alone. */
const titleCase = (s: string) =>
  s === s.toUpperCase() ? s.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase()) : s;

/** The series of a section, for items that don't print their code ("516 Gorrotxategi RSO"). */
function sectionRarity(section: string): string | null {
  const s = section.toLowerCase();
  if (s.includes("special one gold")) return "special one gold";
  if (s.includes("special one")) return "special one black";
  if (s.includes("flashback anthology")) return "flashback anthology";
  if (s.includes("flashback")) return "flashback";
  if (/m[aá]ster rookie/.test(s)) return "master rookie";
  if (s.includes("enjoy")) return "enjoy";
  if (s.includes("stars on")) return "stars on 25";
  if (s.includes("just 25")) return "just 25";
  if (s.includes("élite")) return "élite";
  if (s.includes("vértigo")) return "vértigo";
  if (s.includes("zona vip")) return "zona vip";
  if (s.includes("fichajes")) return "nuevo fichaje";
  if (/mega-?power/.test(s)) return "mega power";
  if (s.includes("limitada")) return "edición limitada";
  if (s.includes("autógrafo")) return "autógrafo original";
  if (s.includes("índice")) return "checklist";
  return null;
}

/** "(II)" / "(III)" mark the edition a card came out in. */
function takeEdition(label: string): { rest: string; edition: string | null } {
  const m = /\s*\((II|III|IV|V)\)(?=\s|$)/.exec(label);
  if (!m) return { rest: label, edition: null };
  return { rest: (label.slice(0, m.index) + label.slice(m.index + m[0].length)).trim(), edition: m[1] };
}

/**
 * A team code anywhere in the label ("Cubarsí BAR (Top Revelación)", "Lamine Yamal BAR- Starter
 * Pack"): the team, and the rest.
 */
function takeTeam(label: string, teams: Record<string, string>): { rest: string; team: string | null } {
  const words = label.split(" ");
  const i = words.findLastIndex((w) => w.replace(/[-,.:;]+$/, "") in teams);
  if (i === -1) return { rest: label, team: null };
  const code = words[i].replace(/[-,.:;]+$/, "");
  return { rest: [...words.slice(0, i), ...words.slice(i + 1)].join(" ").trim(), team: teams[code] };
}

/** The checklist as catalog cards: one per item, with unique numbers (see AlbumCard). */
export function toAlbumCards(items: RawItem[], config: AlbumConfig): AlbumCard[] {
  const cards: AlbumCard[] = [];
  const used = new Set<string>();
  const unique = (number: string) => {
    let candidate = number;
    for (let n = 2; used.has(candidate); n++) candidate = `${number}-${n}`;
    used.add(candidate);
    return candidate;
  };
  let checklists = 0;

  for (const item of items) {
    // Albums, packs and "complete collection" entries aren't cards.
    if (/colecci[oó]n completa|álbum y sobres/i.test(item.section)) continue;
    // A bare number is a player's slot CromosRepes hasn't named yet: it comes in with a later import.
    if (/^\d+$/.test(item.label.trim())) continue;
    // "*" marks the special ones; "(BOX/LATA)" says where a card comes from, not who's on it.
    const { rest: label, edition } = takeEdition(
      item.label.replace(/\s*\*\s*$/, "").replace(/\s*\(BOX\/LATA\)/i, ""),
    );
    const releasedAt = (edition && config.editions[edition]) || config.releasedAt;
    const add = (number: string, name: string, rarity: string, team: string | null) =>
      cards.push({
        collectorNumber: unique(number),
        name: name.replace(/\s+/g, " ").trim(),
        rarity,
        team,
        releasedAt,
        marked: item.marked,
      });
    let m: RegExpExecArray | null;

    if ((m = /^(\d+) (?:NUEVA )?SPECIAL ONE (BLACK|BLAK|GOLD) (.+)$/i.exec(label))) {
      const gold = /gold/i.test(m[2]);
      const { rest, team } = takeTeam(m[3], config.teams);
      add(`${gold ? "SOG" : "SOB"}-${m[1]}`, rest, gold ? "special one gold" : "special one black", team);
    } else if ((m = /^EDL (\d+) (.+)$/i.exec(label))) {
      const { rest, team } = takeTeam(m[2], config.teams);
      add(`EDL-${m[1]}`, rest.replace(/\s*-\s*Starter Pack$/i, " Starter Pack"), "edición limitada", team);
    } else if ((m = /^(\d+) JUST 25 ?- ?(.+)$/i.exec(label))) {
      const { rest, team } = takeTeam(m[2], config.teams);
      add(`JUST-${m[1]}`, titleCase(rest), "just 25", team);
    } else if ((m = /^SPECIAL ONE CHAMPIONS (\S+)$/i.exec(label))) {
      // One per champion club, no number: numbered by the club's code.
      add(`SOC-${m[1]}`, "Special One Champions", "special one champions", config.teams[m[1]] ?? null);
    } else if ((m = /^AO (\d+) CARD AUT[OÓ]GRAFO ORIGINAL(?: DUAL)? ?- ?(.+)$/i.exec(label))) {
      const { rest, team } = takeTeam(m[2], config.teams);
      add(`AO-${m[1]}`, rest, "autógrafo original", team);
    } else if ((m = /^(\d+) (.+)$/.exec(label))) {
      const [, number, body] = m;
      const [code, ...words] = body.split(" ");
      const series = SERIES[code];
      if (/^CARD MEGA-POWER$/i.test(body)) {
        add(number, "Card Mega Power", "mega power", null);
      } else if (/^POWER STARS /i.test(body)) {
        // The Stars On 25 parallel: "424 POWER STARS Raúl RMA", once "POWER STARS STARS …".
        const { rest, team } = takeTeam(body.replace(/^POWER STARS (STARS )?/i, ""), config.teams);
        add(`${number}-POWER`, rest, "stars on 25 power", team);
      } else if (series) {
        const { rest, team } = takeTeam(words.join(" "), config.teams);
        add(series.power ? `${number}-POWER` : number, rest, series.rarity, team);
      } else if (code === "BIS") {
        // Replaces a player who left the team, in that team's page.
        add(`${number}-BIS`, words.join(" "), "bis", item.section);
      } else if (sectionRarity(item.section)) {
        const { rest, team } = takeTeam(body, config.teams);
        add(number, rest, sectionRarity(item.section)!, team);
      } else if (/^escudo$/i.test(body)) {
        add(number, `Escudo ${item.section}`, "escudo", item.section);
      } else {
        // A team's page: "20 Sivera", "21 Owono (Baja)".
        add(number, body, "básica", item.section);
      }
    } else {
      // No number at all: the checklist cards of each edition.
      checklists++;
      add(`CHK-${checklists}`, label, sectionRarity(item.section) ?? "checklist", null);
    }
  }
  return cards;
}
