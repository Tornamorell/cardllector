"use client";

import { CollectionPicker, type CollectionOption } from "@/components/collection-picker";
import { LocationPicker, type LocationOption } from "@/components/location-picker";
import { useStickyDefaults } from "@/lib/use-sticky-defaults";

/**
 * Where entered copies go: an optional location and, optionally, a collection to list them in
 * too (D23). Remembered per device and shared by every entry point — quick add, set pages,
 * card pages, the scanner.
 */
export function EntryTarget({
  locations,
  collections,
}: {
  locations: LocationOption[];
  collections: CollectionOption[];
}) {
  const [defaults, setDefaults] = useStickyDefaults();
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Guardar en</span>
      <LocationPicker
        value={defaults.lastLocationId}
        locations={locations}
        onChange={(id) => setDefaults({ lastLocationId: id })}
      />
      <span className="text-muted-foreground">y añadir a</span>
      <CollectionPicker
        value={defaults.entryCollectionId}
        collections={collections}
        emptyLabel="Ninguna colección"
        onChange={(id) => setDefaults({ entryCollectionId: id })}
      />
    </div>
  );
}
