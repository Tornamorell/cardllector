import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { listPendingScans } from "@/lib/queries/pending-scans";
import { requireUser } from "@/lib/session";
import { PendingScanCard } from "./pending-scan-card";

export const metadata: Metadata = { title: "Por revisar" };

export default async function ReviewPage() {
  const user = await requireUser();
  const scans = await listPendingScans(user.id);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Por revisar</h1>
        <p className="text-muted-foreground max-w-prose text-sm">
          Cartas que el escáner no reconoció y guardaste con «Para luego». Búscalas por su nombre y
          añádelas: irán a la ubicación y la colección que tenía la sesión.
        </p>
      </div>

      {!scans.length ? (
        <div className="space-y-3 py-10 text-center">
          <p className="text-muted-foreground">No tienes nada por revisar.</p>
          <Link href="/scan" className={buttonVariants({ variant: "outline" })}>
            Ir al escáner
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {scans.map((scan) => (
            <li key={scan.id}>
              <PendingScanCard scan={scan} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
