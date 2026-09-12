"use client";

import {
  ClockIcon,
  FlashlightIcon,
  ImageUpIcon,
  MinusIcon,
  MoveIcon,
  PlusIcon,
  ScanLineIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AddFilteredToCollection } from "@/components/add-filtered-to-collection";
import { LanguageFlag } from "@/components/card-attributes";
import { CardThumb } from "@/components/card-thumb";
import type { CollectionOption } from "@/components/collection-picker";
import { EntryTarget, targetFor, useEntryResult } from "@/components/entry-target";
import type { LocationOption } from "@/components/location-picker";
import { MoveDialog } from "@/components/move-dialog";
import { QuickAdd } from "@/components/quick-add";
import { NextSectionButton, sectionFill } from "@/components/section-picker";
import {
  ConditionSelect,
  FinishSelect,
  LanguageSelect,
  finishFor,
} from "@/components/stack-fields";
import { Button } from "@/components/ui/button";
import { FINISH_LABELS, formatEur, placeLabel } from "@/lib/format";
import { SetPicker, type SetOption } from "@/components/set-picker";
import { gameById, rarityLabel, rarityRank } from "@/lib/games";
import type { ScanMatch } from "@/lib/queries/scan";
import {
  INFO_STRIP,
  NAME_LAYOUTS,
  TITLE_STRIP,
  coverTransform,
  guideIn,
  stripRect,
  toVideo,
  type NameLayout,
  type Rect,
} from "@/lib/scan/geometry";
import { numberVariants, parseCollectorLine, parseTitle, type CollectorLine } from "@/lib/scan/parse";
import {
  entryUnitPrice,
  sessionTotals,
  type Finish,
  type SessionEntry,
} from "@/lib/scan/session";
import { normalizeForSearch } from "@/lib/search/normalize";
import { useStickyDefaults } from "@/lib/use-sticky-defaults";
import { cn } from "@/lib/utils";
import { addItem, changeFinish, changeQuantity } from "../inventory/actions";
import { savePendingScan } from "../review/actions";
import { saveCardPhoto } from "../cards/photo-actions";
import { cardInGuideBlob } from "@/lib/card-photo";
import { useScanSession } from "./scan-session";

type OcrWorker = import("tesseract.js").Worker;
type Psm = import("tesseract.js").PSM;
type FixedSet = { game: string; code: string };
type Entry = SessionEntry;

// Tuning knobs (docs/scanner.md).
const INFO_HEIGHT = 140; // px of the info strip fed to Tesseract
const TITLE_HEIGHT = 90; // px of the title strip
const NAME_HEIGHT = 120; // px of an album's sideways name, once upright
const TICK_MS = 250; // pause between reads
const VOTES_NEEDED = 2; // a read must repeat this many times…
const VOTE_WINDOW = 6; // …among the last reads (not necessarily consecutive)
const EMPTY_READS_TO_RELEASE = 3; // reads without text before the same card can be added again
const PHOTO_HEIGHT = 560; // px of the «Para luego» photo: enough to read the name and number

const INFO_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/•. ";
const TITLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',- ";
const FINISH_ORDER: Finish[] = ["nonfoil", "foil", "etched"];


const describe = (line: CollectorLine) =>
  [line.setCodes[0], line.total ? `${line.number}/${line.total}` : line.number, line.lang?.toUpperCase()]
    .filter(Boolean)
    .join(" ");

const clock = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" });

/** Crops `rect` of `source` into `canvas` at `height` px, as contrast-stretched grayscale. */
function captureRegion(source: CanvasImageSource, r: Rect, canvas: HTMLCanvasElement, height: number) {
  canvas.width = Math.max(1, Math.round((r.w * height) / r.h));
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  ctx.drawImage(source, r.x, r.y, r.w, r.h, 0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  let min = 255;
  let max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    d[i] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const range = Math.max(1, max - min);
  for (let i = 0; i < d.length; i += 4) {
    const v = ((d[i] - min) * 255) / range;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * Crops `r` of `source` for a name printed sideways (Megacracks): turned upright by `rotate`
 * degrees clockwise, `height` px tall, grey and contrast-stretched, and inverted for light text
 * on a dark band (NameLayout).
 */
function captureName(
  source: CanvasImageSource,
  r: Rect,
  canvas: HTMLCanvasElement,
  height: number,
  rotate: 0 | 90 | -90,
  invert: boolean,
) {
  const turned = rotate !== 0;
  const scale = height / (turned ? r.w : r.h);
  canvas.width = Math.max(1, Math.round((turned ? r.h : r.w) * scale));
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotate * Math.PI) / 180);
  ctx.drawImage(source, r.x, r.y, r.w, r.h, (-r.w * scale) / 2, (-r.h * scale) / 2, r.w * scale, r.h * scale);
  ctx.restore();
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  let min = 255;
  let max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    d[i] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const range = Math.max(1, max - min);
  for (let i = 0; i < d.length; i += 4) {
    const v = ((d[i] - min) * 255) / range;
    d[i] = d[i + 1] = d[i + 2] = invert ? 255 - v : v;
  }
  ctx.putImageData(img, 0, 0);
}

/** A choice's caption: the series for football cards (Élite, Power…), else the set's name. */
function choiceCaption(m: ScanMatch) {
  const game = gameById(m.game);
  return game && !game.hasMarketPrices && m.rarity ? rarityLabel(game, m.rarity) : m.setName;
}

/** Several cards of one player (football albums): the plainest first, as rarities rank them. */
function byRarity(matches: ScanMatch[]) {
  return [...matches].sort((a, b) => {
    const game = gameById(a.game);
    return game ? rarityRank(game, a.rarity) - rarityRank(game, b.rarity) : 0;
  });
}

let audio: AudioContext | null = null;
function beep() {
  try {
    if (!audio) return;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + 0.08);
  } catch {
    // Sound is a nicety.
  }
}

/**
 * Continuous scanner. Full screen while running: the camera fills the screen, the card goes in
 * the guide, and a bottom panel shows the last card added with quick finish/quantity controls.
 * Each read tries the info strip (number, set code) and, when that fails, the title. A read is
 * accepted when it repeats among the last few (votes). See docs/scanner.md.
 */
export function Scanner({
  collections,
  locations,
  sets,
  initialFixedSet,
  initialPending,
  aiEnabled,
}: {
  collections: CollectionOption[];
  locations: LocationOption[];
  sets: SetOption[];
  initialFixedSet: FixedSet | null;
  /** Cards already waiting in /review. */
  initialPending: number;
  /** «Identificar con IA» is configured (ANTHROPIC_API_KEY, D31). */
  aiEnabled: boolean;
}) {
  const [defaults, setDefaults] = useStickyDefaults();
  // Both optional: scanning just fills the inventory (D23).
  const collectionName = collections.find((c) => c.id === defaults.entryCollectionId)?.name ?? null;
  const location = locations.find((l) => l.id === defaults.lastLocationId) ?? null;
  const locationName = location?.name ?? null;
  const target = targetFor(defaults, locations);
  const section = location?.sections?.find((s) => s.id === target.sectionId) ?? null;
  const follow = useEntryResult();

  const [fixedSet, setFixedSet] = useState<FixedSet | null>(initialFixedSet);
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [stage, setStage] = useState<{ w: number; h: number } | null>(null);
  const [status, setStatus] = useState("Encaja la carta en el recuadro.");
  const [lastText, setLastText] = useState("");
  const [showDebug, setShowDebug] = useState(false);
  const [choices, setChoices] = useState<{ matches: ScanMatch[]; lang: string | null } | null>(null);
  // The session survives reloads and closing the camera (scan-session.ts).
  const [entries, setEntries] = useScanSession();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [movingSession, setMovingSession] = useState(false);
  const [busy, setBusy] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [torch, setTorch] = useState({ supported: false, on: false });
  const [pendingCount, setPendingCount] = useState(initialPending);
  const [saving, setSaving] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photoCanvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<OcrWorker | null>(null);
  const psmRef = useRef<{ block: Psm; line: Psm } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const runningRef = useRef(false);
  const readState = useRef({
    votes: [] as Array<string | null>,
    empty: 0,
    holdId: null as string | null,
    tick: 0,
    choicesKey: "",
    mode: "",
    /** The last name read from the title of the card in the guide: the hint for «Para luego». */
    lastTitle: null as string | null,
    cache: new Map<string, ScanMatch[]>(),
  });
  // The read loop is async and long-lived: it reads the latest settings from here.
  // Albums that print the name sideways and no number on the front (Megacracks): read that.
  const fixedSetType = fixedSet
    ? sets.find((s) => s.game === fixedSet.game && s.code === fixedSet.code)?.setType
    : null;
  const nameLayout: NameLayout | null = (fixedSetType && NAME_LAYOUTS[fixedSetType]) || null;

  // Paused while the history is open or the AI is identifying: nothing added behind the user's back.
  const paused = historyOpen || identifying;
  const settings = useRef({ defaults, fixedSet, locations, paused, nameLayout });
  useEffect(() => {
    settings.current = { defaults, fixedSet, locations, paused, nameLayout };
  });

  useEffect(
    () => () => {
      runningRef.current = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      void workerRef.current?.terminate();
    },
    [],
  );

  // Size of the area between the top bar and the bottom panel, where the guide goes.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setStage({ w: entry.contentRect.width, h: entry.contentRect.height }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Full screen: no page scroll underneath.
  useEffect(() => {
    if (!running) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [running]);

  // --- OCR ------------------------------------------------------------------

  async function getWorker() {
    if (workerRef.current) return workerRef.current;
    const { createWorker, PSM } = await import("tesseract.js");
    psmRef.current = { block: PSM.SINGLE_BLOCK, line: PSM.SINGLE_LINE };
    workerRef.current = await createWorker("eng");
    return workerRef.current;
  }

  async function ocr(canvas: HTMLCanvasElement, mode: "info" | "title") {
    const worker = await getWorker();
    const psm = psmRef.current!;
    if (readState.current.mode !== mode) {
      await worker.setParameters(
        mode === "info"
          ? { tessedit_char_whitelist: INFO_CHARS, tessedit_pageseg_mode: psm.block }
          : { tessedit_char_whitelist: TITLE_CHARS, tessedit_pageseg_mode: psm.line },
      );
      readState.current.mode = mode;
    }
    const { data } = await worker.recognize(canvas);
    return data.text;
  }

  /** The guide, in video pixels. */
  function cardInVideo(): Rect | null {
    const video = videoRef.current;
    const stageEl = stageRef.current;
    if (!video?.videoWidth || !stageEl) return null;
    const vr = video.getBoundingClientRect();
    const sr = stageEl.getBoundingClientRect();
    const t = coverTransform(video.videoWidth, video.videoHeight, vr.width, vr.height);
    return toVideo(guideIn({ x: sr.left - vr.left, y: sr.top - vr.top, w: sr.width, h: sr.height }), t);
  }

  // --- Catalog lookups ------------------------------------------------------

  async function post(url: string, body: object, cacheKey: string): Promise<ScanMatch[]> {
    const cache = readState.current.cache;
    const hit = cache.get(cacheKey);
    if (hit) return hit;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const matches: ScanMatch[] = res.ok ? (await res.json()).matches : [];
    cache.set(cacheKey, matches);
    return matches;
  }

  function lookupLine(line: CollectorLine) {
    const { fixedSet } = settings.current;
    return post("/api/scan/lookup", { line, fixedSet }, JSON.stringify(["line", line, fixedSet]));
  }

  function lookupName(name: string) {
    const { fixedSet } = settings.current;
    return post(
      "/api/scan/name",
      { name, fixedSet },
      JSON.stringify(["name", normalizeForSearch(name), fixedSet]),
    );
  }

  // --- Read loop -------------------------------------------------------------

  /** Records a read; returns how many times it appears among the last VOTE_WINDOW reads. */
  function vote(key: string | null) {
    const s = readState.current;
    s.votes.push(key);
    if (s.votes.length > VOTE_WINDOW) s.votes.shift();
    return key ? s.votes.filter((k) => k === key).length : 0;
  }

  function noRead() {
    const s = readState.current;
    vote(null);
    // The card left the frame: the same card may be added again, and its title no longer applies.
    if (++s.empty >= EMPTY_READS_TO_RELEASE) {
      s.holdId = null;
      s.lastTitle = null;
    }
  }

  async function resolve(matches: ScanMatch[], lang: string | null, label: string) {
    const s = readState.current;
    if (!matches.length) {
      setStatus(`${label}, pero no encaja con ninguna carta.`);
      return;
    }
    if (matches.length > 1) {
      const key = matches.map((m) => m.id).join();
      if (key !== s.choicesKey) {
        s.choicesKey = key;
        setChoices({ matches, lang });
        navigator.vibrate?.(30);
        setStatus("Varias cartas encajan: elige cuál es.");
      }
      return;
    }
    const match = matches[0];
    if (s.holdId === match.id) return; // Still the card we just added.
    s.holdId = match.id;
    s.votes = [];
    await add(match, lang);
  }

  /**
   * For albums with the name, not a number, on the front (D29): read the name where the album
   * prints it and offer the player's cards in the album, the plainest first.
   */
  async function readPrintedName(
    video: HTMLVideoElement,
    card: Rect,
    canvas: HTMLCanvasElement,
    layout: NameLayout,
  ) {
    const s = readState.current;
    captureName(video, stripRect(card, layout.strip), canvas, NAME_HEIGHT, layout.rotate, layout.invert);
    const text = await ocr(canvas, "title");
    setLastText(`nombre: ${text.trim() || "—"}`);
    const name = parseTitle(text);
    if (name) s.lastTitle = name;
    const matches = name ? await lookupName(name) : [];
    if (name && matches.length) {
      s.empty = 0;
      setStatus(`Leyendo «${name}»…`);
      if (vote(`n:${matches.map((m) => m.id).sort().join()}`) >= VOTES_NEEDED) {
        await resolve(byRarity(matches), null, `Leído «${name}»`);
      }
    } else {
      noRead();
    }
  }

  async function tick() {
    if (!runningRef.current) return;
    // Looking at the history: don't add cards behind the user's back.
    if (settings.current.paused) {
      setTimeout(tick, TICK_MS);
      return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const card = cardInVideo();
    if (video && canvas && card && workerRef.current) {
      const s = readState.current;
      s.tick++;
      try {
        if (settings.current.nameLayout) {
          await readPrintedName(video, card, canvas, settings.current.nameLayout);
          if (runningRef.current) setTimeout(tick, TICK_MS);
          return;
        }
        captureRegion(video, stripRect(card, INFO_STRIP), canvas, INFO_HEIGHT);
        const text = await ocr(canvas, "info");
        const line = parseCollectorLine(text);
        if (line) {
          setLastText(text.trim());
          s.empty = 0;
          setStatus(`Leyendo ${describe(line)}…`);
          const key = `c:${numberVariants(line.number)[1]}/${line.total ?? ""}/${line.setCodes[0] ?? ""}`;
          if (vote(key) >= VOTES_NEEDED) {
            await resolve(await lookupLine(line), line.lang, `Leído ${describe(line)}`);
          }
        } else if (s.tick % 2 === 0) {
          // No collector line: try the title (old Magic frames, full arts, glare on the corner).
          captureRegion(video, stripRect(card, TITLE_STRIP), canvas, TITLE_HEIGHT);
          const titleText = await ocr(canvas, "title");
          setLastText(`${text.trim() || "—"}\ntítulo: ${titleText.trim() || "—"}`);
          const name = parseTitle(titleText);
          if (name) s.lastTitle = name;
          const matches = name ? await lookupName(name) : [];
          if (name && matches.length) {
            s.empty = 0;
            setStatus(`Leyendo «${name}»…`);
            if (vote(`n:${matches.map((m) => m.id).join()}`) >= VOTES_NEEDED) {
              await resolve(matches, null, `Leído «${name}»`);
            }
          } else {
            noRead();
          }
        } else {
          setLastText(text.trim());
          noRead();
        }
      } catch (error) {
        console.error("[scan]", error);
      }
    }
    if (runningRef.current) setTimeout(tick, TICK_MS);
  }

  // --- Adding and adjusting --------------------------------------------------

  async function add(match: ScanMatch, lang: string | null) {
    const { defaults, locations } = settings.current;
    const finish = finishFor(defaults.finish, match.finishes) as Finish;
    try {
      const r = await addItem({
        catalogCardId: match.id,
        quantity: 1,
        finish,
        condition: defaults.condition,
        // The card's own language code, when printed, beats the session default.
        language: lang ?? defaults.language,
        ...targetFor(defaults, locations),
        source: "scan",
      });
      // Forgets a deleted target; on a full divider, tells the user to put the next one in.
      if (!follow(r)) return;
      // A card without a catalog image: the one in the guide becomes everyone's (D30).
      if (!match.imageSmall) void contributePhoto(match.id);
      beep();
      navigator.vibrate?.(60);
      setChoices(null);
      readState.current.choicesKey = "";
      readState.current.lastTitle = null;
      setEntries((list) => {
        const [top, ...rest] = list;
        if (top?.itemId === r.itemId) return [{ ...top, count: top.count + 1 }, ...rest];
        return [
          { key: crypto.randomUUID(), itemId: r.itemId, match, lang, count: 1, finish, addedAt: Date.now() },
          ...list,
        ];
      });
      setStatus(
        r.advancedFrom && r.section
          ? `Separador «${r.advancedFrom}» lleno: pon el «${r.section.name}»`
          : `✓ ${match.name}`,
      );
    } catch {
      toast.error("No se ha podido añadir la carta.");
    }
  }

  async function mutate(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch {
      toast.error("No se ha podido guardar el cambio.");
    } finally {
      setBusy(false);
    }
  }

  const plusOne = (e: Entry) =>
    mutate(async () => {
      const { defaults, locations } = settings.current;
      const r = await addItem({
        catalogCardId: e.match.id,
        quantity: 1,
        finish: e.finish,
        condition: defaults.condition,
        language: e.lang ?? defaults.language,
        ...targetFor(defaults, locations),
        source: "scan",
      });
      if (!follow(r)) return;
      setEntries((list) =>
        list.map((x) => (x.key === e.key ? { ...x, itemId: r.itemId, count: x.count + 1 } : x)),
      );
    });

  const minusOne = (e: Entry) =>
    mutate(async () => {
      await changeQuantity(e.itemId, -1);
      setEntries((list) =>
        list.flatMap((x) =>
          x.key !== e.key ? [x] : x.count > 1 ? [{ ...x, count: x.count - 1 }] : [],
        ),
      );
      if (readState.current.holdId === e.match.id) readState.current.holdId = null;
    });

  const setFinish = (e: Entry, finish: Finish) =>
    mutate(async () => {
      if (e.finish === finish) return;
      const r = await changeFinish(e.itemId, e.count, finish);
      setEntries((list) =>
        list.map((x) => (x.key === e.key ? { ...x, itemId: r.itemId, finish } : x)),
      );
    });

  function choose(match: ScanMatch) {
    const lang = choices?.lang ?? null;
    setChoices(null);
    readState.current.holdId = match.id;
    readState.current.choicesKey = "";
    void add(match, lang);
  }

  /**
   * Shares a photo of the card in the guide for a card the catalog has no image for, unless
   * someone already did (D30). Runs in the background: a failure only means no photo yet.
   */
  async function contributePhoto(catalogCardId: string) {
    try {
      const video = videoRef.current;
      const card = cardInVideo();
      if (!video || !card) return;
      const blob = await cardInGuideBlob(video, card);
      if (!blob) return;
      const form = new FormData();
      form.set("image", blob, "carta.jpg");
      form.set("catalogCardId", catalogCardId);
      form.set("source", "scan");
      form.set("onlyIfMissing", "1");
      const r = await saveCardPhoto(form);
      if (!r.saved || !r.url) return;
      const url = r.url;
      // The session and the lookup cache show it from now on.
      setEntries((list) =>
        list.map((e) =>
          e.match.id === catalogCardId ? { ...e, match: { ...e.match, imageSmall: url } } : e,
        ),
      );
      for (const matches of readState.current.cache.values()) {
        for (const m of matches) if (m.id === catalogCardId) m.imageSmall = url;
      }
      toast.success("Foto guardada para esta carta: la verán todos.");
    } catch {
      // No photo this time; the next scan of this card will try again.
    }
  }

  /** The card in the guide, straightened (D32), PHOTO_HEIGHT px tall: for «Para luego» and the AI. */
  async function guidePhoto(): Promise<Blob | null> {
    const video = videoRef.current;
    const card = cardInVideo();
    if (!video || !card) return null;
    return cardInGuideBlob(video, card, PHOTO_HEIGHT, 0.8);
  }

  /**
   * «Identificar con IA» (D31): the photo in the guide goes to Claude, and what it reads is
   * matched against the catalog. One match is added; several are offered, the likeliest first.
   */
  async function identifyWithAi() {
    if (identifying || !cardInVideo()) return;
    setIdentifying(true);
    setChoices(null);
    setStatus("Identificando con IA…");
    try {
      const blob = await guidePhoto();
      if (!blob) throw new Error("No photo");
      const form = new FormData();
      form.set("image", blob, "carta.jpg");
      form.set("fixedSet", JSON.stringify(settings.current.fixedSet));
      const res = await fetch("/api/scan/identify", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = body.error ?? "No se ha podido identificar la carta.";
        toast.error(message);
        setStatus(message);
        return;
      }
      const { reading, matches } = body as {
        reading: { isCard: boolean; name: string } | null;
        matches: ScanMatch[];
      };
      const s = readState.current;
      if (!reading?.isCard) {
        setStatus("La IA no ve ninguna carta en el recuadro.");
        return;
      }
      s.lastTitle = reading.name;
      if (!matches.length) {
        setStatus(
          `La IA lee «${reading.name}», pero no está en el catálogo${settings.current.fixedSet ? " de esta expansión" : ""}.`,
        );
        return;
      }
      if (matches.length === 1) {
        s.holdId = matches[0].id;
        s.votes = [];
        await add(matches[0], null);
        return;
      }
      s.choicesKey = matches.map((m) => m.id).join();
      setChoices({ matches, lang: null });
      navigator.vibrate?.(30);
      setStatus(`La IA lee «${reading.name}». Elige cuál es: la más probable va primero.`);
    } catch {
      toast.error("No se ha podido identificar la carta.");
      setStatus("No se ha podido identificar la carta.");
    } finally {
      setIdentifying(false);
    }
  }

  /** «Para luego»: a photo of what's in the guide goes to the review queue (/review, D25). */
  async function saveForLater() {
    if (!cardInVideo()) return;
    setSaving(true);
    try {
      const blob = await guidePhoto();
      if (!blob) throw new Error("No photo");

      const { defaults } = settings.current;
      const form = new FormData();
      form.set("image", blob, "carta.jpg");
      form.set("readText", lastText);
      form.set("guess", readState.current.lastTitle ?? "");
      form.set("finish", defaults.finish);
      form.set("condition", defaults.condition);
      form.set("language", defaults.language);
      const target = targetFor(defaults, settings.current.locations);
      form.set("locationId", target.locationId ?? "");
      form.set("sectionId", target.sectionId ?? "");
      form.set("collectionId", target.collectionId ?? "");
      const r = await savePendingScan(form);
      setPendingCount(r.pending);
      beep();
      navigator.vibrate?.(60);
      setStatus("Guardada para luego. Siguiente carta.");
    } catch {
      toast.error("No se ha podido guardar la foto.");
    } finally {
      setSaving(false);
    }
  }

  /**
   * Ends the session without doing anything else with it: clears the history and the running
   * total. The cards stay where they were added. Undoable.
   */
  function endSession() {
    const previous = entries;
    setEntries([]);
    setHistoryOpen(false);
    readState.current.holdId = null;
    toast("Sesión terminada. Las cartas siguen en Mis cartas, donde las añadiste.", {
      action: { label: "Deshacer", onClick: () => setEntries(previous) },
    });
  }

  /** After moving the session, its lines point at the stacks their copies ended up in. */
  function followMove(destinations: Record<string, string>) {
    setEntries((list) => list.map((e) => ({ ...e, itemId: destinations[e.itemId] ?? e.itemId })));
  }

  // --- Camera ---------------------------------------------------------------

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("La cámara solo funciona con HTTPS (o en localhost).");
      return;
    }
    setStarting(true);
    try {
      audio ??= new AudioContext();
      void audio.resume();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 3840 }, height: { ideal: 2160 } },
        audio: false,
      });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      track
        ?.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] })
        .catch(() => {});
      const capabilities = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
        torch?: boolean;
      };
      setTorch({ supported: !!capabilities.torch, on: false });

      runningRef.current = true;
      setRunning(true);
      setStatus("Cargando el lector de texto…");
      await new Promise((r) => requestAnimationFrame(r));
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      await getWorker();
      readState.current = {
        ...readState.current,
        votes: [],
        empty: 0,
        holdId: null,
        choicesKey: "",
        lastTitle: null,
      };
      setStatus("Encaja la carta en el recuadro, con buena luz.");
      void tick();
    } catch (error) {
      runningRef.current = false;
      setRunning(false);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const name = error instanceof DOMException ? error.name : "";
      toast.error(
        name === "NotAllowedError"
          ? "No hay permiso para usar la cámara."
          : name === "NotFoundError"
            ? "No se ha encontrado ninguna cámara."
            : "No se ha podido abrir la cámara.",
      );
    } finally {
      setStarting(false);
    }
  }

  function stop() {
    runningRef.current = false;
    setRunning(false);
    setChoices(null);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("En pausa.");
  }

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const on = !torch.on;
    try {
      await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
      setTorch((t) => ({ ...t, on }));
    } catch {
      toast.error("No se ha podido encender la linterna.");
    }
  }

  async function scanPhoto(file: File) {
    try {
      setStatus("Leyendo la foto…");
      const bitmap = await createImageBitmap(file);
      const canvas = photoCanvasRef.current!;
      // A photo of one card, cropped to it: the whole image is the card.
      const card = { x: 0, y: 0, w: bitmap.width, h: bitmap.height };
      const layout = settings.current.nameLayout;
      if (layout) {
        captureName(bitmap, stripRect(card, layout.strip), canvas, NAME_HEIGHT, layout.rotate, layout.invert);
        const read = await ocr(canvas, "title");
        setLastText(`nombre: ${read.trim() || "—"}`);
        const name = parseTitle(read);
        const found = name ? await lookupName(name) : [];
        if (!found.length) {
          setStatus("No he podido leer el nombre. Recorta la foto a la carta, por delante, y prueba otra vez.");
          return;
        }
        setChoices({ matches: byRarity(found), lang: null });
        setStatus(`Leído «${name}»: confirma la carta.`);
        return;
      }
      captureRegion(bitmap, stripRect(card, INFO_STRIP), canvas, INFO_HEIGHT);
      const text = await ocr(canvas, "info");
      const line = parseCollectorLine(text);
      let matches: ScanMatch[] = [];
      let label = "";
      if (line) {
        matches = await lookupLine(line);
        label = describe(line);
      }
      if (!matches.length) {
        captureRegion(bitmap, stripRect(card, TITLE_STRIP), canvas, TITLE_HEIGHT);
        const name = parseTitle(await ocr(canvas, "title"));
        if (name) {
          matches = await lookupName(name);
          label = `«${name}»`;
        }
      }
      setLastText(text.trim());
      if (!matches.length) {
        setStatus("No he podido identificar la carta. Recorta la foto a la carta y prueba otra vez.");
        return;
      }
      setChoices({ matches, lang: line?.lang ?? null });
      setStatus(`Leído ${label}: confirma la carta.`);
    } catch {
      toast.error("No se ha podido leer la foto.");
    }
  }

  // --- Render ---------------------------------------------------------------

  const totals = sessionTotals(entries);
  const totalsText =
    `${totals.cards} ${totals.cards === 1 ? "carta" : "cartas"}, ${formatEur(totals.valueEur)}` +
    (totals.unpriced ? ` (${totals.unpriced} sin precio)` : "");
  // The session's own copies per stack: moving the session moves these, never older copies a
  // stack already had when a scan joined it.
  const sessionStacks = [
    ...entries.reduce(
      (acc, e) => acc.set(e.itemId, (acc.get(e.itemId) ?? 0) + e.count),
      new Map<string, number>(),
    ),
  ].map(([itemId, count]) => ({ itemId, count }));

  /** What to do with the session at the end: list it, store it somewhere, or just end it. */
  const sessionActions = (tone: "page" | "overlay") => (
    <div className="flex flex-wrap items-center gap-2">
      <AddFilteredToCollection
        collections={collections}
        filter={{ itemIds: sessionStacks.map((s) => s.itemId) }}
        label="A una colección"
      />
      <Button
        variant={tone === "overlay" ? "secondary" : "outline"}
        size="sm"
        onClick={() => setMovingSession(true)}
      >
        <MoveIcon />A una ubicación
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={tone === "overlay" ? "text-white hover:bg-white/15 hover:text-white" : undefined}
        onClick={endSession}
      >
        Terminar sesión
      </Button>
    </div>
  );
  const current = entries[0] ?? null;
  const guide = stage ? guideIn({ x: 0, y: 0, w: stage.w, h: stage.h }) : null;
  const strip = guide ? stripRect(guide, nameLayout?.strip ?? INFO_STRIP) : null;
  const fixedCode = fixedSet?.code.toUpperCase();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Escanear</h1>

      <section className="bg-muted/40 space-y-3 rounded-lg border p-3" aria-label="Sesión">
        <EntryTarget collections={collections} locations={locations} />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Por defecto</span>
          <FinishSelect value={defaults.finish} onChange={(v) => setDefaults({ finish: v })} />
          <ConditionSelect value={defaults.condition} onChange={(v) => setDefaults({ condition: v })} />
          <LanguageSelect value={defaults.language} onChange={(v) => setDefaults({ language: v })} />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Expansión fija</span>
          <SetPicker sets={sets} value={fixedSet} onChange={setFixedSet} />
        </div>
        <p className="text-muted-foreground text-xs">
          Con una expansión fija basta con leer el número o el nombre: ideal para una caja de la misma
          expansión o cartas sin código impreso (Magic anterior a 2014).
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="lg" onClick={start} disabled={starting}>
          <ScanLineIcon />
          {starting ? "Abriendo cámara…" : "Empezar a escanear"}
        </Button>
        <label className="hover:bg-muted inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-sm">
          <ImageUpIcon className="size-4" />
          Foto
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void scanPhoto(file);
              e.target.value = "";
            }}
          />
        </label>
        {!running && status && (
          <p className="text-muted-foreground text-sm" role="status">
            {status}
          </p>
        )}
        {pendingCount > 0 && (
          <Link href="/review" className="text-sm underline underline-offset-2">
            {pendingCount} por revisar
          </Link>
        )}
      </div>
      <canvas ref={photoCanvasRef} className="hidden" />

      {movingSession && (
        <MoveDialog
          stacks={sessionStacks}
          title="Guardar la sesión en una ubicación"
          description={`Se mueven solo las ${totals.cards} ${totals.cards === 1 ? "carta" : "cartas"} de esta sesión. Si en el destino ya hay copias iguales, se juntan.`}
          locations={locations}
          onClose={() => setMovingSession(false)}
          onMoved={followMove}
        />
      )}

      {!running && choices && (
        <ChoicesGrid matches={choices.matches} onChoose={choose} onDismiss={() => setChoices(null)} />
      )}

      {entries.length > 0 && (
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-medium">En esta sesión: {totalsText}</h2>
              <p className="text-muted-foreground text-xs">
                Ya están en Mis cartas. Al acabar, añádelas a una colección, guárdalas en una
                ubicación o termina sin más.
              </p>
            </div>
            {sessionActions("page")}
          </div>
          <SessionList
            entries={entries}
            busy={busy}
            onMinus={minusOne}
            onPlus={plusOne}
            tone="page"
          />
        </section>
      )}

      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-medium">¿No la reconoce? Búscala a mano</summary>
        <div className="pt-3">
          <QuickAdd locations={locations} collections={collections} />
        </div>
      </details>

      {/* Full-screen scanner. Always mounted so the video and stage refs exist. */}
      <div
        className={cn("fixed inset-0 z-50 flex flex-col bg-black text-white", !running && "hidden")}
        role="dialog"
        aria-label="Escáner"
      >
        <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />

        <div className="relative z-10 flex items-center gap-2 bg-gradient-to-b from-black/80 to-transparent px-3 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/15 hover:text-white"
            onClick={stop}
            aria-label="Cerrar escáner"
          >
            <XIcon />
          </Button>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium">
              {placeLabel(locationName, section && `${section.name} (${sectionFill(section)})`) ??
                "Sin ubicación"}
            </p>
            <p className="truncate text-xs text-white/70">
              {collectionName ? `y en «${collectionName}»` : "Sin colección"}
              {fixedCode && `, solo ${fixedCode}`}
            </p>
          </div>
          {torch.supported && (
            <Button
              variant="ghost"
              size="icon"
              className={cn("text-white hover:bg-white/15 hover:text-white", torch.on && "bg-white/25")}
              onClick={toggleTorch}
              aria-label={torch.on ? "Apagar linterna" : "Encender linterna"}
              aria-pressed={torch.on}
            >
              <FlashlightIcon />
            </Button>
          )}
          <button
            type="button"
            onClick={() => setHistoryOpen((open) => !open)}
            aria-expanded={historyOpen}
            aria-label={`Esta sesión: ${totalsText}. Ver el historial`}
            className="rounded-full bg-white/15 px-3 py-1 text-sm tabular-nums hover:bg-white/25"
          >
            {totals.cards} · <span className="text-primary font-semibold">{formatEur(totals.valueEur)}</span>
          </button>
        </div>

        <div ref={stageRef} className="relative z-10 flex-1">
          {guide && strip && (
            <>
              <div
                className="absolute rounded-[4.5%] border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]"
                style={{ left: guide.x, top: guide.y, width: guide.w, height: guide.h }}
              />
              <div
                className="absolute rounded border-2 border-primary"
                style={{ left: strip.x, top: strip.y, width: strip.w, height: strip.h }}
              />
            </>
          )}
          <p
            className="absolute inset-x-4 top-2 mx-auto w-fit max-w-full truncate rounded-full bg-black/60 px-3 py-1 text-center text-xs"
            role="status"
            aria-live="polite"
          >
            {status}
          </p>

          {historyOpen && (
            <div className="absolute inset-0 z-20 flex flex-col bg-neutral-950/95">
              <div className="flex items-start justify-between gap-3 px-4 pt-3 pb-2">
                <div className="min-w-0">
                  <p className="font-semibold">Esta sesión</p>
                  <p className="text-sm text-white/70">{totalsText}</p>
                  <p className="text-xs text-white/50">La lectura está en pausa mientras miras.</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setHistoryOpen(false)}>
                  Seguir escaneando
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {entries.length ? (
                  <SessionList
                    entries={entries}
                    busy={busy}
                    onMinus={minusOne}
                    onPlus={plusOne}
                    tone="overlay"
                  />
                ) : (
                  <p className="px-4 py-8 text-center text-sm text-white/60">
                    Aún no has añadido nada en esta sesión.
                  </p>
                )}
              </div>
              {entries.length > 0 && (
                <div className="border-t border-white/10 px-4 py-3">{sessionActions("overlay")}</div>
              )}
            </div>
          )}
        </div>

        <div className="relative z-10 space-y-3 rounded-t-2xl bg-neutral-950/95 px-3 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
          {showDebug && (
            <div className="space-y-1">
              <canvas ref={canvasRef} className="max-h-16 max-w-full rounded bg-white" />
              <pre className="max-h-16 overflow-auto text-[10px] text-white/70">{lastText || "—"}</pre>
            </div>
          )}
          {/* The read loop needs the canvas even when the debug view is hidden. */}
          {!showDebug && <canvas ref={canvasRef} className="hidden" />}

          {choices ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">¿Cuál es?</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/15 hover:text-white"
                  onClick={() => setChoices(null)}
                >
                  Ninguna
                </Button>
              </div>
              <ul className="flex gap-2 overflow-x-auto pb-1">
                {choices.matches.map((m) => (
                  <li key={m.id} className="w-20 shrink-0">
                    <button type="button" onClick={() => choose(m)} className="w-full text-left text-[10px]">
                      <CardThumb
                        src={m.imageSmall}
                        alt={m.name}
                        label={`#${m.collectorNumber}`}
                        size="md"
                        className="w-full!"
                      />
                      <p className="mt-1 truncate text-white/80">
                        {gameById(m.game)?.hasMarketPrices === false
                          ? choiceCaption(m)
                          : `${m.setCode.toUpperCase()} #${m.collectorNumber}`}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : current ? (
            <CurrentCard
              entry={current}
              busy={busy}
              onFinish={(f) => setFinish(current, f)}
              onPlus={() => plusOne(current)}
              onMinus={() => minusOne(current)}
            />
          ) : (
            <p className="py-3 text-center text-sm text-white/70">
              {nameLayout
                ? "Encaja la carta por delante. El nombre del jugador, en la franja de la derecha, tiene que quedar dentro del marco amarillo."
                : "Encaja la carta en el recuadro. La esquina de abajo a la izquierda (el número) tiene que quedar dentro del marco amarillo."}
            </p>
          )}

          {location && section && (
            <NextSectionButton locationId={location.id} sectionId={section.id} className="w-full" />
          )}
          <div className={cn("grid gap-2", aiEnabled && "grid-cols-2")}>
            {aiEnabled && (
              <Button
                variant="secondary"
                size="sm"
                disabled={identifying}
                aria-busy={identifying}
                onClick={identifyWithAi}
              >
                <SparklesIcon />
                {identifying ? "Identificando…" : "Identificar con IA"}
              </Button>
            )}
            <Button variant="secondary" size="sm" disabled={saving} onClick={saveForLater}>
              <ClockIcon />
              {saving ? "Guardando…" : aiEnabled ? "Para luego" : "¿No la reconoce? Para luego"}
              {pendingCount > 0 && <span className="text-muted-foreground tabular-nums">({pendingCount})</span>}
            </Button>
          </div>

          <button
            type="button"
            className="w-full text-center text-[11px] text-white/50"
            onClick={() => setShowDebug((v) => !v)}
          >
            {showDebug ? "Ocultar lectura" : "Ver lo que lee"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** The last card added, with one-tap finish and quantity controls. */
function CurrentCard({
  entry,
  busy,
  onFinish,
  onPlus,
  onMinus,
}: {
  entry: Entry;
  busy: boolean;
  onFinish: (finish: Finish) => void;
  onPlus: () => void;
  onMinus: () => void;
}) {
  const { match } = entry;
  const labels = gameById(match.game)?.finishLabels ?? FINISH_LABELS;
  const finishes = FINISH_ORDER.filter((f) => match.finishes.includes(f));
  const price = entryUnitPrice(entry);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <CardThumb
          src={match.imageSmall}
          alt={match.name}
          size="sm"
          foil={entry.finish !== "nonfoil"}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{match.name}</p>
          <p className="truncate text-xs text-white/70">
            {match.setName} · #{match.collectorNumber}
            {entry.lang && (
              <>
                {" · "}
                <LanguageFlag code={entry.lang} />
              </>
            )}
          </p>
          <p className="text-sm tabular-nums">{formatEur(price)}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="icon"
            disabled={busy}
            onClick={onMinus}
            aria-label="Una copia menos"
          >
            <MinusIcon />
          </Button>
          <span className="w-8 text-center text-lg font-semibold tabular-nums">{entry.count}</span>
          <Button variant="secondary" size="icon" disabled={busy} onClick={onPlus} aria-label="Una copia más">
            <PlusIcon />
          </Button>
        </div>
      </div>
      {finishes.length > 1 && (
        <div
          className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-white/10 p-1"
          role="radiogroup"
          aria-label="Acabado"
        >
          {finishes.map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={entry.finish === f}
              disabled={busy}
              onClick={() => onFinish(f)}
              className={cn(
                "rounded-md py-2 text-sm font-medium transition-colors",
                entry.finish === f ? "bg-white text-black" : "text-white/80 hover:bg-white/10",
              )}
            >
              {labels[f]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The session's history, newest first: when, what, its value, and −/+ to fix counts. */
function SessionList({
  entries,
  busy,
  onMinus,
  onPlus,
  tone,
}: {
  entries: Entry[];
  busy: boolean;
  onMinus: (e: Entry) => void;
  onPlus: (e: Entry) => void;
  /** "overlay" inside the full-screen camera, "page" on the scan page. */
  tone: "page" | "overlay";
}) {
  const overlay = tone === "overlay";
  const muted = overlay ? "text-white/60" : "text-muted-foreground";
  const buttonClass = overlay ? "text-white hover:bg-white/15 hover:text-white" : undefined;
  return (
    <ul className={cn("divide-y", overlay ? "divide-white/10" : "rounded-md border")}>
      {entries.map((e) => {
        const unit = entryUnitPrice(e);
        return (
          <li key={e.key} className="flex items-center gap-3 px-3 py-2">
            <CardThumb src={e.match.imageSmall} alt="" size="xs" foil={e.finish !== "nonfoil"} />
            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate font-medium">{e.match.name}</p>
              <p className={cn("truncate text-xs", muted)}>
                {e.addedAt ? `${clock.format(e.addedAt)} · ` : ""}
                {e.match.setCode.toUpperCase()} #{e.match.collectorNumber} ·{" "}
                {(gameById(e.match.game)?.finishLabels ?? FINISH_LABELS)[e.finish]}
                {e.lang && (
                  <>
                    {" · "}
                    <LanguageFlag code={e.lang} />
                  </>
                )}
              </p>
            </div>
            <span className="text-right text-sm tabular-nums">
              <span className="text-primary block font-semibold">
                {unit == null ? "—" : formatEur(unit * e.count)}
              </span>
              {e.count > 1 && <span className={cn("block text-xs", muted)}>×{e.count}</span>}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              className={buttonClass}
              disabled={busy}
              onClick={() => onMinus(e)}
              aria-label="Quitar una"
            >
              <MinusIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className={buttonClass}
              disabled={busy}
              onClick={() => onPlus(e)}
              aria-label="Otra copia"
            >
              <PlusIcon />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

function ChoicesGrid({
  matches,
  onChoose,
  onDismiss,
}: {
  matches: ScanMatch[];
  onChoose: (m: ScanMatch) => void;
  onDismiss: () => void;
}) {
  return (
    <section className="space-y-2 rounded-lg border border-primary p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">¿Cuál es?</h2>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Ninguna
        </Button>
      </div>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {matches.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => onChoose(m)}
              className="hover:bg-muted w-full space-y-1 rounded-md p-1 text-left text-xs"
            >
              <CardThumb
                src={m.imageSmall}
                alt={m.name}
                label={`#${m.collectorNumber}`}
                size="md"
                className="w-full!"
              />
              <p className="truncate font-medium">{m.name}</p>
              <p className="text-muted-foreground truncate">
                {choiceCaption(m)} · #{m.collectorNumber}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
