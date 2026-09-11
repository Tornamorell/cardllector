import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatEur, formatInt } from "@/lib/format";
import { listCollections } from "@/lib/queries/collections";
import { requireUser } from "@/lib/session";
import { createCollection } from "./actions";

export const metadata: Metadata = { title: "Colecciones" };

export default async function CollectionsPage() {
  const user = await requireUser();
  const collections = await listCollections(user.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Colecciones</h1>
        <form action={createCollection} className="flex gap-2">
          <Input name="name" placeholder="Nueva colección…" required maxLength={80} aria-label="Nombre" />
          <Button type="submit">Crear</Button>
        </form>
      </div>

      {!collections.length ? (
        <p className="text-muted-foreground text-sm">
          Aún no tienes colecciones. Crea una (por ejemplo «Carpeta Modern» o «Caja de
          comunes») y empieza a añadir cartas.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((c) => (
            <li key={c.id}>
              <Link href={`/collections/${c.id}`} className="block">
                <Card className="hover:border-foreground/30 transition-colors">
                  <CardHeader>
                    <CardTitle>{c.name}</CardTitle>
                    {c.description && <CardDescription>{c.description}</CardDescription>}
                  </CardHeader>
                  <CardContent className="flex items-baseline justify-between">
                    <span className="text-2xl font-semibold">{formatEur(c.valueEur)}</span>
                    <span className="text-muted-foreground text-sm tabular-nums">
                      {formatInt(c.cardCount)} cartas
                    </span>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
