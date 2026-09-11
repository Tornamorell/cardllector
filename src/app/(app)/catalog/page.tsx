import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatInt } from "@/lib/format";
import { GAMES } from "@/lib/games";
import { catalogStats } from "@/lib/queries/catalog";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Catálogo" };

export default async function CatalogPage() {
  await requireUser();
  const stats = await catalogStats();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Catálogo</h1>
        <p className="text-muted-foreground text-sm">
          Elige un juego para explorar sus expansiones, rarezas y lo que te falta.
        </p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2">
        {GAMES.map((game) => {
          const s = stats.find((x) => x.game === game.id);
          const card = (
            <Card className={game.available ? "hover:border-foreground/30 transition-colors" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {game.name}
                  {!game.available && <Badge variant="secondary">Próximamente</Badge>}
                </CardTitle>
                <CardDescription>
                  {game.available && s
                    ? `${formatInt(s.sets)} expansiones · ${formatInt(s.cards)} cartas`
                    : "Aún no hay datos de este juego."}
                </CardDescription>
              </CardHeader>
            </Card>
          );
          return (
            <li key={game.id}>
              {game.available ? (
                <Link href={`/catalog/${game.slug}`} className="block">
                  {card}
                </Link>
              ) : (
                <div className="opacity-60">{card}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
