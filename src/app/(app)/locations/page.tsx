import type { Metadata } from "next";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatEur, formatInt } from "@/lib/format";
import { listLocations, unlocatedSummary } from "@/lib/queries/locations";
import { requireUser } from "@/lib/session";
import { NewLocationForm } from "./new-location-form";

export const metadata: Metadata = { title: "Ubicaciones" };

export default async function LocationsPage() {
  const user = await requireUser();
  const [locations, unlocated] = await Promise.all([
    listLocations(user.id),
    unlocatedSummary(user.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Ubicaciones</h1>
          <p className="text-muted-foreground max-w-prose text-sm">
            Dónde están físicamente tus cartas: cajas, carpetas, mazos… Son independientes de las
            colecciones. Al añadir o escanear, elige la ubicación una vez y todo lo que metas irá
            ahí hasta que la cambies.
          </p>
        </div>
        <NewLocationForm />
      </div>

      {!locations.length && !unlocated.cardCount ? (
        <p className="text-muted-foreground text-sm">
          Aún no tienes ubicaciones. Crea la primera (por ejemplo «Caja 1»).
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ubicación</TableHead>
                <TableHead className="text-right">Cartas</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <Link href={`/locations/${l.id}`} className="font-medium hover:underline">
                      {l.name}
                    </Link>
                    {l.description && (
                      <p className="text-muted-foreground text-xs">{l.description}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatInt(l.cardCount)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatEur(l.valueEur)}</TableCell>
                </TableRow>
              ))}
              {unlocated.cardCount > 0 && (
                <TableRow>
                  <TableCell>
                    <Link href="/locations/none" className="text-muted-foreground italic hover:underline">
                      Sin ubicación
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatInt(unlocated.cardCount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatEur(unlocated.valueEur)}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
