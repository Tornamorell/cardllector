"use client";

import Link from "next/link";
import { useOptimistic } from "react";
import { AddCopyButton } from "@/components/add-copy-button";
import { CardThumb } from "@/components/card-thumb";
import { cn } from "@/lib/utils";

/**
 * A card in a set or collection grid: grey while you don't have it, with how many you have and
 * a + to add one. The + counts at once (optimistic): the card lights up and the number goes up
 * before the server answers, and goes back if it fails.
 */
export function OwnedCardTile({
  printingId,
  name,
  number,
  imageSmall,
  finishes,
  owned,
  wanted,
  withCollection = true,
}: {
  printingId: string;
  name: string;
  /** Collector number, shown on the placeholder of cards without an image. */
  number?: string;
  imageSmall: string | null;
  finishes: string[];
  owned: number;
  /** On a collection's page: copies wanted, shown as "owned/wanted" until complete. */
  wanted?: number;
  withCollection?: boolean;
}) {
  const [shown, addShown] = useOptimistic(owned, (current, added: number) => current + added);
  const complete = wanted == null ? shown > 0 : shown >= wanted;

  return (
    <div className="relative">
      <Link href={`/cards/${printingId}`} className="block">
        <CardThumb
          src={imageSmall}
          alt={name}
          label={number && `#${number}`}
          size="md"
          className={cn(
            "w-full! transition-[filter,opacity] duration-300",
            shown === 0 && "opacity-55 grayscale-[0.75]",
          )}
        />
      </Link>
      {shown > 0 && (
        <span
          className={cn(
            "absolute top-1.5 left-1.5 rounded-md px-1.5 py-0.5 text-xs font-semibold shadow-sm tabular-nums",
            complete ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
          )}
        >
          {wanted == null ? `×${shown}` : wanted > 1 || !complete ? `${shown}/${wanted}` : "✓"}
        </span>
      )}
      <AddCopyButton
        printingId={printingId}
        finishes={finishes}
        name={name}
        withCollection={withCollection}
        onStart={() => addShown(1)}
      />
    </div>
  );
}
