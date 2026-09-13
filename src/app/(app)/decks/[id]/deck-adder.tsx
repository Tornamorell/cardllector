"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CardPickerRow } from "@/components/card-picker-row";
import { CardSearchBox, useCardPicker } from "@/components/card-picker";
import { QuantityStepper, selectClass } from "@/components/stack-fields";
import { Button } from "@/components/ui/button";
import { BOARD_LABELS, BOARDS, type Board } from "@/lib/decks/decklist";
import { addDeckCard } from "../actions";

/** Adds a Magic card to a board; the printing picked becomes the one shown and priced. */
export function DeckAdder({ deckId, hasCommander }: { deckId: string; hasCommander: boolean }) {
  const picker = useCardPicker(null);
  const [board, setBoard] = useState<Board>(hasCommander ? "main" : "commander");
  const [quantity, setQuantity] = useState(1);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { printing } = picker;

  function add() {
    if (!printing) return;
    if (printing.game !== "mtg") {
      toast.error("Los mazos son de Magic.");
      return;
    }
    startTransition(async () => {
      try {
        const r = await addDeckCard({ deckId, printingId: printing.id, board, quantity });
        if (!r.added) {
          toast.error(`Aún no tengo los datos de juego de ${r.name}: llegan con la sincronización diaria de Scryfall.`);
          return;
        }
        toast.success(`${r.name} en ${BOARD_LABELS[board].toLowerCase()}`);
        if (board === "commander") setBoard("main");
        setQuantity(1);
        picker.reset();
        router.refresh();
      } catch {
        toast.error("No se ha podido añadir la carta.");
      }
    });
  }

  return (
    <div className="bg-card space-y-3 rounded-xl border p-3">
      <CardSearchBox
        picker={picker}
        onSubmit={add}
        placeholder="Añadir al mazo: nombre, o expansión y número"
        label="Buscar carta para el mazo"
      />
      {picker.selected && printing && (
        <CardPickerRow picker={picker}>
          <select
            className={selectClass}
            value={board}
            onChange={(e) => setBoard(e.target.value as Board)}
            aria-label="Dónde va"
          >
            {BOARDS.map((b) => (
              <option key={b} value={b}>
                {BOARD_LABELS[b]}
              </option>
            ))}
          </select>
          <QuantityStepper value={quantity} onChange={setQuantity} label="Copias" />
          <Button id={picker.submitId} onClick={add} disabled={pending} aria-busy={pending}>
            {pending ? "Añadiendo…" : "Añadir al mazo"}
          </Button>
          <Button variant="ghost" onClick={picker.reset} disabled={pending}>
            Cancelar
          </Button>
        </CardPickerRow>
      )}
    </div>
  );
}
