"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
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
import { deleteLocation, updateLocation, updateSectionSettings } from "../actions";

export function LocationSettings({
  id,
  name,
  description,
  sectionCount,
  sectionCapacity,
  autoAdvance,
}: {
  id: string;
  name: string;
  description: string | null;
  sectionCount: number;
  sectionCapacity: number | null;
  autoAdvance: boolean;
}) {
  const [dialog, setDialog] = useState<"edit" | "sections" | "delete" | null>(null);
  const [pending, startTransition] = useTransition();
  const onOpenChange = (open: boolean) => !open && setDialog(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
          Opciones
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setDialog("edit")}>Renombrar</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDialog("sections")}>Separadores…</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => setDialog("delete")}>
            Eliminar ubicación
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog === "edit"} onOpenChange={onOpenChange}>
        <DialogContent>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              startTransition(async () => {
                try {
                  await updateLocation(id, data);
                  setDialog(null);
                } catch {
                  toast.error("No se ha podido guardar. ¿Ya tienes otra ubicación con ese nombre?");
                }
              });
            }}
          >
            <DialogHeader>
              <DialogTitle>Renombrar ubicación</DialogTitle>
            </DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor="location-name">Nombre</Label>
              <Input id="location-name" name="name" defaultValue={name} required maxLength={60} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="location-description">Descripción</Label>
              <Textarea
                id="location-description"
                name="description"
                defaultValue={description ?? ""}
                rows={2}
                placeholder="p. ej. Estantería del despacho, balda de arriba"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Guardando…" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Mounted only while open, so it starts from the current settings. */}
      {dialog === "sections" && (
        <SectionSettingsDialog
          id={id}
          sectionCount={sectionCount}
          sectionCapacity={sectionCapacity}
          autoAdvance={autoAdvance}
          onClose={() => setDialog(null)}
        />
      )}

      <Dialog open={dialog === "delete"} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar «{name}»?</DialogTitle>
            <DialogDescription>
              Las cartas no se borran: siguen en Mis cartas, sin ubicación.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              // deleteLocation redirects to /locations; no catch, or it would swallow it.
              onClick={() => startTransition(() => deleteLocation(id))}
            >
              {pending ? "Eliminando…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Dividers on or off, how many cards each holds, and whether full ones hand over by themselves (D28). */
function SectionSettingsDialog({
  id,
  sectionCount,
  sectionCapacity,
  autoAdvance,
  onClose,
}: {
  id: string;
  sectionCount: number;
  sectionCapacity: number | null;
  autoAdvance: boolean;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    enabled: sectionCount > 0,
    capacity: sectionCapacity == null ? "" : String(sectionCapacity),
    autoAdvance,
    applyToExisting: true,
  });
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const hasCapacity = form.capacity.trim() !== "";

  function save(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      try {
        await updateSectionSettings(id, {
          enabled: form.enabled,
          capacity: hasCapacity ? Number(form.capacity) : null,
          autoAdvance: form.autoAdvance,
          applyToExisting: form.applyToExisting,
        });
        toast.success(form.enabled ? "Separadores guardados" : "Separadores quitados");
        onClose();
      } catch {
        toast.error("Revisa la capacidad: tiene que ser un número de cartas.");
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={save} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Separadores</DialogTitle>
            <DialogDescription>
              Para cajas grandes: divídela en tramos, como los separadores que pones entre las
              cartas.
            </DialogDescription>
          </DialogHeader>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="accent-primary size-4"
              checked={form.enabled}
              onChange={(e) => set({ enabled: e.target.checked })}
            />
            Esta ubicación tiene separadores
          </label>
          {form.enabled ? (
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Label htmlFor="section-default-capacity" className="font-normal">
                  Cada separador guarda
                </Label>
                <Input
                  id="section-default-capacity"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={form.capacity}
                  onChange={(e) => set({ capacity: e.target.value })}
                  placeholder="sin límite"
                  className="w-28"
                />
                <span>cartas</span>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-primary mt-0.5 size-4"
                  checked={form.autoAdvance && hasCapacity}
                  disabled={!hasCapacity}
                  onChange={(e) => set({ autoAdvance: e.target.checked })}
                />
                <span>
                  Automático: cuando uno se llena, lo siguiente va al separador siguiente y te
                  aviso para que lo pongas.
                  <span className="text-muted-foreground block text-xs">
                    Si no, pasas tú con «Siguiente separador».
                  </span>
                </span>
              </label>
              {sectionCount > 0 && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-primary size-4"
                    checked={form.applyToExisting}
                    onChange={(e) => set({ applyToExisting: e.target.checked })}
                  />
                  Aplicar la capacidad a los {sectionCount} separadores que ya tiene
                </label>
              )}
            </div>
          ) : (
            sectionCount > 0 && (
              <p className="text-muted-foreground text-sm">
                Se quitarán sus {sectionCount} separadores. Las cartas se quedan en la ubicación.
              </p>
            )
          )}
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
