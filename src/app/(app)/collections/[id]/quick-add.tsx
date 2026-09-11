"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { CardThumb } from "@/components/card-thumb";
import { LocationPicker, type LocationOption } from "@/components/location-picker";
import {
  ConditionSelect,
  FinishSelect,
  LanguageSelect,
  finishFor,
  selectClass,
} from "@/components/stack-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatEur } from "@/lib/format";
import { gameById } from "@/lib/games";
import type { Printing } from "@/lib/queries/cards";
import type { CardSearchResult } from "@/lib/queries/search";
import { useStickyDefaults } from "@/lib/use-sticky-defaults";
import { cn } from "@/lib/utils";
import { addItem } from "../actions";

/**
 * Keyboard-first entry: type a name → Enter picks the card → Enter adds it with the
 * remembered settings. The location sits next to the search box because it's a session
 * setting ("from now on, everything goes to Caja 1"), not a per-card one. The printing
 * defaults to the last set used, so a box from the same set goes in without touching it.
 */
export function QuickAdd({
  collectionId,
  locations,
}: {
  collectionId: string;
  locations: LocationOption[];
}) {
  const [defaults, setDefaults] = useStickyDefaults();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CardSearchResult[]>([]);
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<CardSearchResult | null>(null);
  const [printings, setPrintings] = useState<Printing[]>([]);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);

  const printing = printings.find((p) => p.id === printingId) ?? null;
  const finish = finishFor(defaults.finish, printing?.finishes ?? []);

  useEffect(() => {
    const q = query.trim();
    if (selected || q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        setResults(await res.json());
        setActive(0);
      } catch {
        // Aborted by a newer keystroke.
      }
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, selected]);

  function reset() {
    setSelected(null);
    setQuery("");
    setResults([]);
    setPrintings([]);
    setPrintingId(null);
    setQuantity(1);
    inputRef.current?.focus();
  }

  async function choose(result: CardSearchResult) {
    setSelected(result);
    setQuery(result.name);
    setResults([]);
    const res = await fetch(`/api/printings?oracleId=${encodeURIComponent(result.oracleId)}`);
    const list: Printing[] = res.ok ? await res.json() : [];
    setPrintings(list);
    const preferred =
      list.find((p) => p.setCode === defaults.lastSetCode) ??
      list.find((p) => p.id === result.printingId) ??
      list[0];
    setPrintingId(preferred?.id ?? null);
    requestAnimationFrame(() => addRef.current?.focus());
  }

  function add() {
    if (!printing) return;
    startTransition(async () => {
      try {
        const r = await addItem({
          collectionId,
          catalogCardId: printing.id,
          quantity,
          finish,
          condition: defaults.condition,
          language: defaults.language,
          locationId: defaults.lastLocationId,
        });
        if (!r.ok) {
          setDefaults({ lastLocationId: null });
          toast.error("La ubicación elegida ya no existe. Elige otra y vuelve a añadirla.");
          return;
        }
        toast.success(`${r.name} · ${r.setCode.toUpperCase()} #${r.number}`, {
          description: [
            r.merged ? `Montón actualizado: ${r.quantity} copias` : `Añadida ×${quantity}`,
            r.locationName && `en ${r.locationName}`,
          ]
            .filter(Boolean)
            .join(" "),
        });
        setDefaults({ lastSetCode: printing.setCode });
        reset();
      } catch {
        toast.error("No se ha podido añadir la carta.");
      }
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && results.length) {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp" && results.length) {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selected) add();
      else if (results[active]) void choose(results[active]);
    } else if (e.key === "Escape") {
      reset();
    }
  }

  return (
    <div className="bg-muted/40 space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-64">
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (selected) {
                setSelected(null);
                setPrintings([]);
                setPrintingId(null);
              }
              if (e.target.value.trim().length < 2) setResults([]);
            }}
            onKeyDown={onKeyDown}
            placeholder="Añadir carta: escribe el nombre (inglés o español) y pulsa Intro"
            autoComplete="off"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="quick-add-results"
            aria-activedescendant={results.length ? `quick-add-${active}` : undefined}
            aria-label="Buscar carta para añadir"
          />
          {results.length > 0 && !selected && (
            <ul
              id="quick-add-results"
              role="listbox"
              className="bg-popover absolute z-30 mt-1 max-h-96 w-full overflow-auto rounded-md border p-1 shadow-md"
            >
              {results.map((r, i) => (
                <li
                  key={r.oracleId}
                  id={`quick-add-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    void choose(r);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-sm px-2 py-1.5",
                    i === active && "bg-accent",
                  )}
                >
                  <CardThumb src={r.imageSmall} alt="" size="xs" />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="truncate font-medium">{r.name}</p>
                    {r.printedName && (
                      <p className="text-muted-foreground truncate">{r.printedName}</p>
                    )}
                  </div>
                  <span className="text-muted-foreground text-right text-xs">
                    {gameById(r.game)?.shortName}
                    <br />
                    {r.printings} {r.printings === 1 ? "ed." : "eds."}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Guardar en</span>
          <LocationPicker
            value={defaults.lastLocationId}
            locations={locations}
            onChange={(id) => setDefaults({ lastLocationId: id })}
          />
        </label>
      </div>

      {selected && printing && (
        <div className="flex flex-wrap items-end gap-2">
          <CardThumb src={printing.imageSmall} alt={printing.name} size="sm" />
          <select
            className={cn(selectClass, "max-w-full min-w-0 flex-1 sm:max-w-80")}
            value={printing.id}
            onChange={(e) => setPrintingId(e.target.value)}
            aria-label="Edición"
          >
            {printings.map((p) => (
              <option key={p.id} value={p.id}>
                {p.setName ?? p.setCode.toUpperCase()} · #{p.collectorNumber} ·{" "}
                {formatEur(p.priceEur)}
              </option>
            ))}
          </select>
          <FinishSelect
            value={finish}
            available={printing.finishes}
            labels={gameById(printing.game)?.finishLabels}
            onChange={(v) => setDefaults({ finish: v })}
          />
          <ConditionSelect value={defaults.condition} onChange={(v) => setDefaults({ condition: v })} />
          <LanguageSelect value={defaults.language} onChange={(v) => setDefaults({ language: v })} />
          <Input
            type="number"
            min={1}
            max={999}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
            className="w-20"
            aria-label="Cantidad"
          />
          <Button ref={addRef} onClick={add} disabled={pending}>
            {pending ? "Añadiendo…" : "Añadir"}
          </Button>
          <Button variant="ghost" onClick={reset} disabled={pending}>
            Cancelar
          </Button>
        </div>
      )}
    </div>
  );
}
