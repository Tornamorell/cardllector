"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { addItem } from "@/app/(app)/inventory/actions";
import { finishFor } from "@/components/stack-fields";
import { Button } from "@/components/ui/button";
import { useStickyDefaults } from "@/lib/use-sticky-defaults";

/**
 * "+" on a card image: adds one copy to the inventory with the remembered location, finish,
 * condition and language — and the remembered collection, unless `withCollection` is off
 * (on a collection's own page the card is already listed).
 */
export function AddCopyButton({
  printingId,
  finishes,
  name,
  withCollection = true,
}: {
  printingId: string;
  finishes: string[];
  name: string;
  withCollection?: boolean;
}) {
  const [defaults, setDefaults] = useStickyDefaults();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="icon-sm"
      variant="secondary"
      className="absolute top-1.5 right-1.5 shadow-sm"
      disabled={pending}
      aria-label={`Añadir ${name} a mis cartas`}
      onClick={() =>
        startTransition(async () => {
          try {
            const r = await addItem({
              catalogCardId: printingId,
              quantity: 1,
              finish: finishFor(defaults.finish, finishes),
              condition: defaults.condition,
              language: defaults.language,
              locationId: defaults.lastLocationId,
              collectionId: withCollection ? defaults.entryCollectionId : null,
            });
            if (!r.ok) {
              setDefaults(r.error === "location_not_found" ? { lastLocationId: null } : { entryCollectionId: null });
              toast.error("La ubicación o colección elegida ya no existe. Elige otra.");
              return;
            }
            toast.success(`${r.name} añadida`, {
              description: [
                r.merged ? `Tienes ${r.quantity}` : undefined,
                r.locationName && `en ${r.locationName}`,
                r.collectionName && `y en «${r.collectionName}»`,
              ]
                .filter(Boolean)
                .join(" "),
            });
            router.refresh();
          } catch {
            toast.error("No se ha podido añadir la carta.");
          }
        })
      }
    >
      <PlusIcon />
    </Button>
  );
}
