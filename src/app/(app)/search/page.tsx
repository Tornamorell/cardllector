import type { Metadata } from "next";
import Link from "next/link";
import { CardThumb } from "@/components/card-thumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { gameById } from "@/lib/games";
import { searchCards } from "@/lib/queries/search";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Buscar" };

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  await requireUser();
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const results = query ? await searchCards(query, 48) : [];

  return (
    <div className="space-y-6">
      <form className="flex max-w-xl gap-2" role="search">
        <Input
          name="q"
          defaultValue={query}
          placeholder="Magic o Pokémon, en inglés o en español…"
          autoFocus
          autoComplete="off"
          aria-label="Buscar carta"
        />
        <Button type="submit">Buscar</Button>
      </form>

      {query && !results.length && (
        <p className="text-muted-foreground text-sm">No hay cartas que coincidan con «{query}».</p>
      )}

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {results.map((r) => (
          <li key={r.oracleId}>
            <Link href={`/cards/${r.printingId}`} className="group block space-y-2">
              <CardThumb
                src={r.imageSmall}
                alt={r.name}
                size="md"
                className="w-full! transition-transform group-hover:-translate-y-0.5"
              />
              <div className="text-sm leading-tight">
                <p className="font-medium group-hover:underline">{r.name}</p>
                {r.printedName && <p className="text-muted-foreground">{r.printedName}</p>}
                <p className="text-muted-foreground text-xs">
                  {gameById(r.game)?.shortName} · {r.printings}{" "}
                  {r.printings === 1 ? "edición" : "ediciones"}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
