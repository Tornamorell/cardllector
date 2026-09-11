import Link from "next/link";
import { CardThumb } from "@/components/card-thumb";
import { buttonVariants } from "@/components/ui/button";
import { formatEur, formatInt } from "@/lib/format";
import { finishLabel } from "@/lib/games";
import { listCollections } from "@/lib/queries/collections";
import { topStacks } from "@/lib/queries/dashboard";
import { requireUser } from "@/lib/session";

export default async function DashboardPage() {
  const user = await requireUser();
  const [collections, top] = await Promise.all([listCollections(user.id), topStacks(user.id)]);

  if (!collections.length) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Empieza tu colección</h1>
        <p className="text-muted-foreground">
          Crea una colección y añade cartas buscándolas por su nombre, en inglés o en español.
        </p>
        <Link href="/collections" className={buttonVariants()}>
          Crear una colección
        </Link>
      </div>
    );
  }

  const totals = collections.reduce(
    (acc, c) => ({
      value: acc.value + c.valueEur,
      cards: acc.cards + c.cardCount,
      unpriced: acc.unpriced + c.unpricedCount,
    }),
    { value: 0, cards: 0, unpriced: 0 },
  );

  return (
    <div className="space-y-10">
      <section className="space-y-6">
        <div>
          <p className="text-muted-foreground text-sm">Valor de tu colección</p>
          <p className="text-5xl font-semibold tracking-tight">{formatEur(totals.value)}</p>
          <p className="text-muted-foreground mt-1 text-xs">Precios de Cardmarket</p>
        </div>
        <dl className="grid max-w-2xl grid-cols-3 gap-3">
          <StatTile label="Cartas" value={formatInt(totals.cards)} />
          <StatTile label="Colecciones" value={formatInt(collections.length)} />
          <StatTile
            label="Sin precio"
            value={formatInt(totals.unpriced)}
            hint={totals.unpriced ? "No cuentan en el valor" : undefined}
          />
        </dl>
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Colecciones</h2>
          <ul className="divide-y rounded-md border">
            {collections.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/collections/${c.id}`}
                  className="hover:bg-muted/50 flex items-baseline justify-between gap-4 px-4 py-3"
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground ml-auto text-sm tabular-nums">
                    {formatInt(c.cardCount)} cartas
                  </span>
                  <span className="w-28 text-right font-medium tabular-nums">
                    {formatEur(c.valueEur)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Tus cartas más valiosas</h2>
          {!top.length ? (
            <p className="text-muted-foreground text-sm">Aún no hay cartas con precio.</p>
          ) : (
            <ol className="divide-y rounded-md border">
              {top.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/cards/${s.card.id}`}
                    className="hover:bg-muted/50 flex items-center gap-3 px-4 py-2"
                  >
                    <CardThumb src={s.card.imageSmall} alt={s.card.name} size="xs" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{s.card.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {s.card.setCode.toUpperCase()} #{s.card.collectorNumber}
                        {s.finish !== "nonfoil" && ` · ${finishLabel(s.card.game, s.finish)}`} ·{" "}
                        {s.collectionName}
                      </p>
                    </div>
                    <div className="text-right text-sm tabular-nums">
                      <p className="font-medium">{formatEur(s.unitPriceEur)}</p>
                      {s.quantity > 1 && (
                        <p className="text-muted-foreground text-xs">×{s.quantity}</p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border p-4">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="text-2xl font-semibold">{value}</dd>
      {hint && <dd className="text-muted-foreground text-xs">{hint}</dd>}
    </div>
  );
}
