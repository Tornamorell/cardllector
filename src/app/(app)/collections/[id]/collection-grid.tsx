"use client";

import { MoveIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CollectionPicker, type CollectionOption } from "@/components/collection-picker";
import { OwnedCardTile } from "@/components/owned-card-tile";
import { RarityMark } from "@/components/rarity-mark";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatEur, formatInt } from "@/lib/format";
import { gameById, rarityLabel } from "@/lib/games";
import type { CollectionCard } from "@/lib/queries/collections";
import { cn } from "@/lib/utils";
import { moveCollectionCards, removeCardsFromCollection } from "../actions";
import { EntryControls } from "./entry-controls";

const count = (n: number) => `${formatInt(n)} ${n === 1 ? "carta" : "cartas"}`;

/**
 * A collection's cards, selectable: ticking them brings up a bar to move them to another
 * collection — or copy them, keeping them here too — or take them off this one.
 */
export function CollectionGrid({
  collectionId,
  collectionName,
  cards,
  collections,
}: {
  collectionId: string;
  collectionName: string;
  cards: CollectionCard[];
  /** The user's other collections: where the cards can go. */
  collections: CollectionOption[];
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [dialog, setDialog] = useState<"move" | "remove" | null>(null);
  // Moved cards leave the page: count only the ones still shown.
  const chosen = cards.filter((c) => selected.has(c.id));
  const ids = chosen.map((c) => c.id);
  const clear = () => setSelected(new Set());
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {cards.map((c) => {
          const game = gameById(c.game);
          const isSelected = selected.has(c.id);
          return (
            <li
              key={c.id}
              className={cn("space-y-1.5 rounded-lg", isSelected && "ring-primary ring-offset-background ring-2 ring-offset-2")}
            >
              <OwnedCardTile
                printingId={c.id}
                name={c.name}
                number={c.collectorNumber}
                imageSmall={c.imageSmall}
                finishes={c.finishes}
                game={c.game}
                owned={c.owned}
                wanted={c.wanted}
                withCollection={false}
              />
              <div className="text-xs leading-tight">
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="accent-primary size-3.5 shrink-0"
                    checked={isSelected}
                    onChange={() => toggle(c.id)}
                    aria-label={`Seleccionar ${c.name}`}
                  />
                  <span className="truncate font-medium" title={c.name}>
                    {c.name}
                  </span>
                </label>
                <p className="text-muted-foreground flex justify-between gap-1">
                  <span title={game ? rarityLabel(game, c.rarity) : undefined}>
                    <RarityMark rarity={c.rarity} />
                    {c.setCode.toUpperCase()} #{c.collectorNumber}
                  </span>
                  <span className="tabular-nums">{formatEur(c.priceEur)}</span>
                </p>
                <EntryControls collectionId={collectionId} catalogCardId={c.id} wanted={c.wanted} name={c.name} />
              </div>
            </li>
          );
        })}
      </ul>

      {chosen.length > 0 && (
        <div
          role="region"
          aria-label="Cartas seleccionadas"
          className="bg-popover fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 shadow-lg md:bottom-6"
        >
          <span className="text-sm">
            <strong className="tabular-nums">{formatInt(chosen.length)}</strong>{" "}
            {chosen.length === 1 ? "seleccionada" : "seleccionadas"}
            {chosen.length < cards.length && (
              <>
                {" · "}
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground underline underline-offset-2"
                  onClick={() => setSelected(new Set(cards.map((c) => c.id)))}
                >
                  todas las que se ven ({formatInt(cards.length)})
                </button>
              </>
            )}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => setDialog("move")}>
              <MoveIcon />
              Mover a…
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDialog("remove")}>
              <Trash2Icon />
              Quitar
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={clear} aria-label="Quitar la selección">
              <XIcon />
            </Button>
          </div>
        </div>
      )}

      {dialog === "move" && (
        <MoveCardsDialog
          from={collectionId}
          fromName={collectionName}
          ids={ids}
          collections={collections}
          onClose={() => setDialog(null)}
          onDone={clear}
        />
      )}
      {dialog === "remove" && (
        <RemoveCardsDialog
          collectionId={collectionId}
          collectionName={collectionName}
          ids={ids}
          onClose={() => setDialog(null)}
          onDone={clear}
        />
      )}
    </>
  );
}

/** «Mover a…»: another collection (or a new one), or a copy there with «Dejarlas también aquí». */
function MoveCardsDialog({
  from,
  fromName,
  ids,
  collections,
  onClose,
  onDone,
}: {
  from: string;
  fromName: string;
  ids: string[];
  collections: CollectionOption[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [to, setTo] = useState<string | null>(null);
  const [keep, setKeep] = useState(false);
  const [pending, startTransition] = useTransition();
  const verb = keep ? "Copiar" : "Mover";

  function run() {
    if (!to) return;
    startTransition(async () => {
      try {
        const r = await moveCollectionCards({ from, to, catalogCardIds: ids, keep });
        toast.success(`${count(r.moved)} ${keep ? "copiadas" : "movidas"} a «${r.collectionName}»`);
        onDone();
        onClose();
      } catch {
        toast.error(keep ? "No se han podido copiar." : "No se han podido mover.");
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {verb} {count(ids.length)} a otra colección
          </DialogTitle>
          <DialogDescription>
            Van con las copias que quieres de cada una. Si alguna ya está en la otra colección, se queda con el
            número mayor: cada colección cuenta tus copias por su cuenta.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 text-sm [&_select]:w-full">
          <CollectionPicker value={to} onChange={setTo} collections={collections} emptyLabel="Elige una colección" />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="accent-primary size-4"
              checked={keep}
              onChange={(e) => setKeep(e.target.checked)}
            />
            Dejarlas también en «{fromName}»
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={run} disabled={pending || !to} aria-busy={pending || undefined}>
            {pending ? (keep ? "Copiando…" : "Moviendo…") : `${verb} ${count(ids.length)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** «Quitar»: off this list only; the copies owned stay in «Mis cartas». */
function RemoveCardsDialog({
  collectionId,
  collectionName,
  ids,
  onClose,
  onDone,
}: {
  collectionId: string;
  collectionName: string;
  ids: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      try {
        const r = await removeCardsFromCollection(collectionId, ids);
        toast.success(`${count(r.removed)} ${r.removed === 1 ? "quitada" : "quitadas"} de «${collectionName}»`);
        onDone();
        onClose();
      } catch {
        toast.error("No se han podido quitar.");
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            ¿Quitar {count(ids.length)} de «{collectionName}»?
          </DialogTitle>
          <DialogDescription>Solo salen de esta lista: tus copias siguen en «Mis cartas».</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={run} disabled={pending} aria-busy={pending || undefined}>
            {pending ? "Quitando…" : "Quitar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
