"use client";

import { PlusIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { addItem } from "@/app/(app)/inventory/actions";
import { useEntryResult } from "@/components/entry-target";
import { finishFor } from "@/components/stack-fields";
import { Button } from "@/components/ui/button";
import { placeLabel } from "@/lib/format";
import type { Finish } from "@/lib/games";
import { useStickyDefaults } from "@/lib/use-sticky-defaults";
import { cn } from "@/lib/utils";

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
  finish,
  finishName,
  look = "plain",
  className,
}: {
  printingId: string;
  finishes: string[];
  name: string;
  withCollection?: boolean;
  /** Called inside the transition before the request: the place for an optimistic update. */
  onStart?: () => void;
  /** This finish instead of the remembered one: a tile with a + for each (Pokémon's reverse holo). */
  finish?: Finish;
  /** That finish's name in the card's game, for the label and the toast («Reverse holo»). */
  finishName?: string;
  /** "foil": the foil film, for the + that adds a foil copy. */
  look?: "plain" | "foil";
  className?: string;
}) {
  const [defaults] = useStickyDefaults();
  const follow = useEntryResult();
  const [, startTransition] = useTransition();
  const label = `Añadir ${name}${finishName ? ` en ${finishName}` : ""} a mis cartas`;

  return (
    <Button
      size="icon-sm"
      variant="secondary"
      className={cn(
        "absolute top-1.5 right-1.5 shadow-sm active:scale-90",
        look === "foil" && "foil-button text-[#1b1630]",
        className,
      )}
      aria-label={label}
      title={label}
      onClick={() =>
        startTransition(async () => {
          onStart?.();
          try {
            const r = await addItem({
              catalogCardId: printingId,
              quantity: 1,
              finish: finish ?? finishFor(defaults.finish, finishes),
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
            toast.success(`${r.name}${finishName ? ` (${finishName})` : ""} añadida`, {
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
