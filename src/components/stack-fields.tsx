"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { CONDITIONS, CONDITION_NAMES, FINISH_LABELS, LANGUAGE_FLAGS, LANGUAGES } from "@/lib/format";
import { cn } from "@/lib/utils";

// Native selects: fastest to operate with the keyboard and the best picker on phones.
export const selectClass = cn(
  "border-input bg-background h-9 rounded-md border px-2 text-sm shadow-xs outline-none",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-50",
);

type Finish = keyof typeof FINISH_LABELS;

export function FinishSelect({
  value,
  onChange,
  available,
  labels = FINISH_LABELS,
  id,
}: {
  value: Finish;
  onChange: (value: Finish) => void;
  available?: string[];
  /** The game's names for each finish (see finishLabels in src/lib/games.ts). */
  labels?: Record<Finish, string>;
  id?: string;
}) {
  const options = (Object.keys(FINISH_LABELS) as Finish[]).filter(
    (f) => !available?.length || available.includes(f),
  );
  return (
    <select
      id={id}
      className={selectClass}
      value={value}
      onChange={(e) => onChange(e.target.value as Finish)}
      aria-label="Acabado"
    >
      {options.map((f) => (
        <option key={f} value={f}>
          {labels[f]}
        </option>
      ))}
    </select>
  );
}

export function ConditionSelect({
  value,
  onChange,
  id,
}: {
  value: (typeof CONDITIONS)[number];
  onChange: (value: (typeof CONDITIONS)[number]) => void;
  id?: string;
}) {
  return (
    <select
      id={id}
      className={selectClass}
      value={value}
      onChange={(e) => onChange(e.target.value as (typeof CONDITIONS)[number])}
      aria-label="Estado"
    >
      {CONDITIONS.map((c) => (
        <option key={c} value={c}>
          {c} · {CONDITION_NAMES[c]}
        </option>
      ))}
    </select>
  );
}

export function LanguageSelect({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}) {
  return (
    <select
      id={id}
      className={selectClass}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Idioma"
    >
      {Object.entries(LANGUAGES).map(([code, label]) => (
        <option key={code} value={code}>
          {LANGUAGE_FLAGS[code] ? `${LANGUAGE_FLAGS[code]} ${label}` : label}
        </option>
      ))}
    </select>
  );
}

/** How many copies: −/+ for the thumb, and a box that selects itself on focus for typing. */
export function QuantityStepper({
  value,
  onChange,
  label = "Cantidad",
}: {
  value: number;
  onChange: (value: number) => void;
  label?: string;
}) {
  const set = (v: number) => onChange(Math.min(999, Math.max(1, Math.round(v) || 1)));
  const stepClass =
    "text-muted-foreground hover:text-foreground flex h-full w-9 items-center justify-center disabled:opacity-40";
  return (
    <div
      role="group"
      aria-label={label}
      className="border-input bg-background flex h-9 items-center rounded-md border shadow-xs"
    >
      <button
        type="button"
        className={stepClass}
        onClick={() => set(value - 1)}
        disabled={value <= 1}
        aria-label="Una menos"
      >
        <MinusIcon className="size-4" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={999}
        value={value}
        onChange={(e) => set(Number(e.target.value))}
        onFocus={(e) => e.target.select()}
        aria-label={label}
        className="h-full w-10 [appearance:textfield] bg-transparent text-center text-sm tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        className={stepClass}
        onClick={() => set(value + 1)}
        disabled={value >= 999}
        aria-label="Una más"
      >
        <PlusIcon className="size-4" />
      </button>
    </div>
  );
}

/** Picks the remembered finish if this printing exists in it, else its first finish. */
export function finishFor(preferred: Finish, available: string[]): Finish {
  if (!available.length || available.includes(preferred)) return preferred;
  return available[0] as Finish;
}
