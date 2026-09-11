"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { LocationPicker, type LocationOption } from "@/components/location-picker";
import {
  ConditionSelect,
  FinishSelect,
  LanguageSelect,
  finishFor,
  selectClass,
} from "@/components/stack-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Finish } from "@/lib/games";
import { useStickyDefaults, validId } from "@/lib/use-sticky-defaults";
import { addItem } from "../../collections/actions";

export function AddToCollection({
  printingId,
  finishes,
  finishLabels,
  collections,
  locations,
}: {
  printingId: string;
  finishes: string[];
  finishLabels?: Record<Finish, string>;
  collections: Array<{ id: string; name: string }>;
  locations: LocationOption[];
}) {
  const [defaults, setDefaults] = useStickyDefaults();
  const [quantity, setQuantity] = useState(1);
  const [pending, startTransition] = useTransition();

  if (!collections.length) {
    return (
      <p className="text-muted-foreground text-sm">
        <Link href="/collections" className="underline">
          Crea una colección
        </Link>{" "}
        para empezar a añadir cartas.
      </p>
    );
  }

  const collectionId = validId(defaults.lastCollectionId, collections) ?? collections[0].id;
  const finish = finishFor(defaults.finish, finishes);

  function add() {
    startTransition(async () => {
      try {
        const result = await addItem({
          collectionId,
          catalogCardId: printingId,
          quantity,
          finish,
          condition: defaults.condition,
          language: defaults.language,
          locationId: defaults.lastLocationId,
        });
        if (!result.ok) {
          setDefaults({ lastLocationId: null });
          toast.error("La ubicación elegida ya no existe. Elige otra.");
          return;
        }
        toast.success(`${result.name} añadida`, {
          description: [
            result.merged && `Ahora tienes ${result.quantity} en ese montón.`,
            result.locationName && `En ${result.locationName}.`,
          ]
            .filter(Boolean)
            .join(" "),
        });
        setQuantity(1);
      } catch {
        toast.error("No se ha podido añadir la carta.");
      }
    });
  }

  return (
    <div className="bg-muted/40 flex flex-wrap items-end gap-2 rounded-lg border p-3">
      <select
        className={selectClass}
        value={collectionId}
        onChange={(e) => setDefaults({ lastCollectionId: e.target.value })}
        aria-label="Colección"
      >
        {collections.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <LocationPicker
        value={defaults.lastLocationId}
        locations={locations}
        onChange={(id) => setDefaults({ lastLocationId: id })}
      />
      <FinishSelect
        value={finish}
        available={finishes}
        labels={finishLabels}
        onChange={(v) => setDefaults({ finish: v })}
      />
      <ConditionSelect value={defaults.condition} onChange={(v) => setDefaults({ condition: v })} />
      <LanguageSelect value={defaults.language} onChange={(v) => setDefaults({ language: v })} />
      <Input
        type="number"
        min={1}
        max={999}
        value={quantity}
        onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
        className="w-20"
        aria-label="Cantidad"
      />
      <Button onClick={add} disabled={pending}>
        {pending ? "Añadiendo…" : "Añadir"}
      </Button>
    </div>
  );
}
