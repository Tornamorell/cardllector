import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AddCopyButton } from "@/components/add-copy-button";
import { CardThumb } from "@/components/card-thumb";
import { ProgressMeter } from "@/components/progress-meter";
import { RarityMark } from "@/components/rarity-mark";
import { formatEur, formatInt } from "@/lib/format";
import { gameById, rarityLabel } from "@/lib/games";
import { getCollection, listCollectionCards } from "@/lib/queries/collections";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { CollectionCardAdder } from "./card-adder";
import { CollectionSettings } from "./collection-settings";
import { EntryControls } from "./entry-controls";

export const metadata: Metadata = { title: "Colección" };

const OWNED_FILTERS = { all: "Todas", have: "Tengo", missing: "Me faltan" } as const;
const SORTS = { recent: "Recientes", name: "Nombre", price: "Precio", set: "Edición" } as const;

function param(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function pick<T extends Record<string, string>>(options: T, value: string | undefined, fallback: keyof T) {
  return (value && value in options ? value : fallback) as keyof T & string;
}

/** A collection: the cards it lists, in colour when owned and grey when missing. */
export default async function CollectionPage({
  params,
  searchParams,
}: PageProps<"/collections/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const collection = await getCollection(user.id, id);
  if (!collection) notFound();
  const cards = await listCollectionCards(user.id, id);

  const sp = await searchParams;
  const owned = pick(OWNED_FILTERS, param(sp.owned), "all");
  const sort = pick(SORTS, param(sp.sort), "recent");

  const isComplete = (c: (typeof cards)[number]) => c.owned >= c.wanted;
  let shown = cards.filter((c) => (owned === "all" ? true : owned === "have" ? isComplete(c) : !isComplete(c)));
  if (sort === "name") shown = [...shown].sort((a, b) => a.name.localeCompare(b.name, "es"));
  if (sort === "price") shown = [...shown].sort((a, b) => (b.priceEur ?? -1) - (a.priceEur ?? -1));
  if (sort === "set") {
    shown = [...shown].sort(
      (a, b) =>
        a.setCode.localeCompare(b.setCode) ||
        a.collectorNumber.localeCompare(b.collectorNumber, undefined, { numeric: true }),
    );
  }

  const href = (patch: Record<string, string | undefined>) => {
    const merged: Record<string, string | undefined> = {
      owned: owned === "all" ? undefined : owned,
      sort: sort === "recent" ? undefined : sort,
      ...patch,
    };
    const qs = new URLSearchParams(
      Object.entries(merged).filter((e): e is [string, string] => !!e[1]),
    ).toString();
    return qs ? `?${qs}` : "?";
  };
  const counts = {
    all: cards.length,
    have: cards.filter(isComplete).length,
    missing: cards.filter((c) => !isComplete(c)).length,
  };
  const pct = collection.cardCount ? Math.round((collection.completeCount / collection.cardCount) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{collection.name}</h1>
          {collection.description && (
            <p className="text-muted-foreground text-sm">{collection.description}</p>
          )}
        </div>
        <CollectionSettings id={collection.id} name={collection.name} description={collection.description} />
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <p className="text-sm">
            Tienes <strong>{formatInt(collection.completeCount)}</strong> de {formatInt(collection.cardCount)}{" "}
            cartas ({pct}%)
          </p>
          <ProgressMeter
            value={collection.completeCount}
            max={Math.max(collection.cardCount, 1)}
            showLabel={false}
            className="w-full max-w-md"
          />
        </div>
        <div className="flex gap-6 sm:text-right">
          <div>
            <p className="text-muted-foreground text-xs">Lo que tienes</p>
            <p className="display text-primary text-2xl font-bold">{formatEur(collection.ownedValue)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Completarla</p>
            <p className="display text-2xl font-bold">
              {collection.cardCount > 0 && collection.completeCount === collection.cardCount
                ? "¡Completa!"
                : `~${formatEur(collection.missingCost)}`}
            </p>
          </div>
        </div>
      </div>

      <CollectionCardAdder collectionId={collection.id} />

      {cards.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav className="flex gap-1 text-sm" aria-label="Filtrar">
            {Object.entries(OWNED_FILTERS).map(([key, label]) => (
              <FilterLink key={key} href={href({ owned: key === "all" ? undefined : key })} active={owned === key}>
                {label} <span className="text-muted-foreground text-xs tabular-nums">{counts[key as keyof typeof counts]}</span>
              </FilterLink>
            ))}
          </nav>
          <nav className="flex gap-1 text-sm" aria-label="Ordenar">
            {Object.entries(SORTS).map(([key, label]) => (
              <FilterLink key={key} href={href({ sort: key === "recent" ? undefined : key })} active={sort === key}>
                {label}
              </FilterLink>
            ))}
          </nav>
        </div>
      )}

      {!cards.length ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          Esta colección está vacía. Busca arriba las cartas que quieres en ella, o añádele cartas que
          ya tienes desde «Mis cartas» o al escanear.
        </p>
      ) : !shown.length ? (
        <p className="text-muted-foreground py-8 text-center text-sm">No hay cartas con este filtro.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {shown.map((c) => {
            const game = gameById(c.game);
            const complete = isComplete(c);
            return (
              <li key={c.id} className="space-y-1.5">
                <div className="relative">
                  <Link href={`/cards/${c.id}`} className="block">
                    <CardThumb
                      src={c.imageSmall}
                      alt={c.name}
                      size="md"
                      className={cn("w-full!", c.owned === 0 && "opacity-55 grayscale-[0.75]")}
                    />
                  </Link>
                  {c.owned > 0 && (
                    <span
                      className={cn(
                        "absolute top-1.5 left-1.5 rounded-md px-1.5 py-0.5 text-xs font-semibold shadow-sm",
                        complete ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
                      )}
                    >
                      {c.wanted > 1 || !complete ? `${c.owned}/${c.wanted}` : "✓"}
                    </span>
                  )}
                  <AddCopyButton printingId={c.id} finishes={c.finishes} name={c.name} withCollection={false} />
                </div>
                <div className="text-xs leading-tight">
                  <p className="truncate font-medium" title={c.name}>
                    {c.name}
                  </p>
                  <p className="text-muted-foreground flex justify-between gap-1">
                    <span title={game ? rarityLabel(game, c.rarity) : undefined}>
                      <RarityMark rarity={c.rarity} />
                      {c.setCode.toUpperCase()} #{c.collectorNumber}
                    </span>
                    <span className="tabular-nums">{formatEur(c.priceEur)}</span>
                  </p>
                  <EntryControls collectionId={collection.id} catalogCardId={c.id} wanted={c.wanted} name={c.name} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md px-2.5 py-1.5",
        active ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
