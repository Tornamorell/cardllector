import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { SetIcon } from "@/components/card-thumb";
import { ProgressMeter } from "@/components/progress-meter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatEur, formatInt } from "@/lib/format";
import { defaultSetGroup, gameBySlug, setTypeFilter, setTypeLabel } from "@/lib/games";
import { listSets } from "@/lib/queries/catalog";
import { normalizeForSearch } from "@/lib/search/normalize";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

function param(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export async function generateMetadata({ params }: PageProps<"/catalog/[game]">): Promise<Metadata> {
  const { game } = await params;
  return { title: gameBySlug(game)?.name ?? "Catálogo" };
}

export default async function GamePage({ params, searchParams }: PageProps<"/catalog/[game]">) {
  const user = await requireUser();
  const { game: slug } = await params;
  const game = gameBySlug(slug);
  if (!game) notFound();

  const crumbs = [{ label: "Catálogo", href: "/catalog" }, { label: game.name }];

  if (!game.available) {
    return (
      <div className="space-y-4">
        <Breadcrumbs items={crumbs} />
        <h1 className="text-2xl font-semibold tracking-tight">{game.name}</h1>
        <p className="text-muted-foreground">
          Todavía no hay catálogo de este juego. Cuando conectemos su fuente de datos, sus
          expansiones aparecerán aquí.
        </p>
      </div>
    );
  }

  const sp = await searchParams;
  const defaultGroup = defaultSetGroup(game);
  const requestedGroup = param(sp.group) ?? defaultGroup;
  const group =
    requestedGroup === "all" || game.setGroups.some((g) => g.key === requestedGroup)
      ? requestedGroup
      : defaultGroup;
  const onlyOwned = param(sp.owned) === "1";
  const q = param(sp.q)?.trim() ?? "";

  let rows = await listSets(game.id, user.id, {
    types: group === "all" ? null : setTypeFilter(game, group),
    onlyOwned,
  });
  if (q) {
    const needle = normalizeForSearch(q);
    rows = rows.filter(
      (s) => normalizeForSearch(s.name).includes(needle) || s.code.toLowerCase() === needle,
    );
  }

  const href = (patch: Record<string, string | undefined>) => {
    const merged = {
      group: group === defaultGroup ? undefined : group,
      owned: onlyOwned ? "1" : undefined,
      q: q || undefined,
      ...patch,
    };
    const qs = new URLSearchParams(
      Object.entries(merged).filter((e): e is [string, string] => !!e[1]),
    ).toString();
    return qs ? `?${qs}` : "?";
  };

  const tabs = [...game.setGroups.map((g) => ({ key: g.key, label: g.label })), { key: "all", label: "Todas" }];

  return (
    <div className="space-y-6">
      <Breadcrumbs items={crumbs} />
      <h1 className="text-2xl font-semibold tracking-tight">{game.name}</h1>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-1 text-sm" aria-label="Tipo de expansión">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={href({ group: t.key === defaultGroup ? undefined : t.key })}
              className={cn(
                "rounded-md px-2.5 py-1.5",
                t.key === group ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={href({ owned: onlyOwned ? undefined : "1" })}
            className={cn(
              "rounded-md border px-2.5 py-1.5 text-sm",
              onlyOwned ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted",
            )}
            aria-pressed={onlyOwned}
          >
            Solo las que tengo
          </Link>
          <form className="flex gap-2" role="search">
            {group !== defaultGroup && <input type="hidden" name="group" value={group} />}
            {onlyOwned && <input type="hidden" name="owned" value="1" />}
            <Input
              name="q"
              defaultValue={q}
              placeholder="Buscar expansión…"
              className="w-48"
              aria-label="Buscar expansión"
            />
            <Button type="submit" variant="secondary">
              Buscar
            </Button>
          </form>
        </div>
      </div>

      {!rows.length ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          {onlyOwned ? "Aún no tienes cartas de expansiones de este tipo." : "No hay expansiones que coincidan."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Expansión</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Cartas</TableHead>
                <TableHead>Tienes</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.code}>
                  <TableCell>
                    <Link
                      href={`/catalog/${game.slug}/${s.code}`}
                      className="flex items-center gap-2 font-medium hover:underline"
                    >
                      <SetIcon src={s.iconUri} alt="" />
                      {s.name}
                      <span className="text-muted-foreground text-xs font-normal uppercase">
                        {s.code}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {setTypeLabel(game, s.setType)}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {s.releasedAt?.slice(0, 7)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatInt(s.cardCount)}</TableCell>
                  <TableCell>
                    {s.ownedDistinct > 0 ? (
                      <ProgressMeter value={s.ownedDistinct} max={s.cardCount} />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {s.ownedCopies > 0 ? formatEur(s.ownedValue) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
