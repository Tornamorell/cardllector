"use client";

import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import type { AddItemResult } from "@/app/(app)/inventory/actions";
import { CollectionPicker, type CollectionOption } from "@/components/collection-picker";
import { LocationPicker, type LocationOption } from "@/components/location-picker";
import { NextSectionButton, SectionPicker, currentSectionId } from "@/components/section-picker";
import { type StickyDefaults, useStickyDefaults, validId } from "@/lib/use-sticky-defaults";

/** The divider entries go behind: the remembered one if it's in that location, else its current one. */
function sectionFor(defaults: StickyDefaults, locations: LocationOption[]): string | null {
  const sections = locations.find((l) => l.id === defaults.lastLocationId)?.sections ?? [];
  if (!sections.length) return null;
  return validId(defaults.lastSectionId, sections) ?? currentSectionId(sections);
}

/** addItem's target fields (location, divider, collection) from the remembered settings. */
export function targetFor(defaults: StickyDefaults, locations: LocationOption[]) {
  return {
    locationId: defaults.lastLocationId,
    sectionId: sectionFor(defaults, locations),
    collectionId: defaults.entryCollectionId,
  };
}

/**
 * Where entered copies go: an optional location — and its divider, when it has them (D28) —
 * and, optionally, a collection to list them in too (D23). Remembered per device and shared by
 * every entry point: quick add, set pages, card pages, the scanner.
 */
export function EntryTarget({
  locations,
  collections,
}: {
  locations: LocationOption[];
  collections: CollectionOption[];
}) {
  const [defaults, setDefaults] = useStickyDefaults();
  const location = locations.find((l) => l.id === defaults.lastLocationId);
  const sections = location?.sections ?? [];
  const sectionId = sectionFor(defaults, locations);

  // Keep the remembered divider in step with what's shown, for entry points that don't get the
  // list of locations (the + buttons on set pages send the remembered id as is).
  useEffect(() => {
    if (sectionId !== defaults.lastSectionId) setDefaults({ lastSectionId: sectionId });
  }, [sectionId, defaults.lastSectionId, setDefaults]);

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Guardar en</span>
      <LocationPicker
        value={defaults.lastLocationId}
        locations={locations}
        onChange={(id) => setDefaults({ lastLocationId: id })}
      />
      {location && sections.length > 0 && (
        <>
          <SectionPicker
            value={sectionId}
            sections={sections}
            onChange={(id) => setDefaults({ lastSectionId: id })}
          />
          <NextSectionButton locationId={location.id} sectionId={sectionId} />
        </>
      )}
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

type Added = Extract<AddItemResult, { ok: true }>;

const GONE = {
  location_not_found: "La ubicación elegida ya no existe. Elige otra.",
  section_not_found: "El separador elegido ya no existe. Elige otro.",
  collection_not_found: "La colección elegida ya no existe. Elige otra.",
} as const;

/**
 * Applies what addItem says about the target: forgets a deleted location, divider or
 * collection, and follows an automatic move to the next divider — telling the user to put the
 * physical divider in. Returns whether the copies were added.
 */
export function useEntryResult() {
  const [, setDefaults] = useStickyDefaults();
  return useCallback(
    (r: AddItemResult): r is Added => {
      if (!r.ok) {
        setDefaults(
          r.error === "location_not_found"
            ? { lastLocationId: null, lastSectionId: null }
            : r.error === "section_not_found"
              ? { lastSectionId: null }
              : { entryCollectionId: null },
        );
        toast.error(GONE[r.error]);
        return false;
      }
      if (r.section) setDefaults({ lastSectionId: r.section.id });
      if (r.advancedFrom && r.section) {
        navigator.vibrate?.([80, 60, 80]);
        toast.warning(`Separador «${r.advancedFrom}» lleno: pon el separador «${r.section.name}»`, {
          duration: 8000,
        });
      }
      return true;
    },
    [setDefaults],
  );
}
