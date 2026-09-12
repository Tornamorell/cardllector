"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { moveItems } from "@/app/(app)/inventory/actions";
import { LocationPicker, type LocationOption } from "@/components/location-picker";
import { SectionPicker, currentSectionId } from "@/components/section-picker";
import { QuantityStepper } from "@/components/stack-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatInt, placeLabel } from "@/lib/format";
import { useStickyDefaults } from "@/lib/use-sticky-defaults";

/**
 * Moves stacks to another location and divider (D28). It starts on the session's location,
 * the usual destination ("these go to Caja 1"). With a single stack of several copies, you can
 * move just some of them.
 */
export function MoveDialog({
  itemIds,
  title,
  maxCount,
  locations,
  onClose,
  onMoved,
}: {
  itemIds: string[];
  title: string;
  /** Copies in the stack, when moving a single one. */
  maxCount?: number;
  locations: LocationOption[];
  onClose: () => void;
  onMoved?: () => void;
}) {
  const [defaults] = useStickyDefaults();
  const sectionsOf = (id: string | null) => locations.find((l) => l.id === id)?.sections ?? [];
  const [locationId, setLocationId] = useState<string | null>(defaults.lastLocationId);
  const [sectionId, setSectionId] = useState<string | null>(() =>
    currentSectionId(sectionsOf(defaults.lastLocationId)),
  );
  const [count, setCount] = useState(maxCount ?? 1);
  const [pending, startTransition] = useTransition();
  const sections = sectionsOf(locationId);
  const partial = itemIds.length === 1 && (maxCount ?? 1) > 1;

  function move() {
    startTransition(async () => {
      try {
        const r = await moveItems({
          itemIds,
          locationId,
          sectionId: sections.length ? sectionId : null,
          ...(partial && { count }),
        });
        const place = placeLabel(r.locationName, r.sectionName) ?? "sin ubicación";
        toast.success(
          r.moved
            ? `${formatInt(r.moved)} ${r.moved === 1 ? "carta movida" : "cartas movidas"} a ${place}`
            : `Ya estaban en ${place}`,
        );
        onMoved?.();
        onClose();
      } catch {
        toast.error("No se han podido mover las cartas.");
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Si en el destino ya hay copias iguales, se juntan en el mismo montón.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 [&_select]:w-full">
          <div className="grid gap-1.5">
            <Label htmlFor="move-location">Ubicación</Label>
            <LocationPicker
              id="move-location"
              value={locationId}
              locations={locations}
              onChange={(id) => {
                setLocationId(id);
                setSectionId(currentSectionId(sectionsOf(id)));
              }}
            />
          </div>
          {sections.length > 0 && (
            <div className="grid gap-1.5">
              <Label htmlFor="move-section">Separador</Label>
              <SectionPicker
                id="move-section"
                value={sectionId}
                sections={sections}
                allowNone
                onChange={setSectionId}
              />
            </div>
          )}
          {partial && (
            <div className="flex items-center gap-2">
              <span className="text-sm">Copias a mover</span>
              <QuantityStepper value={count} onChange={(v) => setCount(Math.min(v, maxCount!))} />
              <span className="text-muted-foreground text-sm">de {maxCount}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={move} disabled={pending}>
            {pending ? "Moviendo…" : "Mover"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
