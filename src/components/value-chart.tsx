"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type ChartSeries = {
  key: string;
  label: string;
  /** Any CSS colour; use the chart tokens, e.g. "var(--chart-1)". */
  color: string;
  values: Array<number | null>;
};

const MARGIN = { top: 12, bottom: 28, left: 60 };
const tickDate = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" });
const fullDate = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

const toTime = (date: string) => Date.parse(`${date}T00:00:00Z`);

function niceStep(span: number, count: number) {
  const raw = span / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

/** A value axis with round ticks around the data. Never dips below zero for positive data. */
function valueScale(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  let lo = min;
  let hi = max;
  if (lo === hi) {
    const pad = Math.max(Math.abs(lo) * 0.1, 1);
    lo -= pad;
    hi += pad;
  }
  const step = niceStep(hi - lo, 4);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  if (min >= 0 && lo < 0) lo = 0;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return { lo, hi, step, ticks };
}

/** Runs of consecutive days with a value, so a missing day breaks the line instead of bridging it. */
function runs(values: Array<number | null>) {
  const out: number[][] = [];
  let current: number[] = [];
  values.forEach((v, i) => {
    if (v == null) {
      if (current.length) out.push(current);
      current = [];
    } else current.push(i);
  });
  if (current.length) out.push(current);
  return out;
}

function lastIndex(values: Array<number | null>) {
  for (let i = values.length - 1; i >= 0; i--) if (values[i] != null) return i;
  return null;
}

/**
 * Euro values over days (dataviz skill specs): 2px lines, a 10% wash under a single series, a
 * crosshair that snaps to the nearest day with the pointer or the arrow keys, and a table twin
 * under «Ver los datos». One series is named by the surrounding title and labelled at its end;
 * two or more get a legend.
 */
export function ValueChart({
  dates,
  series,
  notes,
  notesLabel = "",
  height = 220,
  className,
}: {
  /** YYYY-MM-DD, oldest first. */
  dates: string[];
  series: ChartSeries[];
  /** An extra tooltip line per day, e.g. how many cards you had. */
  notes?: Array<string | null>;
  notesLabel?: string;
  height?: number;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const single = series.length === 1;
  const right = single ? 80 : 12;
  const plotW = Math.max(width - MARGIN.left - right, 1);
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const base = MARGIN.top + plotH;
  const last = dates.length - 1;

  const times = dates.map(toTime);
  const span = times[last] - times[0];
  const x = (i: number) => MARGIN.left + (span ? ((times[i] - times[0]) / span) * plotW : plotW / 2);
  const scale = valueScale(series.flatMap((s) => s.values.filter((v): v is number => v != null)));
  const y = (v: number) => MARGIN.top + (1 - (v - scale.lo) / (scale.hi - scale.lo)) * plotH;
  const decimals = scale.step < 1 ? 2 : 0;
  const tickEur = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  const maxTicks = Math.max(2, Math.floor(plotW / 84));
  const xTicks =
    dates.length <= maxTicks
      ? dates.map((_, i) => i)
      : Array.from({ length: maxTicks }, (_, k) => Math.round((k * last) / (maxTicks - 1)));

  function nearest(px: number) {
    let best = 0;
    for (let i = 1; i < dates.length; i++) {
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    }
    return best;
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") return setActive(null);
    const from = active ?? last;
    const to: Record<string, number> = { ArrowLeft: from - 1, ArrowRight: from + 1, Home: 0, End: last };
    if (!(e.key in to)) return;
    e.preventDefault();
    setActive(Math.min(last, Math.max(0, to[e.key])));
  }

  const tipX = active == null ? 0 : x(active);
  const flip = tipX > width / 2;
  const label = `${series.map((s) => s.label).join(" y ")}, del ${fullDate.format(times[0])} al ${fullDate.format(times[last])}. Recorre los días con las flechas.`;

  return (
    <figure className={cn("space-y-2", className)}>
      {!single && (
        <ul className="text-muted-foreground flex flex-wrap gap-4 text-xs">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span aria-hidden className="h-0.5 w-4 rounded-full" style={{ background: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
      )}

      <div
        ref={boxRef}
        tabIndex={0}
        role="group"
        aria-label={label}
        onKeyDown={onKeyDown}
        onFocus={() => setActive((a) => a ?? last)}
        onBlur={() => setActive(null)}
        className="focus-visible:ring-ring/60 relative rounded-md outline-none focus-visible:ring-2"
        style={{ height }}
      >
        {width > 0 && (
          <svg
            width={width}
            height={height}
            className="block touch-pan-y select-none"
            aria-hidden
            onPointerMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setActive(nearest(e.clientX - rect.left));
            }}
            onPointerLeave={() => setActive(null)}
          >
            {scale.ticks.map((t) => (
              <g key={t}>
                <line
                  x1={MARGIN.left}
                  x2={MARGIN.left + plotW}
                  y1={y(t)}
                  y2={y(t)}
                  stroke="var(--border)"
                  shapeRendering="crispEdges"
                />
                <text
                  x={MARGIN.left - 8}
                  y={y(t)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-muted-foreground text-[11px] tabular-nums"
                >
                  {tickEur.format(t)}
                </text>
              </g>
            ))}
            {xTicks.map((i) => (
              <text
                key={i}
                x={x(i)}
                y={height - 8}
                textAnchor={xTicks.length === 1 ? "middle" : i === 0 ? "start" : i === last ? "end" : "middle"}
                className="fill-muted-foreground text-[11px]"
              >
                {tickDate.format(times[i])}
              </text>
            ))}

            {series.map((s) => {
              const parts = runs(s.values);
              const at = (i: number) => `${x(i)},${y(s.values[i]!)}`;
              return (
                <g key={s.key}>
                  {single &&
                    parts
                      .filter((r) => r.length > 1)
                      .map((r) => (
                        <path
                          key={r[0]}
                          d={`M${x(r[0])},${base}${r.map((i) => `L${at(i)}`).join("")}L${x(r[r.length - 1])},${base}Z`}
                          fill={s.color}
                          opacity={0.1}
                        />
                      ))}
                  <path
                    d={parts.map((r) => r.map((i, k) => `${k ? "L" : "M"}${at(i)}`).join("")).join("")}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </g>
              );
            })}

            {active != null && (
              <line
                x1={tipX}
                x2={tipX}
                y1={MARGIN.top}
                y2={base}
                stroke="var(--muted-foreground)"
                shapeRendering="crispEdges"
              />
            )}
            {series.map((s) => {
              const end = lastIndex(s.values);
              const points = [end, active].filter(
                (i, k, all): i is number => i != null && s.values[i] != null && all.indexOf(i) === k,
              );
              return points.map((i) => (
                <circle
                  key={`${s.key}-${i}`}
                  cx={x(i)}
                  cy={y(s.values[i]!)}
                  r={4}
                  fill={s.color}
                  stroke="var(--card)"
                  strokeWidth={2}
                />
              ));
            })}
            {single &&
              (() => {
                const s = series[0];
                const end = lastIndex(s.values);
                if (end == null) return null;
                return (
                  <text
                    x={x(end) + 10}
                    y={y(s.values[end]!)}
                    dy="0.32em"
                    className="fill-foreground text-xs font-semibold"
                  >
                    {eur.format(s.values[end]!)}
                  </text>
                );
              })()}
          </svg>
        )}

        {active != null && width > 0 && (
          <div
            className="bg-popover pointer-events-none absolute z-10 min-w-32 rounded-lg border px-3 py-2 text-sm shadow-lg"
            style={{
              top: MARGIN.top,
              left: flip ? tipX - 12 : tipX + 12,
              transform: flip ? "translateX(-100%)" : undefined,
            }}
          >
            <p className="text-muted-foreground text-xs">{fullDate.format(times[active])}</p>
            {series.map((s) => {
              const v = s.values[active];
              if (v == null) return null;
              return (
                <p key={s.key} className="flex items-center gap-2">
                  <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: s.color }} />
                  <strong className="tabular-nums">{eur.format(v)}</strong>
                  {!single && <span className="text-muted-foreground text-xs">{s.label}</span>}
                </p>
              );
            })}
            {notes?.[active] && <p className="text-muted-foreground text-xs">{notes[active]}</p>}
          </div>
        )}
        <p className="sr-only" aria-live="polite">
          {active == null
            ? ""
            : `${fullDate.format(times[active])}: ${series
                .map((s) => `${s.label} ${s.values[active] == null ? "sin precio" : eur.format(s.values[active]!)}`)
                .join(", ")}`}
        </p>
      </div>

      <details className="text-sm">
        <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs">
          Ver los datos
        </summary>
        <div className="mt-2 max-h-64 overflow-auto rounded-md border">
          <table className="w-full text-xs tabular-nums">
            <thead className="text-muted-foreground">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium">Día</th>
                {series.map((s) => (
                  <th key={s.key} className="px-3 py-1.5 text-right font-medium">
                    {s.label}
                  </th>
                ))}
                {notes && <th className="px-3 py-1.5 text-right font-medium">{notesLabel}</th>}
              </tr>
            </thead>
            <tbody>
              {dates
                .map((_, k) => last - k)
                .map((i) => (
                  <tr key={dates[i]} className="border-t">
                    <td className="px-3 py-1.5">{fullDate.format(times[i])}</td>
                    {series.map((s) => (
                      <td key={s.key} className="px-3 py-1.5 text-right">
                        {s.values[i] == null ? "—" : eur.format(s.values[i]!)}
                      </td>
                    ))}
                    {notes && <td className="text-muted-foreground px-3 py-1.5 text-right">{notes[i]}</td>}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
