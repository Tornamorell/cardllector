"use client";

import Link from "next/link";
import { LocationPicker, type LocationOption } from "@/components/location-picker";
import { selectClass } from "@/components/stack-fields";
import { useStickyDefaults, validId } from "@/lib/use-sticky-defaults";

/**
 * Where new copies go: collection and location. Remembered per device and shared by every
 * entry point (quick add, set pages, scanner) — "from now on, everything goes to Caja 1".
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
