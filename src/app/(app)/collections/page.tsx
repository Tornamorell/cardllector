import type { Metadata } from "next";
import Link from "next/link";
import { ProgressMeter } from "@/components/progress-meter";
import { formatEur, formatInt } from "@/lib/format";
import { setOptions } from "@/lib/queries/catalog";
import { listCollections } from "@/lib/queries/collections";
import { requireUser } from "@/lib/session";
import { NewCollectionForm } from "./new-collection-form";

export const metadata: Metadata = { title: "Colecciones" };

export default async function CollectionsPage() {
  const user = await requireUser();
  const [collections, sets] = await Promise.all([listCollections(user.id), setOptions()]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Colecciones</h1>
          <p className="text-muted-foreground max-w-prose text-sm">
            Listas de cartas que te interesan, las tengas o no: la Pokédex de Hoenn, tu mazo, lo que
            quieres conseguir. Cada una te dice qué tienes, qué te falta y cuánto costaría completarla.
          </p>
        </div>
        <NewCollectionForm sets={sets} />
      </div>

      {!collections.length ? (
        <p className="text-muted-foreground text-sm">
          Aún no tienes colecciones. Crea una y añádele cartas desde el catálogo, desde «Mis cartas» o
          al escanear.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((c) => (
            <li key={c.id}>
              <Link
                href={`/collections/${c.id}`}
                className="bg-card hover:border-primary/60 block h-full space-y-3 rounded-xl border p-4 transition-colors"
              >
                <div className="space-y-1">
                  <h2 className="text-lg font-bold">{c.name}</h2>
                  {c.description && (
                    <p className="text-muted-foreground line-clamp-2 text-sm">{c.description}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm">
                    Tienes <strong>{formatInt(c.completeCount)}</strong> de {formatInt(c.cardCount)}
                  </p>
                  <ProgressMeter
                    value={c.completeCount}
                    max={Math.max(c.cardCount, 1)}
                    showLabel={false}
                    className="w-full"
                  />
                </div>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-primary font-semibold">{formatEur(c.ownedValue)}</span>
                  {c.missingCost > 0 && (
                    <span className="text-muted-foreground">Falta ~{formatEur(c.missingCost)}</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
