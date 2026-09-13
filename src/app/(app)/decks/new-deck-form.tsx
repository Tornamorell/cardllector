"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createDeck } from "./actions";
import { reportImport } from "./import-report";

/** A new deck: a name and, optionally, its list pasted from Moxfield or Arena. */
export function NewDeckForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [list, setList] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <PlusIcon />
        Nuevo mazo
      </Button>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const r = await createDeck({ name, list });
        reportImport(r);
        router.push(`/decks/${r.id}`);
      } catch {
        toast.error("No se ha podido crear el mazo.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="bg-card w-full space-y-3 rounded-xl border p-4">
      <div className="space-y-1.5">
        <Label htmlFor="new-deck-name">Nombre</Label>
        <Input
          id="new-deck-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="p. ej. Atraxa superfriends"
          required
          maxLength={80}
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-deck-list">Lista (opcional)</Label>
        <Textarea
          id="new-deck-list"
          value={list}
          onChange={(e) => setList(e.target.value)}
          rows={8}
          className="font-mono text-xs"
          placeholder={"Commander\n1 Atraxa, Praetors' Voice (C16) 28\n\nDeck\n1 Sol Ring\n30 Island"}
        />
        <p className="text-muted-foreground text-xs">
          Tal como la exportan Moxfield o Arena. El comandante, bajo «Commander». Se crea también la caja
          del mazo, una ubicación donde guardar sus cartas.
        </p>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending || !name.trim()} aria-busy={pending}>
          {pending ? "Creando…" : "Crear mazo"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
