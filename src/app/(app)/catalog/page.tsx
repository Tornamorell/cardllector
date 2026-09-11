import type { Metadata } from "next";
import Link from "next/link";
import { CardFan } from "@/components/card-fan";
import { Badge } from "@/components/ui/badge";
import { formatInt } from "@/lib/format";
import { GAMES } from "@/lib/games";
import { catalogStats, gameShowcase } from "@/lib/queries/catalog";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Catálogo" };

export default async function CatalogPage() {
  await requireUser();
  const [stats, ...showcases] = await Promise.all([
    catalogStats(),
    ...GAMES.map((g) => (g.available ? gameShowcase(g.id) : Promise.resolve([]))),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Catálogo</h1>
        <p className="text-muted-foreground text-sm">
          Elige un juego para explorar sus expansiones, rarezas y lo que te falta.
        </p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2">
        {GAMES.map((game, i) => {
          const s = stats.find((x) => x.game === game.id);
          const content = (
            <div
              className={cn(
                "bg-card flex h-full flex-col overflow-hidden rounded-2xl border",
                game.available && "hover:border-primary/60 transition-colors",
              )}
            >
              {/* The game's most valuable cards, fanned: what the catalog holds, not an icon. */}
              <div className="flex h-44 items-end justify-center overflow-hidden pt-4">
                <CardFan
                  size="sm"
                  cards={showcases[i].map((c) => ({ src: c.image, alt: c.name }))}
                />
              </div>
              <div className="space-y-1 border-t p-4">
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  {game.name}
                  {!game.available && <Badge variant="secondary">Próximamente</Badge>}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {game.available && s
                    ? `${formatInt(s.sets)} expansiones y ${formatInt(s.cards)} cartas`
                    : "Aún no hay datos de este juego."}
                </p>
              </div>
            </div>
          );
          return (
            <li key={game.id}>
              {game.available ? (
                <Link href={`/catalog/${game.slug}`} className="block h-full">
                  {content}
                </Link>
              ) : (
                <div className="h-full opacity-60">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
