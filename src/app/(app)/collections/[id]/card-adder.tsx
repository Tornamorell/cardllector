"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CardPickerRow } from "@/components/card-picker-row";
import { CardSearchBox, useCardPicker } from "@/components/card-picker";
import { QuantityStepper } from "@/components/stack-fields";
import { Button } from "@/components/ui/button";
import { useStickyDefaults } from "@/lib/use-sticky-defaults";
import { addCardToCollection } from "../actions";

/** Adds a card to the list — owned or not — with the copies wanted. */
export function CollectionCardAdder({ collectionId }: { collectionId: string }) {
  const [defaults, setDefaults] = useStickyDefaults();
  const picker = useCardPicker(defaults.lastSetCode);
  const [wanted, setWanted] = useState(1);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { printing } = picker;

  function add() {
    if (!printing) return;
    startTransition(async () => {
      try {
        const r = await addCardToCollection(collectionId, printing.id, wanted);
        toast.success(`${r.name} en «${r.collectionName}»`);
        setDefaults({ lastSetCode: printing.setCode });
        setWanted(1);
        picker.reset();
        router.refresh();
      } catch {
        toast.error("No se ha podido añadir la carta a la colección.");
      }
    });
  }

  return (
    <div className="bg-card space-y-3 rounded-xl border p-3">
      <CardSearchBox
        picker={picker}
        onSubmit={add}
        placeholder="Añadir a la colección: nombre, o expansión y número"
        label="Buscar carta para la colección"
      />
      {picker.selected && printing && (
        <CardPickerRow picker={picker}>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">Copias que quieres</span>
            <QuantityStepper value={wanted} onChange={setWanted} label="Copias que quieres" />
          </div>
          <Button id={picker.submitId} onClick={add} disabled={pending}>
            {pending ? "Añadiendo…" : "Añadir a la colección"}
          </Button>
          <Button variant="ghost" onClick={picker.reset} disabled={pending}>
            Cancelar
          </Button>
        </CardPickerRow>
      )}
    </div>
  );
}
