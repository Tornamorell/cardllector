"use client";

import { MinusIcon, PlusIcon, XIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { removeCardFromCollection, setWanted } from "../actions";

/** Copies wanted (−/+) and taking the card off the list. */
export function EntryControls({
  collectionId,
  catalogCardId,
  wanted,
  name,
}: {
  collectionId: string;
  catalogCardId: string;
  wanted: number;
  name: string;
}) {
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      try {
        await fn();
      } catch {
        toast.error("No se ha podido guardar el cambio.");
      }
    });

  return (
    <div className="text-muted-foreground mt-1 flex items-center gap-1">
      <span className="mr-auto">Quieres</span>
      <Button
        variant="ghost"
        size="icon-xs"
        disabled={pending || wanted <= 1}
        onClick={() => run(() => setWanted(collectionId, catalogCardId, wanted - 1))}
        aria-label={`Querer una copia menos de ${name}`}
      >
        <MinusIcon />
      </Button>
      <span className="text-foreground w-5 text-center tabular-nums">{wanted}</span>
      <Button
        variant="ghost"
        size="icon-xs"
        disabled={pending}
        onClick={() => run(() => setWanted(collectionId, catalogCardId, wanted + 1))}
        aria-label={`Querer una copia más de ${name}`}
      >
        <PlusIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        disabled={pending}
        onClick={() => run(() => removeCardFromCollection(collectionId, catalogCardId))}
        aria-label={`Quitar ${name} de la colección`}
      >
        <XIcon />
      </Button>
    </div>
  );
}
