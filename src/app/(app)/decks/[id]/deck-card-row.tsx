"use client";

import { ArrowDownToLineIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { CardThumb } from "@/components/card-thumb";
import { ManaCost } from "@/components/mana-cost";
import { QuantityStepper, selectClass } from "@/components/stack-fields";
import { Button } from "@/components/ui/button";
import { BOARD_LABELS, BOARDS, type Board } from "@/lib/decks/decklist";
import { formatEur } from "@/lib/format";
import { cn } from "@/lib/utils";
import { moveDeckCard, pullIntoDeck, setDeckCardQuantity } from "../actions";

export type DeckCardView = {
  board: Board;
  oracleId: string;
  quantity: number;
  name: string;
  manaCost: string | null;
  printingId: string | null;
  imageSmall: string | null;
  priceEur: number | null;
  /** For the commander and main deck: where this card's copies are (D35). */
  status: { inBox: number; want: number; free: number; freeWhere: string[]; inOtherDecks: number } | null;
};

/** One card of the deck: copies, board, and whether its copies are in the box. */
export function DeckCardRow({ deckId, card }: { deckId: string; card: DeckCardView }) {
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<unknown>, error = "No se ha podido guardar el cambio.") {
    startTransition(async () => {
      try {
        await action();
      } catch {
        toast.error(error);
      }
    });
  }

  function pull() {
    startTransition(async () => {
      try {
        const r = await pullIntoDeck(deckId, card.oracleId);
        toast.success(r.moved ? `${r.moved} ${r.moved === 1 ? "copia" : "copias"} a la caja del mazo.` : "No había copias libres.");
      } catch {
        toast.error("No se han podido mover las copias.");
      }
    });
  }

  const s = card.status;
  const lacking = s ? Math.max(0, s.want - s.inBox) : 0;

  return (
    <li className={cn("flex items-center gap-2 py-1.5", pending && "opacity-60")}>
      <CardThumb src={card.imageSmall} alt={card.name} size="xs" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {card.printingId ? (
            <Link href={`/cards/${card.printingId}`} className="truncate text-sm font-medium hover:underline">
              {card.name}
            </Link>
          ) : (
            <span className="truncate text-sm font-medium">{card.name}</span>
          )}
          <ManaCost cost={card.manaCost} />
        </div>
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
          <span className="tabular-nums">{formatEur(card.priceEur)}</span>
          {s &&
            (lacking === 0 ? (
              <span className="text-emerald-700 dark:text-emerald-400">✓ En la caja</span>
            ) : s.free > 0 ? (
              <span className="flex items-center gap-1">
                En {s.freeWhere.join(", ")}
                <Button type="button" variant="link" size="xs" className="h-auto p-0 text-xs" onClick={pull} disabled={pending}>
                  <ArrowDownToLineIcon className="size-3" />
                  Traer
                </Button>
              </span>
            ) : s.inOtherDecks > 0 ? (
              <span className="text-amber-700 dark:text-amber-400">En otro mazo</span>
            ) : (
              <span className="text-red-700 dark:text-red-400">
                Te {lacking === 1 ? "falta" : `faltan ${lacking}`}
              </span>
            ))}
        </div>
      </div>
      <select
        className={cn(selectClass, "h-8 w-28 text-xs")}
        value={card.board}
        disabled={pending}
        aria-label={`Mover ${card.name} a`}
        onChange={(e) => run(() => moveDeckCard(deckId, card.board, card.oracleId, e.target.value as Board))}
      >
        {BOARDS.map((b) => (
          <option key={b} value={b}>
            {BOARD_LABELS[b]}
          </option>
        ))}
      </select>
      <QuantityStepper
        value={card.quantity}
        onChange={(n) => run(() => setDeckCardQuantity(deckId, card.board, card.oracleId, n))}
        label={`Copias de ${card.name}`}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={pending}
        aria-label={`Quitar ${card.name}`}
        onClick={() => run(() => setDeckCardQuantity(deckId, card.board, card.oracleId, 0))}
      >
        <XIcon />
      </Button>
    </li>
  );
}
