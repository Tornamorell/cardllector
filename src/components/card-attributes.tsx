import { CONDITION_NAMES, LANGUAGE_FLAGS, LANGUAGES, type Condition } from "@/lib/format";
import { cn } from "@/lib/utils";

// Cardmarket's condition colours, from Mint (turquoise) down to Poor (red): collectors read the
// condition by its colour before its letters.
const CONDITION_COLORS: Record<Condition, string> = {
  MT: "#17a2b8",
  NM: "#2eb84b",
  EX: "#a3c43b",
  GD: "#f0c330",
  LP: "#f39530",
  PL: "#ec6a53",
  PO: "#d83a3a",
};

export function ConditionBadge({ condition, className }: { condition: Condition; className?: string }) {
  return (
    <span
      title={CONDITION_NAMES[condition]}
      className={cn(
        "inline-flex h-5 items-center rounded px-1.5 text-[11px] leading-none font-bold text-[#1b1630]",
        className,
      )}
      style={{ backgroundColor: CONDITION_COLORS[condition] }}
    >
      {condition}
    </span>
  );
}

/** The language as a flag, with its name on hover — or next to it with `withName`. */
export function LanguageFlag({
  code,
  withName = false,
  className,
}: {
  code: string;
  withName?: boolean;
  className?: string;
}) {
  const name = LANGUAGES[code] ?? code.toUpperCase();
  const flag = LANGUAGE_FLAGS[code];
  return (
    <span className={cn("inline-flex items-center gap-1 align-middle", className)} title={name}>
      {flag ? (
        <span
          className="text-sm leading-none"
          {...(withName ? { "aria-hidden": true } : { role: "img", "aria-label": name })}
        >
          {flag}
        </span>
      ) : (
        <span className="text-[11px] font-semibold uppercase">{code}</span>
      )}
      {withName && <span>{name}</span>}
    </span>
  );
}
