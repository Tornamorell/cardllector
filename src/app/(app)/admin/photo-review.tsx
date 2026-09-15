"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteCardPhoto } from "@/app/(app)/cards/photo-actions";
import { CardThumb } from "@/components/card-thumb";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { markPhotoReviewed } from "./actions";

export type PhotoItem = {
  catalogCardId: string;
  name: string;
  /** "SV03.5 #009". */
  setLabel: string;
  src: string;
  contributor: string | null;
  source: string;
  dateLabel: string;
  reviewed: boolean;
  reviewer: string | null;
};

/**
 * The photos people shared for cards without an image (D30), for an admin to check: «Correcta»
 * takes one off the pending ones; «Eliminar» deletes it, and the card has no image again.
 */
export function PhotoReview({ photos }: { photos: PhotoItem[] }) {
  if (!photos.length) {
    return <p className="text-muted-foreground text-sm">Nadie ha compartido fotos todavía.</p>;
  }
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {photos.map((p) => (
        <PhotoTile key={p.catalogCardId} photo={p} />
      ))}
    </ul>
  );
}

function PhotoTile({ photo: p }: { photo: PhotoItem }) {
  const [reviewing, startReview] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const busy = reviewing || deleting;

  function review() {
    startReview(async () => {
      try {
        const r = await markPhotoReviewed(p.catalogCardId);
        if (r.error) toast.error(r.error);
        else toast.success(`Foto de ${p.name} marcada como correcta`);
      } catch {
        toast.error("No se ha podido guardar.");
      }
    });
  }

  function remove() {
    startDelete(async () => {
      try {
        const r = await deleteCardPhoto(p.catalogCardId);
        if (r.deleted) toast.success(`Foto de ${p.name} eliminada: la carta vuelve a estar sin imagen.`);
        else toast.error("No se ha podido eliminar.");
      } catch {
        toast.error("No se ha podido eliminar.");
      }
    });
  }

  return (
    <li className={cn("space-y-1.5", p.reviewed && "opacity-70")}>
      <Link href={`/cards/${p.catalogCardId}`} className="block">
        <CardThumb src={p.src} alt={p.name} size="md" className="w-full!" />
      </Link>
      <div className="space-y-0.5 text-xs leading-tight">
        <p className="truncate font-medium" title={p.name}>
          {p.name}
        </p>
        <p className="text-muted-foreground truncate">{p.setLabel}</p>
        <p className="text-muted-foreground truncate">
          {p.contributor ?? "Cuenta borrada"} · {p.source === "scan" ? "escáner" : "subida"} · {p.dateLabel}
        </p>
        {p.reviewed && (
          <p className="text-emerald-700 dark:text-emerald-400">✓ Revisada{p.reviewer && ` por ${p.reviewer}`}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {!p.reviewed && !confirming && (
          <Button size="xs" onClick={review} disabled={busy} aria-busy={reviewing || undefined}>
            {reviewing ? "Guardando…" : "Correcta"}
          </Button>
        )}
        {confirming ? (
          <>
            <Button size="xs" variant="destructive" onClick={remove} disabled={busy} aria-busy={deleting || undefined}>
              {deleting ? "Eliminando…" : "Sí, eliminar"}
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
              No
            </Button>
          </>
        ) : (
          <Button size="xs" variant="ghost" onClick={() => setConfirming(true)} disabled={busy}>
            Eliminar
          </Button>
        )}
      </div>
    </li>
  );
}
