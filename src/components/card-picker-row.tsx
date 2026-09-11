"use client";

import { useEffect, useRef, useState } from "react";
import type { CardPicker } from "@/components/card-picker";
import { CardThumb } from "@/components/card-thumb";
import { Input } from "@/components/ui/input";
import { formatEur } from "@/lib/format";
import { normalizeForSearch } from "@/lib/search/normalize";
import { cn } from "@/lib/utils";

/** Under a card search once a card is picked: its printings to tap, then the controls. */
export function CardPickerRow({ picker, children }: { picker: CardPicker; children: React.ReactNode }) {
  if (!picker.printing) return null;
  return (
    <div className="space-y-3">
      <PrintingChooser key={picker.selected?.oracleId} picker={picker} />
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/**
 * The printings as card images, newest first: people recognise their copy by its art and set
 * symbol, not by a set name in a list (D26). A filter appears when there are many.
 */
function PrintingChooser({ picker }: { picker: CardPicker }) {
  const { printings, printing, setPrintingId } = picker;
  const [filter, setFilter] = useState("");
  const stripRef = useRef<HTMLDivElement>(null);

  // The preselected printing (the typed one, or the last set used) may be far down the strip.
  useEffect(() => {
    stripRef.current
      ?.querySelector('[aria-checked="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [printing?.id]);

  if (!printing) return null;
  const f = normalizeForSearch(filter);
  const shown = f
    ? printings.filter((p) =>
        normalizeForSearch(`${p.setName ?? ""} ${p.setCode} ${p.collectorNumber}`).includes(f),
      )
    : printings;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-sm">
          <span className="font-medium">{printing.setName ?? printing.setCode.toUpperCase()}</span>{" "}
          <span className="text-muted-foreground">#{printing.collectorNumber}</span>{" "}
          <span className="text-primary font-semibold tabular-nums">{formatEur(printing.priceEur)}</span>
          {printings.length > 1 && (
            <span className="text-muted-foreground">, {printings.length} ediciones</span>
          )}
        </p>
        {printings.length > 8 && (
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar por expansión o número"
            className="h-8 w-full sm:w-64"
            aria-label="Filtrar ediciones"
          />
        )}
      </div>
      <div
        ref={stripRef}
        role="radiogroup"
        aria-label="Edición"
        className="flex snap-x gap-2 overflow-x-auto pb-2"
      >
        {shown.map((p) => {
          const checked = p.id === printing.id;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => setPrintingId(p.id)}
              title={`${p.setName ?? p.setCode.toUpperCase()} #${p.collectorNumber}`}
              className={cn(
                "w-[4.75rem] shrink-0 snap-start space-y-1 rounded-lg p-1 text-left text-[11px] leading-tight outline-none sm:w-20",
                "focus-visible:ring-ring focus-visible:ring-2",
                checked ? "bg-primary/15 ring-primary ring-2" : "hover:bg-accent",
              )}
            >
              <CardThumb src={p.imageSmall} alt="" size="md" className="w-full!" />
              <span className="block truncate">
                {p.setCode.toUpperCase()} #{p.collectorNumber}
              </span>
              <span className="text-muted-foreground block tabular-nums">{formatEur(p.priceEur)}</span>
            </button>
          );
        })}
        {!shown.length && (
          <p className="text-muted-foreground py-6 text-sm">Ninguna edición coincide con el filtro.</p>
        )}
      </div>
    </div>
  );
}
