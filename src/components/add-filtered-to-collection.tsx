"use client";

import { ListPlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addInventoryToCollection } from "@/app/(app)/inventory/actions";
import { CollectionPicker, type CollectionOption } from "@/components/collection-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * "I scanned 30 cards, now I made a collection": lists owned cards in a collection in one go —
 * what a filter shows (location, search) or specific stacks (a scan session).
 */
export function AddFilteredToCollection({
  collections,
  filter,
  label,
}: {
  collections: CollectionOption[];
  filter: { locationId?: string | null; q?: string; itemIds?: string[] };
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    if (!collectionId) return;
    startTransition(async () => {
      try {
        const r = await addInventoryToCollection({ collectionId, ...filter });
        toast.success(`${r.cards} ${r.cards === 1 ? "carta añadida" : "cartas añadidas"} a «${r.collectionName}»`);
        setOpen(false);
      } catch {
        toast.error("No se han podido añadir las cartas.");
      }
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <ListPlusIcon />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Añadir a una colección</DialogTitle>
            <DialogDescription>
              Las cartas se añaden a la lista con tantas copias como tienes, así que cuentan como
              completas. Las que ya estaban se mantienen.
            </DialogDescription>
          </DialogHeader>
          <CollectionPicker
            value={collectionId}
            onChange={setCollectionId}
            collections={collections}
            emptyLabel="Elige una colección"
            className="w-full"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={add} disabled={!collectionId || pending}>
              {pending ? "Añadiendo…" : "Añadir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
