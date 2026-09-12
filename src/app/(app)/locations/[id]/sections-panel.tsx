"use client";

import { PencilIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ProgressMeter } from "@/components/progress-meter";
import { sectionFill } from "@/components/section-picker";
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
import { Label } from "@/components/ui/label";
import { formatInt } from "@/lib/format";
import type { SectionOption } from "@/lib/queries/locations";
import { cn } from "@/lib/utils";
import { addSection, deleteSection, updateSection } from "../actions";

const tile =
  "bg-card hover:border-primary/60 block h-full rounded-lg border px-3 py-2 transition-colors";

/** A location's dividers as tiles: how full each is, a filter on tap, and editing (D28). */
export function SectionsPanel({
  locationId,
  sections,
  unsectioned,
  activeSectionId,
  capacity,
  autoAdvance,
}: {
  locationId: string;
  sections: SectionOption[];
  unsectioned: number;
  /** undefined = all, null = copies outside any divider. */
  activeSectionId: string | null | undefined;
  capacity: number | null;
  autoAdvance: boolean;
}) {
  const [editing, setEditing] = useState<SectionOption | null>(null);
  const [pending, startTransition] = useTransition();
  const base = `/locations/${locationId}`;

  return (
    <section className="space-y-2" aria-labelledby="sections-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="sections-heading" className="text-lg font-bold">
          Separadores
        </h2>
        <p className="text-muted-foreground text-xs">
          {autoAdvance && capacity
            ? `Automático: al llenarse uno (${formatInt(capacity)} cartas), sigue en el siguiente.`
            : "Manual: pasa al siguiente con «Siguiente separador» al escanear o añadir."}
        </p>
      </div>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
        <li>
          <Link
            href={base}
            className={cn(tile, activeSectionId === undefined && "border-primary")}
            aria-current={activeSectionId === undefined ? "true" : undefined}
          >
            <span className="block font-semibold">Todos</span>
            <span className="text-muted-foreground text-xs">
              {sections.length} {sections.length === 1 ? "separador" : "separadores"}
            </span>
          </Link>
        </li>
        {sections.map((s) => (
          <li key={s.id} className="relative">
            <Link
              href={`${base}?section=${s.id}`}
              className={cn(tile, activeSectionId === s.id && "border-primary")}
              aria-current={activeSectionId === s.id ? "true" : undefined}
            >
              <span className="display block truncate pr-5 text-lg font-bold">{s.name}</span>
              <span className="text-muted-foreground text-xs tabular-nums">{sectionFill(s)}</span>
              {s.capacity != null && (
                <ProgressMeter
                  value={Math.min(s.count, s.capacity)}
                  max={s.capacity}
                  showLabel={false}
                  className="mt-1 w-full"
                />
              )}
            </Link>
            <button
              type="button"
              onClick={() => setEditing(s)}
              className="text-muted-foreground hover:text-foreground absolute top-1.5 right-1.5 rounded p-1"
              aria-label={`Editar el separador ${s.name}`}
            >
              <PencilIcon className="size-3.5" />
            </button>
          </li>
        ))}
        {unsectioned > 0 && (
          <li>
            <Link
              href={`${base}?section=none`}
              className={cn(tile, activeSectionId === null && "border-primary")}
              aria-current={activeSectionId === null ? "true" : undefined}
            >
              <span className="block font-semibold">Sin separador</span>
              <span className="text-muted-foreground text-xs tabular-nums">{formatInt(unsectioned)}</span>
            </Link>
          </li>
        )}
        <li>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  const s = await addSection(locationId);
                  toast.success(`Separador «${s.name}» añadido`);
                } catch {
                  toast.error("No se ha podido añadir el separador.");
                }
              })
            }
            className="text-muted-foreground hover:text-foreground hover:border-primary/60 flex h-full min-h-14 w-full items-center justify-center gap-1 rounded-lg border border-dashed text-sm"
          >
            <PlusIcon className="size-4" />
            Añadir
          </button>
        </li>
      </ul>
      {editing && <EditSectionDialog section={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function EditSectionDialog({ section, onClose }: { section: SectionOption; onClose: () => void }) {
  const [name, setName] = useState(section.name);
  const [capacity, setCapacity] = useState(section.capacity == null ? "" : String(section.capacity));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  function save(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      try {
        await updateSection(section.id, {
          name,
          capacity: capacity.trim() ? Number(capacity) : null,
        });
        onClose();
      } catch {
        toast.error("Revisa el nombre y la capacidad.");
      }
    });
  }

  function remove() {
    startTransition(async () => {
      try {
        await deleteSection(section.id);
        onClose();
      } catch {
        toast.error("No se ha podido eliminar el separador.");
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={save} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Separador {section.name}</DialogTitle>
            <DialogDescription>
              Tiene {formatInt(section.count)} {section.count === 1 ? "carta" : "cartas"}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="section-name">Nombre</Label>
              <Input
                id="section-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={40}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="section-capacity">Capacidad</Label>
              <Input
                id="section-capacity"
                type="number"
                inputMode="numeric"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="Sin límite"
              />
            </div>
          </div>
          {confirmDelete ? (
            <div className="bg-destructive/10 grid gap-2 rounded-lg p-3 text-sm">
              <p>
                ¿Eliminar el separador? Sus cartas se quedan en la ubicación, sin separador.
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="destructive" size="sm" onClick={remove} disabled={pending}>
                  Eliminar
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                  No
                </Button>
              </div>
            </div>
          ) : null}
          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              className="text-destructive"
              onClick={() => setConfirmDelete(true)}
              disabled={pending}
            >
              Eliminar
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
