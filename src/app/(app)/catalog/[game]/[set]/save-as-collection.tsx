"use client";

import { ListPlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addSetToCollection, createCollectionFromSet } from "@/app/(app)/collections/actions";
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
import { Input } from "@/components/ui/input";
import { formatInt } from "@/lib/format";

type Props = {
  game: string;
  setCode: string;
  setTitle: string;
  total: number;
  /** The rarity filter active on the page, offered as "solo las Rare". */
  rarity: { value: string; label: string; count: number } | null;
  collections: CollectionOption[];
};

/** «Guardar como colección…»: a whole set, or one rarity of it, as a new or existing collection. */
export function SaveSetAsCollection(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <ListPlusIcon />
        Guardar como colección…
      </Button>
      {/* Mounted only while open, so it starts from the page's current filter. */}
      {open && <SaveDialog {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function SaveDialog({
  game,
  setCode,
  setTitle,
  total,
  rarity,
  collections,
  onClose,
}: Props & { onClose: () => void }) {
  const router = useRouter();
  const defaultName = (only: boolean) => (only && rarity ? `${setTitle} · ${rarity.label}` : setTitle);
  const [onlyRarity, setOnlyRarity] = useState(!!rarity);
  const [name, setName] = useState(defaultName(!!rarity));
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const count = onlyRarity && rarity ? rarity.count : total;
  const scope = { game: game as "mtg" | "pokemon" | "sports", setCode, rarity: onlyRarity && rarity ? rarity.value : null };

  function save() {
    startTransition(async () => {
      try {
        if (mode === "new") {
          const r = await createCollectionFromSet({ ...scope, name });
          toast.success(`Colección creada con ${formatInt(r.added)} cartas`);
          router.push(`/collections/${r.id}`);
        } else {
          const r = await addSetToCollection(collectionId!, scope);
          toast.success(`${formatInt(r.added)} cartas en «${r.collectionName}»`);
          onClose();
        }
      } catch {
        toast.error("No se ha podido guardar la colección.");
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Guardar {setTitle} como colección</DialogTitle>
          <DialogDescription>
            Se añade una de cada carta, las tengas o no. La colección te dirá cuáles te faltan y
            cuánto costaría completarla.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          {rarity && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="accent-primary size-4"
                checked={onlyRarity}
                onChange={(e) => {
                  const only = e.target.checked;
                  // Follow the default name unless it was edited.
                  if (name === defaultName(onlyRarity)) setName(defaultName(only));
                  setOnlyRarity(only);
                }}
              />
              Solo las {rarity.label} ({formatInt(rarity.count)} de {formatInt(total)})
            </label>
          )}
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="save-mode"
              className="accent-primary size-4"
              checked={mode === "new"}
              onChange={() => setMode("new")}
            />
            Crear una colección nueva
          </label>
          {mode === "new" && (
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              aria-label="Nombre de la colección"
              className="ml-6 w-auto"
            />
          )}
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="save-mode"
              className="accent-primary size-4"
              checked={mode === "existing"}
              onChange={() => setMode("existing")}
            />
            Añadirlas a una colección que ya tengo
          </label>
          {mode === "existing" && (
            <div className="ml-6 [&_select]:w-full">
              <CollectionPicker
                value={collectionId}
                onChange={setCollectionId}
                collections={collections}
                emptyLabel="Elige una colección"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={save}
            disabled={pending || (mode === "new" ? !name.trim() : !collectionId)}
            aria-busy={pending}
          >
            {pending
              ? "Guardando…"
              : mode === "new"
                ? `Crear con ${formatInt(count)} cartas`
                : `Añadir ${formatInt(count)} cartas`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
