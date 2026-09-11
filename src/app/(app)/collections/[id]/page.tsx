import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import {
  ItemsTable,
  ItemsToolbar,
  Pagination,
  hrefBuilder,
  parseItemParams,
} from "@/components/items-table";
import { formatEur, formatInt } from "@/lib/format";
import { getCollection, listItems } from "@/lib/queries/collections";
import { collectionByLocation, locationOptions } from "@/lib/queries/locations";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { CollectionSettings } from "./collection-settings";
import { QuickAdd } from "./quick-add";

export const metadata: Metadata = { title: "Colección" };

export default async function CollectionPage({
  params,
  searchParams,
}: PageProps<"/collections/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const sp = await searchParams;
  const { q, sort, page } = parseItemParams(sp);
  // ?loc=<location id> or ?loc=none (copies without location).
  const loc = typeof sp.loc === "string" ? sp.loc : undefined;
  const locationId =
    loc === "none" ? null : loc && z.uuid().safeParse(loc).success ? loc : undefined;

  const collection = await getCollection(user.id, id);
  if (!collection) notFound();

  const [{ rows, hasMore }, byLocation, locations] = await Promise.all([
    listItems({ ownerId: user.id, collectionId: id, locationId }, { q, sort, page }),
    collectionByLocation(id),
    locationOptions(user.id),
  ]);

  const locParam = locationId === null ? "none" : (locationId ?? undefined);
  const href = hrefBuilder({ q, sort: sort === "value" ? undefined : sort, loc: locParam });
  const located = byLocation.some((l) => l.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{collection.name}</h1>
          {collection.description && (
            <p className="text-muted-foreground text-sm">{collection.description}</p>
          )}
        </div>
        <CollectionSettings
          id={collection.id}
          name={collection.name}
          description={collection.description}
        />
      </div>

      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <p className="text-3xl font-semibold tracking-tight">{formatEur(collection.valueEur)}</p>
        <p className="text-muted-foreground text-sm">
          {formatInt(collection.cardCount)} cartas
          {collection.unpricedCount > 0 && ` · ${formatInt(collection.unpricedCount)} sin precio`}
        </p>
      </div>

      <QuickAdd collectionId={collection.id} locations={locations} />

      {located && (
        <nav className="flex flex-wrap gap-1 text-sm" aria-label="Ubicación">
          <LocLink href={href({ loc: undefined, page: undefined })} active={locationId === undefined}>
            Todas las ubicaciones
          </LocLink>
          {byLocation.map((l) => (
            <LocLink
              key={l.id ?? "none"}
              href={href({ loc: l.id ?? "none", page: undefined })}
              active={l.id === null ? locationId === null : locationId === l.id}
            >
              {l.name ?? "Sin ubicación"}{" "}
              <span className="text-muted-foreground text-xs tabular-nums">{formatInt(l.cardCount)}</span>
            </LocLink>
          ))}
        </nav>
      )}

      <ItemsToolbar
        q={q}
        sort={sort}
        href={href}
        hidden={{ sort: sort === "value" ? undefined : sort, loc: locParam }}
      />

      {!rows.length ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          {q || locationId !== undefined
            ? "Nada coincide con estos filtros."
            : "Esta colección está vacía. Añade tu primera carta arriba."}
        </p>
      ) : (
        <ItemsTable rows={rows} context="collection" locations={locations} />
      )}

      <Pagination page={page} hasMore={hasMore} href={href} />
    </div>
  );
}

function LocLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
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
