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
import { deleteCollection, updateCollection } from "../actions";

export function CollectionSettings({
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
            Eliminar colección
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
                  await updateCollection(id, data);
                  setDialog(null);
                } catch {
                  toast.error("No se ha podido guardar.");
                }
              });
            }}
          >
            <DialogHeader>
              <DialogTitle>Renombrar colección</DialogTitle>
            </DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor="collection-name">Nombre</Label>
              <Input id="collection-name" name="name" defaultValue={name} required maxLength={80} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="collection-description">Descripción</Label>
              <Textarea
                id="collection-description"
                name="description"
                defaultValue={description ?? ""}
                rows={2}
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
              Se borrarán la colección y todas sus cartas. No se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              // deleteCollection redirects to /collections; no catch, or it would swallow it.
              onClick={() => startTransition(() => deleteCollection(id))}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
