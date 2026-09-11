import Link from "next/link";
import { CardThumb } from "@/components/card-thumb";
import { Delta } from "@/components/delta";
import { ValueChart } from "@/components/value-chart";
import { formatEur, formatInt } from "@/lib/format";
import { finishLabel } from "@/lib/games";
import {
  VALUE_PERIODS,
  priceMoves,
  valueHistory,
  type PriceMove,
  type PriceMoves,
  type ValuePeriod,
} from "@/lib/queries/value";
import { cn } from "@/lib/utils";

const longDate = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", timeZone: "UTC" });
const pct = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });

/** Dashboard: how the value moved over a period, and which cards moved it. */
export async function ValueOverview({ ownerId, period }: { ownerId: string; period: ValuePeriod }) {
  const [history, moves] = await Promise.all([
    valueHistory(ownerId, period),
    priceMoves(ownerId, period),
  ]);

  return (
    <section className="space-y-4" aria-labelledby="value-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="value-heading" className="text-lg font-bold">
          Evolución
        </h2>
        <nav className="flex gap-1 text-sm" aria-label="Periodo">
          {Object.entries(VALUE_PERIODS).map(([key, label]) => (
            <Link
              key={key}
              href={key === "30" ? "/" : `/?period=${key}`}
              scroll={false}
              aria-current={period === key ? "page" : undefined}
              className={cn(
                "rounded-md px-2.5 py-1.5",
                period === key ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="bg-card space-y-4 rounded-xl border p-4">
        <PriceChange moves={moves} period={period} />
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs">
            Lo que valen tus cartas cada día. También sube cuando añades cartas.
          </p>
          {history.length >= 2 ? (
            <ValueChart
              dates={history.map((p) => p.date)}
              series={[
                {
                  key: "value",
                  label: "Valor de tus cartas",
                  color: "var(--chart-1)",
                  values: history.map((p) => p.valueEur),
                },
              ]}
              notes={history.map(
                (p) =>
                  `${formatInt(p.cardCount)} cartas` +
                  (p.unpricedCount ? `, ${formatInt(p.unpricedCount)} sin precio` : ""),
              )}
              notesLabel="Cartas"
            />
          ) : (
            <p className="text-muted-foreground py-8 text-center text-sm">
              La gráfica aparece con el segundo día de precios. Se guardan cada día, al actualizarse
              los precios.
            </p>
          )}
        </div>
      </div>

      {moves.compared > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          <MoveList title="Lo que más ha subido" moves={moves.up} />
          <MoveList title="Lo que más ha bajado" moves={moves.down} />
        </div>
      )}
    </section>
  );
}

function PriceChange({ moves, period }: { moves: PriceMoves; period: ValuePeriod }) {
  if (!moves.compared) {
    return (
      <p className="text-muted-foreground text-sm">
        {period === "all"
          ? "Aún no hay dos días de precios para comparar."
          : `Aún no hay precios de hace ${period} días para comparar. Prueba con «Todo».`}
      </p>
    );
  }
  const share = moves.baseValue ? (moves.totalImpact / moves.baseValue) * 100 : 0;
  return (
    <div>
      <p className="text-muted-foreground text-sm">
        Por cambios de precio
        {moves.fromDate && `, desde el ${longDate.format(Date.parse(`${moves.fromDate}T00:00:00Z`))}`}
      </p>
      <p className="flex items-baseline gap-2">
        <Delta value={moves.totalImpact} className="text-2xl" />
        <span className="text-muted-foreground text-sm">
          ({share > 0 ? "+" : share < 0 ? "−" : ""}
          {pct.format(Math.abs(share))} %)
        </span>
      </p>
    </div>
  );
}

function MoveList({ title, moves }: { title: string; moves: PriceMove[] }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">{title}</h3>
      {!moves.length ? (
        <p className="text-muted-foreground text-sm">Nada en este periodo.</p>
      ) : (
        <ul className="bg-card divide-y rounded-xl border">
          {moves.map((m) => (
            <li key={`${m.id}-${m.finish}`}>
              <Link
                href={`/cards/${m.id}`}
                className="hover:bg-accent/60 flex items-center gap-3 px-4 py-2 first:rounded-t-xl last:rounded-b-xl"
              >
                <CardThumb src={m.imageSmall} alt={m.name} size="xs" foil={m.finish !== "nonfoil"} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{m.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {m.setCode.toUpperCase()} #{m.collectorNumber}
                    {m.finish !== "nonfoil" && `, ${finishLabel(m.game, m.finish)}`}
                    {m.quantity > 1 && `, ×${m.quantity}`}
                  </p>
                </div>
                <div className="text-right text-sm tabular-nums">
                  <Delta value={m.impact} />
                  <p className="text-muted-foreground text-xs">
                    {formatEur(m.thenEur)} → {formatEur(m.nowEur)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
