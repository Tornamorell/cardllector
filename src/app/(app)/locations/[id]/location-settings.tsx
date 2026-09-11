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
import { deleteLocation, updateLocation } from "../actions";

export function LocationSettings({
  id,
  name,
  description,
}: {
  id: string;
  name: string;
  description: string | null;
}) {
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);
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
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "delete"} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar «{name}»?</DialogTitle>
            <DialogDescription>
              Las cartas no se borran: siguen en sus colecciones, pero quedan sin ubicación.
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
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
