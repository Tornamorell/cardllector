"use client";

import { HandIcon, ShuffleIcon } from "lucide-react";
import { useState } from "react";
import { CardThumb } from "@/components/card-thumb";
import { Button } from "@/components/ui/button";
import { buildLibrary, cardsToBottom, shuffle, type HandCard, type LibraryCard } from "@/lib/decks/test-hand";
import { cn } from "@/lib/utils";

const random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

/** A test hand from the main deck: seven cards, London mulligans (the first free), and draws. */
export function OpeningHand({ cards }: { cards: LibraryCard[] }) {
  const [library, setLibrary] = useState<HandCard[]>([]);
  const [hand, setHand] = useState<HandCard[]>([]);
  const [next, setNext] = useState(0);
  const [mulligans, setMulligans] = useState(0);
  const [toBottom, setToBottom] = useState(0);

  function deal(m: number) {
    const shuffled = shuffle(buildLibrary(cards), random);
    setLibrary(shuffled);
    setHand(shuffled.slice(0, 7));
    setNext(7);
    setMulligans(m);
    setToBottom(cardsToBottom(m));
  }

  function bottom(card: HandCard) {
    if (toBottom <= 0) return;
    setHand((h) => h.filter((c) => c.key !== card.key));
    setToBottom((n) => n - 1);
  }

  function draw() {
    if (next >= library.length) return;
    setHand((h) => [...h, library[next]]);
    setNext((n) => n + 1);
  }

  if (!cards.length) return <p className="text-muted-foreground text-sm">Añade cartas al mazo para sacar una mano.</p>;

  if (!library.length) {
    return (
      <Button variant="outline" onClick={() => deal(0)}>
        <HandIcon />
        Sacar una mano
      </Button>
    );
  }

  const lands = hand.filter((c) => c.isLand).length;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => deal(0)}>
          <ShuffleIcon />
          Nueva mano
        </Button>
        <Button size="sm" variant="outline" onClick={() => deal(mulligans + 1)} disabled={toBottom > 0}>
          Mulligan
        </Button>
        <Button size="sm" variant="outline" onClick={draw} disabled={toBottom > 0 || next >= library.length}>
          Robar
        </Button>
        <span className="text-muted-foreground text-sm">
          {hand.length} cartas · {lands} {lands === 1 ? "tierra" : "tierras"}
          {mulligans > 0 && ` · mulligan ${mulligans}${mulligans === 1 ? " (gratis)" : ""}`}
          {next > 7 && ` · ${next - 7} robadas`}
        </span>
      </div>
      {toBottom > 0 && (
        <p className="text-sm font-medium">
          Toca {toBottom === 1 ? "la carta" : `las ${toBottom} cartas`} que pones en el fondo de la biblioteca.
        </p>
      )}
      <ul className="flex flex-wrap gap-2">
        {hand.map((c) => (
          <li key={c.key}>
            <button
              type="button"
              onClick={() => bottom(c)}
              disabled={toBottom <= 0}
              className={cn("block rounded-md", toBottom > 0 && "hover:ring-primary cursor-pointer hover:ring-2")}
              title={c.name}
              aria-label={toBottom > 0 ? `Poner ${c.name} en el fondo` : c.name}
            >
              <CardThumb src={c.imageSmall} alt={c.name} size="sm" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
