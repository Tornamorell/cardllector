import Link from "next/link";
import { CardFan } from "@/components/card-fan";
import { CardThumb } from "@/components/card-thumb";
import { ProgressMeter } from "@/components/progress-meter";
import { buttonVariants } from "@/components/ui/button";
import { formatEur, formatInt } from "@/lib/format";
import { finishLabel } from "@/lib/games";
import { gradeLabel } from "@/lib/grading";
import { listCollections } from "@/lib/queries/collections";
import { topStacks } from "@/lib/queries/dashboard";
import { inventorySummary } from "@/lib/queries/items";
import { parsePeriod } from "@/lib/queries/value";
import { requireUser } from "@/lib/session";
import { ValueOverview } from "./value-overview";

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const user = await requireUser();
  const period = parsePeriod((await searchParams).period);
  const [summary, collections, top] = await Promise.all([
    inventorySummary(user.id),
    listCollections(user.id),
    topStacks(user.id),
  ]);

  if (!summary.cardCount && !collections.length) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-16 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Empieza tu colección</h1>
        <p className="text-muted-foreground">
          Escanea tus cartas o búscalas por su nombre, en inglés o en español, y aquí verás lo que
          valen.
        </p>
        <div className="flex justify-center gap-2">
          <Link href="/scan" className={buttonVariants()}>
            Escanear cartas
          </Link>
          <Link href="/inventory" className={buttonVariants({ variant: "outline" })}>
            Añadir a mano
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Hero: your most valuable cards in hand, next to what everything you own is worth. */}
      <section className="flex flex-col items-center gap-6 md:flex-row-reverse md:justify-between">
        <CardFan
          cards={top.slice(0, 5).map((s) => ({
            src: s.card.imageSmall,
            alt: s.card.name,
            foil: s.finish !== "nonfoil",
          }))}
          className="md:mx-0"
        />
        <div className="w-full space-y-5 md:w-auto">
          <div>
            <p className="text-muted-foreground">Tus cartas valen</p>
            <p className="display text-primary text-5xl font-bold sm:text-6xl">
              {formatEur(summary.valueEur)}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">Precios de Cardmarket</p>
          </div>
          <dl className="grid max-w-md grid-cols-3 gap-3">
            <StatTile label="Cartas" value={formatInt(summary.cardCount)} href="/inventory" />
            <StatTile label="Colecciones" value={formatInt(collections.length)} href="/collections" />
            <StatTile
              label="Sin precio"
              value={formatInt(summary.unpricedCount)}
              hint={summary.unpricedCount ? "No cuentan en el valor" : undefined}
            />
          </dl>
        </div>
      </section>

      <ValueOverview ownerId={user.id} period={period} />

      <div className="grid gap-10 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Colecciones</h2>
          {!collections.length ? (
            <p className="text-muted-foreground text-sm">
              Aún no tienes colecciones.{" "}
              <Link href="/collections" className="underline">
                Crea una
              </Link>{" "}
              para seguir lo que tienes y lo que te falta de una lista.
            </p>
          ) : (
            <ul className="bg-card divide-y rounded-xl border">
              {collections.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/collections/${c.id}`}
                    className="hover:bg-accent/60 flex items-center gap-4 px-4 py-3 first:rounded-t-xl last:rounded-b-xl"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                    <ProgressMeter value={c.completeCount} max={Math.max(c.cardCount, 1)} />
                    <span className="text-primary w-24 text-right font-semibold tabular-nums">
                      {formatEur(c.ownedValue)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">Tus cartas más valiosas</h2>
          {!top.length ? (
            <p className="text-muted-foreground text-sm">Aún no hay cartas con precio.</p>
          ) : (
            <ol className="bg-card divide-y rounded-xl border">
              {top.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/cards/${s.card.id}`}
                    className="hover:bg-accent/60 flex items-center gap-3 px-4 py-2"
                  >
                    <CardThumb
                      src={s.card.imageSmall}
                      alt={s.card.name}
                      size="xs"
                      foil={s.finish !== "nonfoil"}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{s.card.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {s.card.setCode.toUpperCase()} #{s.card.collectorNumber}
                        {s.finish !== "nonfoil" && `, ${finishLabel(s.card.game, s.finish)}`}
                        {s.gradingCompany && `, ${gradeLabel(s.gradingCompany, s.grade)}`}
                        {s.location?.name && ` en ${s.location.name}`}
                      </p>
                    </div>
                    <div className="text-right text-sm tabular-nums">
                      <p className="text-primary font-semibold">{formatEur(s.unitPriceEur)}</p>
                      {s.quantity > 1 && <p className="text-muted-foreground text-xs">×{s.quantity}</p>}
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

function StatTile({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
}) {
  const body = (
    <>
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="text-2xl font-bold">{value}</dd>
      {hint && <dd className="text-muted-foreground text-xs">{hint}</dd>}
    </>
  );
  const cls = "bg-card block rounded-xl border p-3 sm:p-4";
  return href ? (
    <Link href={href} className={`${cls} hover:border-primary/60 transition-colors`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
