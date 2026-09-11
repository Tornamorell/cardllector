"use client";

import { CONDITIONS, FINISH_LABELS, LANGUAGES } from "@/lib/format";
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
          {c}
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
          {label}
        </option>
      ))}
    </select>
  );
}

/** Picks the remembered finish if this printing exists in it, else its first finish. */
export function finishFor(preferred: Finish, available: string[]): Finish {
  if (!available.length || available.includes(preferred)) return preferred;
  return available[0] as Finish;
}
