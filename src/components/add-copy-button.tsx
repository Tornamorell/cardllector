"use client";

import { PlusIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { addItem } from "@/app/(app)/inventory/actions";
import { useEntryResult } from "@/components/entry-target";
import { finishFor } from "@/components/stack-fields";
import { Button } from "@/components/ui/button";
import { placeLabel } from "@/lib/format";
import { useStickyDefaults } from "@/lib/use-sticky-defaults";

/**
 * "+" on a card image: adds one copy to the inventory with the remembered location (and
 * divider), finish, condition and language — and the remembered collection, unless
 * `withCollection` is off (on a collection's own page the card is already listed). Taps are
 * never blocked: each one adds a copy, and `onStart` lets the tile count it straight away.
 */
export function AddCopyButton({
  printingId,
  finishes,
  name,
  withCollection = true,
  onStart,
}: {
  printingId: string;
  finishes: string[];
  name: string;
  withCollection?: boolean;
  /** Called inside the transition before the request: the place for an optimistic update. */
  onStart?: () => void;
}) {
  const [defaults] = useStickyDefaults();
  const follow = useEntryResult();
  const [, startTransition] = useTransition();

  return (
    <Button
      size="icon-sm"
      variant="secondary"
      className="absolute top-1.5 right-1.5 shadow-sm active:scale-90"
      aria-label={`Añadir ${name} a mis cartas`}
      onClick={() =>
        startTransition(async () => {
          onStart?.();
          try {
            const r = await addItem({
              catalogCardId: printingId,
              quantity: 1,
              finish: finishFor(defaults.finish, finishes),
              condition: defaults.condition,
              language: defaults.language,
              // The page's EntryTarget keeps the remembered divider valid for this location.
              locationId: defaults.lastLocationId,
              sectionId: defaults.lastLocationId ? defaults.lastSectionId : null,
              collectionId: withCollection ? defaults.entryCollectionId : null,
            });
            // The action revalidates the page, so the real count replaces the optimistic one.
            if (!follow(r)) return;
            const place = placeLabel(r.locationName, r.section?.name);
            toast.success(`${r.name} añadida`, {
              description: [
                r.merged ? `Tienes ${r.quantity}` : undefined,
                place && `en ${place}`,
                r.collectionName && `y en «${r.collectionName}»`,
              ]
                .filter(Boolean)
                .join(" "),
            });
          } catch {
            toast.error(`No se ha podido añadir ${name}.`);
          }
        })
      }
    >
      <PlusIcon />
    </Button>
  );
}
