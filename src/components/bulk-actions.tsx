"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteItems, updateItems } from "@/app/(app)/inventory/actions";
import { selectClass } from "@/components/stack-fields";
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
import { CONDITIONS, CONDITION_NAMES, FINISH_LABELS, LANGUAGE_FLAGS, LANGUAGES, formatInt } from "@/lib/format";
import { cn } from "@/lib/utils";

type Condition = (typeof CONDITIONS)[number];
type Finish = keyof typeof FINISH_LABELS;

/** The finishes, named for every game at once: Pokémon calls foil «Reverse holo». */
const FINISH_NAMES: Record<Finish, string> = { nonfoil: "Normal", foil: "Foil / Reverse holo", etched: "Etched" };

const cards = (n: number) => `${formatInt(n)} ${n === 1 ? "carta" : "cartas"}`;
const stacks = (n: number) => `${formatInt(n)} ${n === 1 ? "montón" : "montones"}`;

type Props = {
  itemIds: string[];
  /** Copies in the selected stacks. */
  copies: number;
  onClose: () => void;
  /** Done: the selection is cleared. */
  onDone: () => void;
};

/**
 * «Editar…» for the selected stacks: condition, language and finish, each left as it is unless
 * chosen. Stacks that end up identical to another join it (updateItems). For fixing a scanning
 * session that ran with the wrong defaults.
 */
export function BulkEditDialog({ itemIds, copies, onClose, onDone }: Props) {
  const [condition, setCondition] = useState<Condition | "">("");
  const [language, setLanguage] = useState("");
  const [finish, setFinish] = useState<Finish | "">("");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      try {
        const r = await updateItems({
          itemIds,
          condition: condition || undefined,
          language: language || undefined,
          finish: finish || undefined,
        });
        toast.success(editSummary(r));
        onDone();
        onClose();
      } catch {
        toast.error("No se han podido guardar los cambios.");
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar {cards(copies)}</DialogTitle>
          <DialogDescription>
            Se aplica a los {stacks(itemIds.length)} seleccionados. Lo que dejes en «Sin cambios» se queda como
            está, y si un montón queda igual que otro que ya tienes, se juntan.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Estado" id="bulk-condition">
            <select
              id="bulk-condition"
              className={cn(selectClass, "w-full")}
              value={condition}
              onChange={(e) => setCondition(e.target.value as Condition | "")}
            >
              <option value="">Sin cambios</option>
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {c} · {CONDITION_NAMES[c]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Idioma" id="bulk-language">
            <select
              id="bulk-language"
              className={cn(selectClass, "w-full")}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="">Sin cambios</option>
              {Object.entries(LANGUAGES).map(([code, label]) => (
                <option key={code} value={code}>
                  {LANGUAGE_FLAGS[code] ? `${LANGUAGE_FLAGS[code]} ${label}` : label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Acabado" id="bulk-finish">
            <select
              id="bulk-finish"
              className={cn(selectClass, "w-full")}
              value={finish}
              onChange={(e) => setFinish(e.target.value as Finish | "")}
            >
              <option value="">Sin cambios</option>
              {(Object.keys(FINISH_NAMES) as Finish[]).map((f) => (
                <option key={f} value={f}>
                  {FINISH_NAMES[f]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={pending || (!condition && !language && !finish)} aria-busy={pending || undefined}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** What a bulk edit did, in one toast. */
function editSummary(r: { changed: number; joined: number; finishSkipped: number }) {
  if (!r.changed && !r.finishSkipped) return "Nada que cambiar: ya estaban así.";
  const parts = [`${stacks(r.changed)} ${r.changed === 1 ? "cambiado" : "cambiados"}`];
  if (r.joined) parts.push(`${formatInt(r.joined)} ${r.joined === 1 ? "se ha juntado con otro igual" : "se han juntado con otros iguales"}`);
  if (r.finishSkipped) {
    parts.push(
      r.finishSkipped === 1
        ? "1 no sale en ese acabado y conserva el suyo"
        : `${formatInt(r.finishSkipped)} no salen en ese acabado y conservan el suyo`,
    );
  }
  return `${parts.join("; ")}.`;
}

/** «Eliminar» for the selected stacks, confirmed with how many cards go. */
export function BulkDeleteDialog({ itemIds, copies, onClose, onDone }: Props) {
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      try {
        const r = await deleteItems(itemIds);
        toast.success(`${cards(r.copies)} ${r.copies === 1 ? "eliminada" : "eliminadas"}.`);
        onDone();
        onClose();
      } catch {
        toast.error("No se han podido eliminar.");
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Eliminar {cards(copies)}?</DialogTitle>
          <DialogDescription>
            Se quitan de tus cartas {itemIds.length === 1 ? "el montón seleccionado" : `los ${stacks(itemIds.length)} seleccionados`}.
            Los mazos y colecciones que las incluyen las darán por faltantes. No se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={remove} disabled={pending} aria-busy={pending || undefined}>
            {pending ? "Eliminando…" : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
