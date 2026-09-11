import Link from "next/link";
import { CardThumb } from "@/components/card-thumb";
import { ItemActions, QuantityControl } from "@/components/item-actions";
import type { LocationOption } from "@/components/location-picker";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatEur } from "@/lib/format";
import { finishLabel } from "@/lib/games";
import { ITEM_SORTS, type CollectionItem, type ItemSort } from "@/lib/queries/collections";
import { cn } from "@/lib/utils";

/**
 * Stacks table shared by collection and location pages. `context` decides which of the two
 * the rows don't already share: a collection page shows each row's location, and vice versa.
 */
export function ItemsTable({
  rows,
  context,
  locations,
}: {
  rows: CollectionItem[];
  context: "collection" | "location";
  locations: LocationOption[];
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Carta</TableHead>
            <TableHead>Detalles</TableHead>
            <TableHead className="text-center">Cantidad</TableHead>
            <TableHead className="text-right">Precio</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                {item.card?.id ? (
                  <Link href={`/cards/${item.card.id}`} className="flex items-center gap-3">
                    <CardThumb
                      src={item.card.imageSmall}
                      alt=""
                      size="xs"
                      foil={item.finish !== "nonfoil"}
                    />
                    <div className="min-w-0">
                      <p className="font-medium hover:underline">{item.card.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {item.card.setCode?.toUpperCase()} #{item.card.collectorNumber}
                        {item.card.setName && ` · ${item.card.setName}`}
                      </p>
                    </div>
                  </Link>
                ) : (
                  <span className="text-muted-foreground">Sin catálogo</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-1 text-xs">
                  {item.finish !== "nonfoil" && (
                    <Badge>{finishLabel(item.card?.game, item.finish)}</Badge>
                  )}
                  <Badge variant="outline">{item.condition}</Badge>
                  <Badge variant="outline" className="uppercase">
                    {item.language}
                  </Badge>
                  {context === "collection" && item.location?.id && (
                    <Link
                      href={`/locations/${item.location.id}`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {item.location.name}
                    </Link>
                  )}
                  {context === "location" && item.collection && (
                    <Link
                      href={`/collections/${item.collection.id}`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {item.collection.name}
                    </Link>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <QuantityControl itemId={item.id} quantity={item.quantity} />
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatEur(item.unitPriceEur)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {item.unitPriceEur == null ? "—" : formatEur(item.unitPriceEur * item.quantity)}
              </TableCell>
              <TableCell>
                <ItemActions
                  locations={locations}
                  item={{
                    id: item.id,
                    game: item.card?.game ?? null,
                    name: item.card?.name ?? "Carta",
                    quantity: item.quantity,
                    finish: item.finish,
                    condition: item.condition,
                    language: item.language,
                    locationId: item.locationId,
                    notes: item.notes,
                    purchasePriceEur: item.purchasePriceEur,
                    finishes: item.card?.finishes ?? [],
                  }}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export type HrefFor = (patch: Record<string, string | number | undefined>) => string;

/** Name filter + sort links. `hidden` keeps other query params when the form submits. */
export function ItemsToolbar({
  q,
  sort,
  href,
  hidden,
}: {
  q: string;
  sort: ItemSort;
  href: HrefFor;
  hidden: Record<string, string | undefined>;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <form className="flex gap-2" role="search">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Filtrar por nombre…"
          className="w-56"
          aria-label="Filtrar por nombre"
        />
        {Object.entries(hidden).map(
          ([name, value]) => value && <input key={name} type="hidden" name={name} value={value} />,
        )}
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>
      <nav className="flex gap-1 text-sm" aria-label="Ordenar">
        {(Object.entries(ITEM_SORTS) as Array<[ItemSort, string]>).map(([key, label]) => (
          <Link
            key={key}
            href={href({ sort: key === "value" ? undefined : key, page: undefined })}
            className={cn(
              "rounded-md px-2.5 py-1.5",
              key === sort ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function Pagination({ page, hasMore, href }: { page: number; hasMore: boolean; href: HrefFor }) {
  if (page <= 1 && !hasMore) return null;
  return (
    <div className="flex justify-between">
      {page > 1 ? (
        <Link
          href={href({ page: page - 1 === 1 ? undefined : page - 1 })}
          className={buttonVariants({ variant: "outline" })}
        >
          ← Anterior
        </Link>
      ) : (
        <span />
      )}
      {hasMore && (
        <Link href={href({ page: page + 1 })} className={buttonVariants({ variant: "outline" })}>
          Siguiente →
        </Link>
      )}
    </div>
  );
}

/** Builds a `?query` link from the current params plus a patch; undefined/empty drop out. */
export function hrefBuilder(current: Record<string, string | number | undefined>): HrefFor {
  return (patch) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...current, ...patch })) {
      if (v !== undefined && v !== "") params.set(k, String(v));
    }
    const s = params.toString();
    return s ? `?${s}` : "?";
  };
}

export function parseItemParams(sp: Record<string, string | string[] | undefined>) {
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const q = str(sp.q)?.trim() ?? "";
  const rawSort = str(sp.sort);
  const sort: ItemSort = rawSort && rawSort in ITEM_SORTS ? (rawSort as ItemSort) : "value";
  const page = Math.max(1, Number(str(sp.page)) || 1);
  return { q, sort, page };
}
