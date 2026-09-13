import { COLORS, MANA_LABELS, type Color } from "@/lib/decks/analysis";
import { cn } from "@/lib/utils";

// Magic's colours as the symbols show them.
const COLOR_CLASS: Record<Color, string> = {
  W: "bg-amber-100 text-amber-950",
  U: "bg-sky-600 text-white",
  B: "bg-neutral-800 text-white ring-1 ring-white/25",
  R: "bg-red-600 text-white",
  G: "bg-green-700 text-white",
};

/** A mana cost as symbols, front face only: "{2}{G}{G}". Hybrid symbols take their first colour. */
export function ManaCost({ cost, className }: { cost: string | null; className?: string }) {
  const symbols = [...(cost ?? "").split(" // ")[0].matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
  if (!symbols.length) return null;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-0.5", className)} aria-label={`Coste: ${symbols.join(" ")}`}>
      {symbols.map((s, i) => {
        const color = s.split("/").find((p): p is Color => (COLORS as readonly string[]).includes(p));
        return (
          <span
            key={i}
            aria-hidden
            className={cn(
              "inline-flex size-4 items-center justify-center rounded-full text-[9px] leading-none font-bold",
              color ? COLOR_CLASS[color] : "bg-muted text-foreground ring-foreground/15 ring-1",
            )}
          >
            {s.replace(/\//g, "").slice(0, 2)}
          </span>
        );
      })}
    </span>
  );
}

/** A colour identity as dots, in WUBRG order; "Incoloro" when it has none. */
export function ColorIdentity({ colors, className }: { colors: string[]; className?: string }) {
  const shown = COLORS.filter((c) => colors.includes(c));
  if (!shown.length) return <span className={cn("text-muted-foreground text-xs", className)}>Incoloro</span>;
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={shown.map((c) => MANA_LABELS[c]).join(", ")}>
      {shown.map((c) => (
        <span key={c} aria-hidden title={MANA_LABELS[c]} className={cn("size-3.5 rounded-full", COLOR_CLASS[c])} />
      ))}
    </span>
  );
}

export function colorDotClass(c: Color) {
  return COLOR_CLASS[c];
}
