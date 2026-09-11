"use client";

import { ImageUpIcon, MinusIcon, PlusIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AddTargetPicker } from "@/components/add-target-picker";
import { CardThumb } from "@/components/card-thumb";
import type { LocationOption } from "@/components/location-picker";
import {
  ConditionSelect,
  FinishSelect,
  LanguageSelect,
  finishFor,
} from "@/components/stack-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatEur } from "@/lib/format";
import { gameById } from "@/lib/games";
import type { ScanMatch } from "@/lib/queries/scan";
import { guideRect, stripRect, type Rect } from "@/lib/scan/geometry";
import { parseCollectorLine, sameLine, type CollectorLine } from "@/lib/scan/parse";
import { useStickyDefaults, validId } from "@/lib/use-sticky-defaults";
import { QuickAdd } from "../collections/[id]/quick-add";
import { addItem, changeQuantity } from "../collections/actions";

type OcrWorker = import("tesseract.js").Worker;
type SetOption = { game: string; code: string; name: string };
type FixedSet = { game: string; code: string };
type Entry = { key: string; itemId: string; match: ScanMatch; lang: string | null; count: number };

// Tuning knobs (docs/scanner.md).
const STRIP_HEIGHT = 140; // px of the info strip fed to Tesseract
const TICK_MS = 300; // pause between reads
const CONFIRMATIONS = 2; // identical consecutive reads before a card is added
const EMPTY_READS_TO_RELEASE = 3; // reads without text before the same card can be added again

const setLabel = (s: SetOption) =>
  `${s.code.toUpperCase()} · ${s.name} (${gameById(s.game)?.shortName ?? s.game})`;

const describe = (line: CollectorLine) =>
  [line.setCodes[0], line.total ? `${line.number}/${line.total}` : line.number, line.lang?.toUpperCase()]
    .filter(Boolean)
    .join(" ");

/** Crops the info strip of `card` into `canvas`, upscaled, as contrast-stretched grayscale. */
function captureStrip(source: CanvasImageSource, card: Rect, canvas: HTMLCanvasElement) {
  const r = stripRect(card);
  canvas.width = Math.max(1, Math.round((r.w * STRIP_HEIGHT) / r.h));
  canvas.height = STRIP_HEIGHT;
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
 * Continuous scanner: reads the bottom-left info strip of the card inside the guide a few
 * times per second, validates the read against the catalog and adds the card to the session
 * target (collection + location) after two identical reads. See docs/scanner.md.
 */
export function Scanner({
  collections,
  locations,
  sets,
  initialFixedSet,
}: {
  collections: Array<{ id: string; name: string }>;
  locations: LocationOption[];
  sets: SetOption[];
  initialFixedSet: FixedSet | null;
}) {
  const [defaults, setDefaults] = useStickyDefaults();
  const collectionId = validId(defaults.lastCollectionId, collections) ?? collections[0]?.id ?? null;

  const [fixedSet, setFixedSet] = useState<FixedSet | null>(initialFixedSet);
  const [fixedInput, setFixedInput] = useState(() => {
    const s = initialFixedSet && sets.find((o) => o.game === initialFixedSet.game && o.code === initialFixedSet.code);
    return s ? setLabel(s) : "";
  });
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [frame, setFrame] = useState<{ w: number; h: number } | null>(null);
  const [status, setStatus] = useState("Pulsa «Empezar» y encaja la carta en el recuadro.");
  const [lastText, setLastText] = useState("");
  const [showDebug, setShowDebug] = useState(false);
  const [choices, setChoices] = useState<{ matches: ScanMatch[]; lang: string | null } | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<OcrWorker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const runningRef = useRef(false);
  const readState = useRef({
    last: null as CollectorLine | null,
    streak: 0,
    empty: 0,
    holdId: null as string | null,
    choicesKey: "",
    cache: new Map<string, ScanMatch[]>(),
  });
  // The read loop is async and long-lived: it reads the latest settings from here.
  const settings = useRef({ collectionId, defaults, fixedSet });
  useEffect(() => {
    settings.current = { collectionId, defaults, fixedSet };
  });

  useEffect(
    () => () => {
      runningRef.current = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      void workerRef.current?.terminate();
    },
    [],
  );

  async function getWorker() {
    if (workerRef.current) return workerRef.current;
    const { createWorker, PSM } = await import("tesseract.js");
    const worker = await createWorker("eng");
    await worker.setParameters({
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/•. ",
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    });
    workerRef.current = worker;
    return worker;
  }

  async function lookup(line: CollectorLine): Promise<ScanMatch[]> {
    const { fixedSet } = settings.current;
    const key = JSON.stringify([line.number, line.total, line.setCodes, fixedSet]);
    const cached = readState.current.cache.get(key);
    if (cached) return cached;
    const res = await fetch("/api/scan/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ line, fixedSet }),
    });
    const matches: ScanMatch[] = res.ok ? (await res.json()).matches : [];
    readState.current.cache.set(key, matches);
    return matches;
  }

  async function add(match: ScanMatch, lang: string | null) {
    const { collectionId, defaults } = settings.current;
    if (!collectionId) {
      toast.error("Crea una colección antes de escanear.");
      return;
    }
    try {
      const r = await addItem({
        collectionId,
        catalogCardId: match.id,
        quantity: 1,
        finish: finishFor(defaults.finish, match.finishes),
        condition: defaults.condition,
        // The card's own language code, when printed, beats the session default.
        language: lang ?? defaults.language,
        locationId: defaults.lastLocationId,
        source: "scan",
      });
      if (!r.ok) {
        setDefaults({ lastLocationId: null });
        toast.error("La ubicación elegida ya no existe. Elige otra.");
        return;
      }
      beep();
      navigator.vibrate?.(60);
      setEntries((list) => {
        const [top, ...rest] = list;
        if (top?.itemId === r.itemId) return [{ ...top, count: top.count + 1 }, ...rest];
        return [{ key: crypto.randomUUID(), itemId: r.itemId, match, lang, count: 1 }, ...list];
      });
      setStatus(`✓ ${match.name} · ${match.setCode.toUpperCase()} #${match.collectorNumber}`);
    } catch {
      toast.error("No se ha podido añadir la carta.");
    }
  }

  async function handleRead(line: CollectorLine | null) {
    const s = readState.current;
    if (!line) {
      s.streak = 0;
      s.last = null;
      // The card left the frame: the same card may be added again.
      if (++s.empty >= EMPTY_READS_TO_RELEASE) s.holdId = null;
      return;
    }
    s.empty = 0;
    if (!sameLine(line, s.last)) {
      s.last = line;
      s.streak = 1;
      setStatus(`Leyendo ${describe(line)}…`);
      return;
    }
    if (++s.streak < CONFIRMATIONS) return;

    const matches = await lookup(line);
    if (!matches.length) {
      setStatus(`Leído ${describe(line)}, pero no encaja con ninguna carta del catálogo.`);
      return;
    }
    if (matches.length > 1) {
      const key = matches.map((m) => m.id).join();
      if (key !== s.choicesKey) {
        s.choicesKey = key;
        setChoices({ matches, lang: line.lang });
        setStatus("Varias cartas encajan con esa lectura: elige cuál es.");
      }
      return;
    }
    const match = matches[0];
    if (s.holdId === match.id) return; // Still the card we just added.
    s.holdId = match.id;
    await add(match, line.lang);
  }

  async function tick() {
    if (!runningRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const worker = workerRef.current;
    if (video?.videoWidth && canvas && worker) {
      try {
        captureStrip(video, guideRect(video.videoWidth, video.videoHeight), canvas);
        const { data } = await worker.recognize(canvas);
        setLastText(data.text.trim());
        await handleRead(parseCollectorLine(data.text));
      } catch (error) {
        console.error("[scan]", error);
      }
    }
    if (runningRef.current) setTimeout(tick, TICK_MS);
  }

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("La cámara solo funciona con HTTPS (o en localhost).");
      return;
    }
    setStarting(true);
    try {
      audio ??= new AudioContext();
      void audio.resume();
      setStatus("Cargando el lector de texto…");
      await getWorker();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      stream
        .getVideoTracks()[0]
        ?.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] })
        .catch(() => {});
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setFrame({ w: video.videoWidth, h: video.videoHeight });
      readState.current = { ...readState.current, last: null, streak: 0, empty: 0, holdId: null };
      runningRef.current = true;
      setRunning(true);
      setStatus("Encaja la carta en el recuadro, con la esquina inferior izquierda bien iluminada.");
      void tick();
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      toast.error(
        name === "NotAllowedError"
          ? "No hay permiso para usar la cámara."
          : name === "NotFoundError"
            ? "No se ha encontrado ninguna cámara."
            : "No se ha podido abrir la cámara.",
      );
      setStatus("Cámara no disponible. Prueba con una foto o busca la carta a mano.");
    } finally {
      setStarting(false);
    }
  }

  function stop() {
    runningRef.current = false;
    setRunning(false);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("En pausa.");
  }

  async function scanPhoto(file: File) {
    try {
      setStatus("Leyendo la foto…");
      const worker = await getWorker();
      const bitmap = await createImageBitmap(file);
      const canvas = canvasRef.current!;
      // A photo of one card, cropped to it: the whole image is the card.
      captureStrip(bitmap, { x: 0, y: 0, w: bitmap.width, h: bitmap.height }, canvas);
      const { data } = await worker.recognize(canvas);
      setLastText(data.text.trim());
      const line = parseCollectorLine(data.text);
      if (!line) {
        setStatus("No he podido leer el número. Recorta la foto a la carta y prueba otra vez.");
        return;
      }
      const matches = await lookup(line);
      if (!matches.length) {
        setStatus(`Leído ${describe(line)}, pero no encaja con ninguna carta del catálogo.`);
        return;
      }
      setChoices({ matches, lang: line.lang });
      setStatus(`Leído ${describe(line)}: confirma la carta.`);
    } catch {
      toast.error("No se ha podido leer la foto.");
    }
  }

  async function undo(entry: Entry) {
    try {
      await changeQuantity(entry.itemId, -1);
      setEntries((list) =>
        list.flatMap((e) =>
          e.key !== entry.key ? [e] : e.count > 1 ? [{ ...e, count: e.count - 1 }] : [],
        ),
      );
      if (readState.current.holdId === entry.match.id) readState.current.holdId = null;
    } catch {
      toast.error("No se ha podido deshacer.");
    }
  }

  function choose(match: ScanMatch) {
    const lang = choices?.lang ?? null;
    setChoices(null);
    readState.current.holdId = match.id;
    void add(match, lang);
  }

  if (!collections.length) {
    return (
      <div className="space-y-2 py-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Escanear</h1>
        <p className="text-muted-foreground">
          Primero{" "}
          <Link href="/collections" className="underline">
            crea una colección
          </Link>{" "}
          donde guardar lo que escanees.
        </p>
      </div>
    );
  }

  const guide = frame ? guideRect(frame.w, frame.h) : null;
  const strip = guide ? stripRect(guide) : null;
  const pct = (v: number, total: number) => `${(v / total) * 100}%`;
  const total = entries.reduce((n, e) => n + e.count, 0);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Escanear</h1>

      <section className="bg-muted/40 space-y-3 rounded-lg border p-3" aria-label="Sesión">
        <AddTargetPicker collections={collections} locations={locations} />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Por defecto</span>
          <FinishSelect value={defaults.finish} onChange={(v) => setDefaults({ finish: v })} />
          <ConditionSelect value={defaults.condition} onChange={(v) => setDefaults({ condition: v })} />
          <LanguageSelect value={defaults.language} onChange={(v) => setDefaults({ language: v })} />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Expansión fija</span>
          <Input
            list="scan-sets"
            value={fixedInput}
            onChange={(e) => {
              setFixedInput(e.target.value);
              const s = sets.find((o) => setLabel(o) === e.target.value);
              setFixedSet(s ? { game: s.game, code: s.code } : null);
            }}
            placeholder="Opcional: solo se leerá el número"
            className="max-w-sm"
            aria-label="Expansión fija"
          />
          <datalist id="scan-sets">
            {sets.map((s) => (
              <option key={`${s.game}:${s.code}`} value={setLabel(s)} />
            ))}
          </datalist>
          {fixedSet && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setFixedSet(null);
                setFixedInput("");
              }}
              aria-label="Quitar expansión fija"
            >
              <XIcon />
            </Button>
          )}
        </div>
        <p className="text-muted-foreground text-xs">
          Úsala para cartas sin código de expansión impreso (Magic anterior a 2014, Pokémon anterior a
          Escarlata y Púrpura) o para escanear una caja de una misma expansión.
        </p>
      </section>

      <div
        className="relative mx-auto overflow-hidden rounded-lg bg-black"
        style={{
          aspectRatio: frame ? `${frame.w} / ${frame.h}` : "3 / 4",
          height: frame ? `min(70vh, calc((100vw - 2rem) * ${frame.h / frame.w}))` : "min(50vh, 20rem)",
          maxWidth: "100%",
        }}
      >
        <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
        {guide && strip && frame && running && (
          <>
            <div
              className="absolute rounded-[4.5%] border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
              style={{
                left: pct(guide.x, frame.w),
                top: pct(guide.y, frame.h),
                width: pct(guide.w, frame.w),
                height: pct(guide.h, frame.h),
              }}
            />
            <div
              className="absolute rounded border-2 border-amber-400"
              style={{
                left: pct(strip.x, frame.w),
                top: pct(strip.y, frame.h),
                width: pct(strip.w, frame.w),
                height: pct(strip.h, frame.h),
              }}
            />
          </>
        )}
        {!running && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white/80">
            La cámara está apagada.
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {running ? (
          <Button variant="outline" onClick={stop}>
            Parar
          </Button>
        ) : (
          <Button onClick={start} disabled={starting}>
            {starting ? "Abriendo cámara…" : "Empezar"}
          </Button>
        )}
        <label className="hover:bg-muted inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-sm">
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
        <Button variant="ghost" size="sm" onClick={() => setShowDebug((v) => !v)}>
          {showDebug ? "Ocultar lectura" : "Ver lo que lee"}
        </Button>
        <p className="text-sm" role="status" aria-live="polite">
          {status}
        </p>
      </div>

      <div className={showDebug ? "space-y-1" : "hidden"}>
        <canvas ref={canvasRef} className="max-w-full rounded border" />
        <pre className="bg-muted overflow-x-auto rounded p-2 text-xs">{lastText || "—"}</pre>
      </div>

      {choices && (
        <section className="space-y-2 rounded-lg border border-amber-400 p-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">¿Cuál es?</h2>
            <Button variant="ghost" size="sm" onClick={() => setChoices(null)}>
              Ninguna
            </Button>
          </div>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {choices.matches.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => choose(m)}
                  className="hover:bg-muted w-full space-y-1 rounded-md p-1 text-left text-xs"
                >
                  <CardThumb src={m.imageSmall} alt={m.name} size="md" className="w-full!" />
                  <p className="truncate font-medium">{m.name}</p>
                  <p className="text-muted-foreground truncate">
                    {m.setName} · #{m.collectorNumber}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {entries.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">
            En esta sesión: {total} {total === 1 ? "carta" : "cartas"}
          </h2>
          <ul className="divide-y rounded-md border">
            {entries.map((e) => (
              <li key={e.key} className="flex items-center gap-3 px-3 py-2">
                <CardThumb src={e.match.imageSmall} alt="" size="xs" />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="truncate font-medium">{e.match.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {e.match.setCode.toUpperCase()} #{e.match.collectorNumber}
                    {e.lang && ` · ${e.lang.toUpperCase()}`} · {formatEur(e.match.priceEur)}
                  </p>
                </div>
                <span className="w-8 text-center text-sm tabular-nums">×{e.count}</span>
                <Button variant="ghost" size="icon-sm" onClick={() => undo(e)} aria-label="Quitar una">
                  <MinusIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void add(e.match, e.lang)}
                  aria-label="Otra copia"
                >
                  <PlusIcon />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {collectionId && (
        <details className="rounded-lg border p-3">
          <summary className="cursor-pointer text-sm font-medium">¿No la reconoce? Búscala a mano</summary>
          <div className="pt-3">
            <QuickAdd collectionId={collectionId} locations={locations} />
          </div>
        </details>
      )}
    </div>
  );
}
