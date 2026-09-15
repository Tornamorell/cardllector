"use client";

import { MinusIcon, PlusIcon, XIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSteppedValue } from "@/lib/use-stepped-value";
import { cn } from "@/lib/utils";
import { removeCardFromCollection, setWanted } from "../actions";

/** Copies wanted (−/+, counted at once) and taking the card off the list. */
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
  const { shown, pending: saving, step } = useSteppedValue(wanted, (next) =>
    setWanted(collectionId, catalogCardId, next),
  );
  const [removing, startTransition] = useTransition();
  const remove = () =>
    startTransition(async () => {
      try {
        await removeCardFromCollection(collectionId, catalogCardId);
      } catch {
        toast.error("No se ha podido guardar el cambio.");
      }
    });

  return (
    <div
      className={cn("text-muted-foreground mt-1 flex items-center gap-1", removing && "opacity-50")}
      aria-busy={saving || removing || undefined}
    >
      <span className="mr-auto">Quieres</span>
      <Button
        variant="ghost"
        size="icon-xs"
        disabled={removing || shown <= 1}
        onClick={() => step(shown - 1)}
        aria-label={`Querer una copia menos de ${name}`}
      >
        <MinusIcon />
      </Button>
      <span className={cn("text-foreground w-5 text-center tabular-nums transition-opacity", saving && "opacity-50")}>
        {shown}
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        disabled={removing}
        onClick={() => step(shown + 1)}
        aria-label={`Querer una copia más de ${name}`}
      >
        <PlusIcon />
      </Button>
      <Button variant="ghost" size="icon-xs" disabled={removing} onClick={remove} aria-label={`Quitar ${name} de la colección`}>
        <XIcon />
      </Button>
    </div>
  );
}
