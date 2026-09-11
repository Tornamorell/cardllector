"use client";

import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { CardThumb } from "@/components/card-thumb";
import { Input } from "@/components/ui/input";
import { gameById } from "@/lib/games";
import type { Printing } from "@/lib/queries/cards";
import type { CardSearchResult } from "@/lib/queries/search";
import { cn } from "@/lib/utils";

/**
 * Search-then-pick-a-printing, keyboard first: type → Enter picks the highlighted card →
 * Enter again submits. Shared by the inventory quick add and the collection card adder.
 * The printing defaults to `preferredSetCode` (the last set used) when the card has one.
 */
export function useCardPicker(preferredSetCode: string | null, initialQuery = "") {
  const [query, setQuery] = useState(initialQuery);
  // A prefilled query (a name the scanner read) waits until the box is focused or edited, so a
  // page with several pickers doesn't open every result list at once.
  const [armed, setArmed] = useState(!initialQuery);
  const [results, setResults] = useState<CardSearchResult[]>([]);
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<CardSearchResult | null>(null);
  const [printings, setPrintings] = useState<Printing[]>([]);
  const [printingId, setPrintingId] = useState<string | null>(null);
  // Focus moves by element id rather than refs, so the picker object can be passed around
  // during render (the React Compiler rejects render-time access to ref-holding objects).
  const baseId = useId();
  const inputId = `${baseId}-query`;
  const submitId = `${baseId}-submit`;
  const focus = (id: string) => document.getElementById(id)?.focus();

  useEffect(() => {
    const q = query.trim();
    if (!armed || selected || q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
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
  }, [query, selected, armed]);

  function reset() {
    setSelected(null);
    setQuery("");
    setResults([]);
    setPrintings([]);
    setPrintingId(null);
    focus(inputId);
  }

  async function choose(result: CardSearchResult) {
    setSelected(result);
    setQuery(result.name);
    setResults([]);
    let list: Printing[] = [];
    try {
      const res = await fetch(`/api/printings?oracleId=${encodeURIComponent(result.oracleId)}`);
      if (res.ok) list = await res.json();
    } catch {
      // Handled below, like an empty list.
    }
    if (!list.length) {
      setSelected(null);
      toast.error("No se han podido cargar las ediciones de esta carta. Prueba otra vez.");
      return;
    }
    setPrintings(list);
    // A typed printing ("obf 125") wins; else the last set used; else the newest printing.
    const typed = result.collectorNumber ? list.find((p) => p.id === result.printingId) : undefined;
    const preferred =
      typed ??
      list.find((p) => p.setCode === preferredSetCode) ??
      list.find((p) => p.id === result.printingId) ??
      list[0];
    setPrintingId(preferred.id);
    requestAnimationFrame(() => focus(submitId));
  }

  function onQueryChange(value: string) {
    setQuery(value);
    setArmed(true);
    if (selected) {
      setSelected(null);
      setPrintings([]);
      setPrintingId(null);
    }
    if (value.trim().length < 2) setResults([]);
  }

  const printing = printings.find((p) => p.id === printingId) ?? null;

  return {
    query,
    results,
    active,
    setActive,
    selected,
    printings,
    printing,
    setPrintingId,
    inputId,
    /** Put this id on the submit button: picking a card moves the focus there. */
    submitId,
    choose,
    reset,
    onQueryChange,
    arm: () => setArmed(true),
  };
}

export type CardPicker = ReturnType<typeof useCardPicker>;

export function CardSearchBox({
  picker,
  onSubmit,
  placeholder,
  label,
}: {
  picker: CardPicker;
  onSubmit: () => void;
  placeholder: string;
  label: string;
}) {
  const { query, results, active, setActive, selected, choose, reset, onQueryChange, arm, inputId } =
    picker;
  const listId = `${inputId}-results`;

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && results.length) {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp" && results.length) {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selected) onSubmit();
      else if (results[active]) void choose(results[active]);
    } else if (e.key === "Escape") {
      reset();
    }
  }

  return (
    <div className="relative min-w-0 flex-1 basis-64">
      <Input
        id={inputId}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={arm}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls={listId}
        aria-activedescendant={results.length ? `${listId}-${active}` : undefined}
        aria-label={label}
      />
      {results.length > 0 && !selected && (
        <ul
          id={listId}
          role="listbox"
          className="bg-popover absolute z-30 mt-1 max-h-96 w-full overflow-auto rounded-md border p-1 shadow-md"
        >
          {results.map((r, i) => (
            <li
              key={`${r.oracleId}:${r.printingId}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // Keep the focus in the box on mousedown; choose on click, which touch fires too.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void choose(r)}
              onPointerMove={(e) => e.pointerType === "mouse" && setActive(i)}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-sm px-2 py-2",
                i === active && "bg-accent",
              )}
            >
              <CardThumb src={r.imageSmall} alt="" size="xs" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-medium">{r.name}</p>
                {r.collectorNumber ? (
                  <p className="text-muted-foreground truncate">
                    {r.setName ?? r.setCode?.toUpperCase()} #{r.collectorNumber}
                  </p>
                ) : (
                  r.printedName && <p className="text-muted-foreground truncate">{r.printedName}</p>
                )}
              </div>
              <span className="text-muted-foreground text-right text-xs">
                {gameById(r.game)?.shortName}
                <br />
                {r.collectorNumber
                  ? r.setCode?.toUpperCase()
                  : `${r.printings} ${r.printings === 1 ? "ed." : "eds."}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

