"use client";

import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { LocationPicker, type LocationOption } from "@/components/location-picker";
import { finishFor, selectClass } from "@/components/stack-fields";
import { Button } from "@/components/ui/button";
import { useStickyDefaults, validId } from "@/lib/use-sticky-defaults";
import { addItem } from "../../../collections/actions";

/**
 * Where the "+" buttons add to: collection and location. Remembered per device and shared
 * with the other entry forms.
 */
export function AddTargetPicker({
  collections,
  locations,
}: {
  collections: Array<{ id: string; name: string }>;
  locations: LocationOption[];
}) {
  const [defaults, setDefaults] = useStickyDefaults();

  if (!collections.length) {
    return (
      <Link href="/collections" className="text-sm underline">
        Crea una colección para añadir cartas
      </Link>
    );
  }

  const collectionId = validId(defaults.lastCollectionId, collections) ?? collections[0].id;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Añadir a</span>
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
      <span className="text-muted-foreground">en</span>
      <LocationPicker
        value={defaults.lastLocationId}
        locations={locations}
        onChange={(id) => setDefaults({ lastLocationId: id })}
      />
    </div>
  );
}

/** Adds one copy with the remembered collection, location, finish, condition and language. */
export function AddOneButton({
  printingId,
  finishes,
  name,
  collectionIds,
}: {
  printingId: string;
  finishes: string[];
  name: string;
  collectionIds: string[];
}) {
  const [defaults, setDefaults] = useStickyDefaults();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const collectionId =
    validId(defaults.lastCollectionId, collectionIds.map((id) => ({ id }))) ?? collectionIds[0];
  if (!collectionId) return null;

  return (
    <Button
      size="icon-sm"
      variant="secondary"
      className="absolute top-1.5 right-1.5 shadow-sm"
      disabled={pending}
      aria-label={`Añadir ${name}`}
      onClick={() =>
        startTransition(async () => {
          try {
            const r = await addItem({
              collectionId,
              catalogCardId: printingId,
              quantity: 1,
              finish: finishFor(defaults.finish, finishes),
              condition: defaults.condition,
              language: defaults.language,
              locationId: defaults.lastLocationId,
            });
            if (!r.ok) {
              setDefaults({ lastLocationId: null });
              toast.error("La ubicación elegida ya no existe. Elige otra.");
              return;
            }
            toast.success(`${r.name} añadida`, {
              description: [r.merged && `${r.quantity} en ese montón`, r.locationName]
                .filter(Boolean)
                .join(" · "),
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
