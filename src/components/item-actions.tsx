"use client";

import { MinusIcon, MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addInventoryToCollection,
  changeQuantity,
  deleteItem,
  splitItem,
  updateItem,
} from "@/app/(app)/inventory/actions";
import { CollectionPicker, type CollectionOption } from "@/components/collection-picker";
import { LocationPicker, type LocationOption } from "@/components/location-picker";
import { ConditionSelect, FinishSelect, LanguageSelect } from "@/components/stack-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CONDITIONS } from "@/lib/format";
import { gameById } from "@/lib/games";

export function QuantityControl({ itemId, quantity }: { itemId: string; quantity: number }) {
  const [pending, startTransition] = useTransition();
  const change = (delta: 1 | -1) =>
    startTransition(async () => {
      try {
        await changeQuantity(itemId, delta);
      } catch {
        toast.error("No se ha podido cambiar la cantidad.");
      }
    });

  return (
    <div className="flex items-center justify-center gap-1">
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => change(-1)}
        // Removing the last copy is a deletion: done from the menu, on purpose.
        disabled={pending || quantity <= 1}
        aria-label="Una copia menos"
      >
        <MinusIcon />
      </Button>
      <span className="w-8 text-center tabular-nums">{quantity}</span>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => change(1)}
        disabled={pending}
        aria-label="Una copia más"
      >
        <PlusIcon />
      </Button>
    </div>
  );
}

export interface ActionItem {
  id: string;
  catalogCardId: string | null;
  game: string | null;
  name: string;
  quantity: number;
  finish: "nonfoil" | "foil" | "etched";
  condition: (typeof CONDITIONS)[number];
  language: string;
  locationId: string | null;
  notes: string | null;
  purchasePriceEur: number | null;
  finishes: string[];
}

export function ItemActions({
  item,
  locations,
  collections,
}: {
  item: ActionItem;
  locations: LocationOption[];
  collections: CollectionOption[];
}) {
  const [dialog, setDialog] = useState<"edit" | "collection" | "split" | "delete" | null>(null);
  const close = () => setDialog(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label={`Acciones para ${item.name}`} />}
        >
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => setDialog("edit")}>Editar</DropdownMenuItem>
          {item.catalogCardId && (
            <DropdownMenuItem onClick={() => setDialog("collection")}>
              Añadir a una colección
            </DropdownMenuItem>
          )}
          {item.quantity > 1 && (
            <DropdownMenuItem onClick={() => setDialog("split")}>Dividir montón</DropdownMenuItem>
          )}
          <DropdownMenuItem variant="destructive" onClick={() => setDialog("delete")}>
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Mounted only while open, so each opening starts from the current values. */}
      {dialog === "edit" && <EditDialog item={item} locations={locations} onClose={close} />}
      {dialog === "collection" && (
        <CollectionDialog item={item} collections={collections} onClose={close} />
      )}
      {dialog === "split" && <SplitDialog item={item} onClose={close} />}
      {dialog === "delete" && <DeleteDialog item={item} onClose={close} />}
    </>
  );
}

function EditDialog({
  item,
  locations,
  onClose,
}: {
  item: ActionItem;
  locations: LocationOption[];
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    quantity: String(item.quantity),
    finish: item.finish,
    condition: item.condition,
    language: item.language,
    locationId: item.locationId,
    purchasePriceEur: item.purchasePriceEur == null ? "" : String(item.purchasePriceEur),
    notes: item.notes ?? "",
  });
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  function save(event: React.FormEvent) {
    event.preventDefault();
    const price = form.purchasePriceEur.trim().replace(",", ".");
    startTransition(async () => {
      try {
        await updateItem(item.id, {
          quantity: Number(form.quantity),
          finish: form.finish,
          condition: form.condition,
          language: form.language,
          locationId: form.locationId,
          purchasePriceEur: price === "" ? null : Number(price),
          notes: form.notes,
        });
        toast.success("Cambios guardados");
        onClose();
      } catch {
        toast.error("Revisa los datos: no se han podido guardar.");
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={save} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Editar {item.name}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cantidad" htmlFor="edit-qty">
              <Input
                id="edit-qty"
                type="number"
                min={1}
                max={999}
                value={form.quantity}
                onChange={(e) => set({ quantity: e.target.value })}
                required
              />
            </Field>
            <Field label="Acabado" htmlFor="edit-finish">
              <FinishSelect
                id="edit-finish"
                value={form.finish}
                available={item.finishes}
                labels={gameById(item.game)?.finishLabels}
                onChange={(finish) => set({ finish })}
              />
            </Field>
            <Field label="Estado" htmlFor="edit-condition">
              <ConditionSelect
                id="edit-condition"
                value={form.condition}
                onChange={(condition) => set({ condition })}
              />
            </Field>
            <Field label="Idioma" htmlFor="edit-language">
              <LanguageSelect
                id="edit-language"
                value={form.language}
                onChange={(language) => set({ language })}
              />
            </Field>
            <Field label="Ubicación" htmlFor="edit-location">
              <LocationPicker
                id="edit-location"
                value={form.locationId}
                locations={locations}
                onChange={(locationId) => set({ locationId })}
              />
            </Field>
            <Field label="Precio de compra (€/u)" htmlFor="edit-price">
              <Input
                id="edit-price"
                inputMode="decimal"
                value={form.purchasePriceEur}
                onChange={(e) => set({ purchasePriceEur: e.target.value })}
                placeholder="0,00"
              />
            </Field>
          </div>
          <Field label="Notas" htmlFor="edit-notes">
            <Textarea
              id="edit-notes"
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
              rows={2}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CollectionDialog({
  item,
  collections,
  onClose,
}: {
  item: ActionItem;
  collections: CollectionOption[];
  onClose: () => void;
}) {
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Añadir {item.name} a una colección</DialogTitle>
          <DialogDescription>
            La carta se añade a la lista. Tus copias siguen donde están.
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
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!collectionId || pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  const r = await addInventoryToCollection({ collectionId: collectionId!, itemIds: [item.id] });
                  toast.success(`${item.name} está en «${r.collectionName}»`);
                  onClose();
                } catch {
                  toast.error("No se ha podido añadir a la colección.");
                }
              })
            }
          >
            Añadir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SplitDialog({ item, onClose }: { item: ActionItem; onClose: () => void }) {
  const [count, setCount] = useState("1");
  const [pending, startTransition] = useTransition();

  function split(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      try {
        await splitItem(item.id, Number(count));
        toast.success("Montón dividido. Edita el nuevo para cambiar su estado o ubicación.");
        onClose();
      } catch {
        toast.error("No se ha podido dividir el montón.");
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={split} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Dividir montón</DialogTitle>
            <DialogDescription>
              Separa copias de {item.name} (tienes {item.quantity}) en un montón nuevo, por
              ejemplo para marcar una con otro estado o moverla a otra ubicación.
            </DialogDescription>
          </DialogHeader>
          <Field label="Copias a separar" htmlFor="split-count">
            <Input
              id="split-count"
              type="number"
              min={1}
              max={item.quantity - 1}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              required
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              Dividir
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ item, onClose }: { item: ActionItem; onClose: () => void }) {
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Eliminar {item.name}?</DialogTitle>
          <DialogDescription>
            Se quitará{item.quantity > 1 ? `n las ${item.quantity} copias` : " la copia"} de tus
            cartas. Las colecciones que la incluyen la seguirán listando, como carta que te falta.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  await deleteItem(item.id);
                  onClose();
                } catch {
                  toast.error("No se ha podido eliminar.");
                }
              })
            }
          >
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5 [&_select]:w-full">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
