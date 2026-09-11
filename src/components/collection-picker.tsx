"use client";

import { XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createCollectionNamed } from "@/app/(app)/collections/actions";
import { selectClass } from "@/components/stack-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const NEW = "__new__";

export type CollectionOption = { id: string; name: string };

/**
 * Optional collection select with "+ Nueva colección…" inline, so a list can be started from
 * wherever cards are being entered.
 */
export function CollectionPicker({
  value,
  onChange,
  collections,
  emptyLabel = "Sin colección",
  id,
  className,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  collections: CollectionOption[];
  emptyLabel?: string;
  id?: string;
  className?: string;
}) {
  const router = useRouter();
  const [created, setCreated] = useState<CollectionOption[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  const options = [...collections, ...created.filter((c) => !collections.some((o) => o.id === c.id))];
  const current = value && options.some((o) => o.id === value) ? value : "";

  function create() {
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        const collection = await createCollectionNamed(name);
        setCreated((list) => [...list, collection]);
        onChange(collection.id);
        setCreating(false);
        router.refresh();
      } catch {
        toast.error("No se ha podido crear la colección.");
      }
    });
  }

  if (creating) {
    return (
      <div className="flex items-center gap-1">
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              create();
            } else if (e.key === "Escape") {
              setCreating(false);
            }
          }}
          placeholder="p. ej. Pokédex de Hoenn"
          className="w-44"
          aria-label="Nombre de la nueva colección"
          maxLength={80}
        />
        <Button size="sm" onClick={create} disabled={pending || !name.trim()}>
          Crear
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={() => setCreating(false)} aria-label="Cancelar">
          <XIcon />
        </Button>
      </div>
    );
  }

  return (
    <select
      id={id}
      className={cn(selectClass, className)}
      value={current}
      onChange={(e) => {
        if (e.target.value === NEW) {
          setName("");
          setCreating(true);
        } else {
          onChange(e.target.value || null);
        }
      }}
      aria-label="Colección"
    >
      <option value="">{emptyLabel}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
      <option value={NEW}>+ Nueva colección…</option>
    </select>
  );
}
