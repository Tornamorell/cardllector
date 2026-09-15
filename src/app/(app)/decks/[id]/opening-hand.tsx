"use client";

import { ArrowDownToLineIcon, HandIcon, ShuffleIcon } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { CardThumb } from "@/components/card-thumb";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildLibrary, cardsToBottom, shuffle, type HandCard, type LibraryCard } from "@/lib/decks/test-hand";
import { cn } from "@/lib/utils";

const random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

/** In the fanned hand, how much of each card shows past the one before it (of its width). */
const FAN_STEP = 0.62;

/**
 * A test hand from the main deck (D35): seven cards, London mulligans (the first free), and
 * draws. It opens over the page at a size to read the cards: fanned out like a hand held at the
 * table on a computer, one big card after another to swipe through on a phone.
 */
export function OpeningHand({ cards }: { cards: LibraryCard[] }) {
  const [open, setOpen] = useState(false);
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

  const lands = hand.filter((c) => c.isLand).length;
  const choosing = toBottom > 0;

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          deal(0);
          setOpen(true);
        }}
        disabled={!cards.length}
        title={cards.length ? undefined : "Añade cartas al mazo para sacar una mano"}
      >
        <HandIcon />
        Mano de prueba
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={cn(
            // On a phone, the whole screen; on a computer, a wide table.
            "top-0 left-0 flex h-dvh max-w-none translate-x-0 translate-y-0 flex-col gap-3 rounded-none p-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:max-w-none",
            "md:top-1/2 md:left-1/2 md:h-[min(90dvh,46rem)] md:max-w-6xl md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl",
          )}
        >
          <DialogHeader className="px-4 pt-4 pr-12">
            <DialogTitle>Mano de prueba</DialogTitle>
            <DialogDescription className="tabular-nums">
              {hand.length} cartas · {lands} {lands === 1 ? "tierra" : "tierras"}
              {mulligans > 0 && ` · mulligan ${mulligans}${mulligans === 1 ? " (gratis)" : ""}`}
              {next > 7 && ` · ${next - 7} robadas`}
            </DialogDescription>
          </DialogHeader>
          {choosing && (
            <p className="px-4 text-sm font-medium">
              Elige {toBottom === 1 ? "la carta" : `las ${toBottom} cartas`} que pones en el fondo de la biblioteca.
            </p>
          )}

          <Fan cards={hand} choosing={choosing} onBottom={bottom} />
          <Swipe cards={hand} choosing={choosing} onBottom={bottom} />

          <div className="grid grid-cols-3 gap-2 border-t p-3 md:flex md:justify-center">
            <Button variant="outline" onClick={() => deal(0)}>
              <ShuffleIcon />
              Nueva mano
            </Button>
            <Button variant="outline" onClick={() => deal(mulligans + 1)} disabled={choosing}>
              Mulligan
            </Button>
            <Button variant="outline" onClick={draw} disabled={choosing || next >= library.length}>
              Robar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

type HandProps = { cards: HandCard[]; choosing: boolean; onBottom: (card: HandCard) => void };

/**
 * The hand on a computer: fanned like cards held, as wide as fits (they narrow as more are
 * drawn). The one under the pointer lifts and straightens.
 */
function Fan({ cards, choosing, onBottom }: HandProps) {
  const center = (cards.length - 1) / 2;
  const span = 1 + FAN_STEP * Math.max(0, cards.length - 1);
  return (
    <ul
      className="@container hidden min-h-0 flex-1 items-center justify-center px-8 pb-4 md:flex"
      // Each card: as wide as the whole fan fits in the row, 13.5rem at most.
      style={{ "--w": `min(13.5rem, calc(100cqw / ${span}))` } as CSSProperties}
    >
      {cards.map((c, i) => {
        const offset = i - center;
        return (
          <li
            key={c.key}
            className="group relative shrink-0 focus-within:z-50! hover:z-50!"
            style={{ width: "var(--w)", marginLeft: i ? `calc(var(--w) * ${FAN_STEP - 1})` : 0, zIndex: i }}
          >
            <div
              className="origin-bottom [transform:translateY(var(--lift))_rotate(var(--turn))] group-focus-within:[transform:translateY(-1.25rem)] group-hover:[transform:translateY(-1.25rem)_scale(1.04)] motion-safe:transition-transform motion-safe:duration-200"
              style={{ "--turn": `${offset * 3}deg`, "--lift": `${Math.abs(offset) * 5}px` } as CSSProperties}
            >
              <CardThumb src={c.imageNormal ?? c.imageSmall} alt={c.name} size="lg" className="w-full!" />
              {choosing && <BottomButton card={c} onBottom={onBottom} className="absolute inset-x-3 bottom-3 shadow-lg" />}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** The hand on a phone: one card at a time, big enough to read, swiped sideways. */
function Swipe({ cards, choosing, onBottom }: HandProps) {
  return (
    <ul className="flex min-h-0 flex-1 snap-x snap-mandatory items-center gap-3 overflow-x-auto px-[calc((100%-min(72vw,20rem))/2)] md:hidden">
      {cards.map((c) => (
        <li key={c.key} className="w-[min(72vw,20rem)] shrink-0 snap-center space-y-2">
          <CardThumb src={c.imageNormal ?? c.imageSmall} alt={c.name} size="lg" className="w-full!" />
          {choosing && <BottomButton card={c} onBottom={onBottom} className="w-full" />}
        </li>
      ))}
    </ul>
  );
}

function BottomButton({ card, onBottom, className }: { card: HandCard; onBottom: (card: HandCard) => void; className?: string }) {
  return (
    <Button
      size="sm"
      variant="secondary"
      className={cn(className)}
      onClick={() => onBottom(card)}
      aria-label={`Poner ${card.name} en el fondo`}
    >
      <ArrowDownToLineIcon />
      Al fondo
    </Button>
  );
}
