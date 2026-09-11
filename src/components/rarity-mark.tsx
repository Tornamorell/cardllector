import { rarityTier } from "@/lib/games";
import { cn } from "@/lib/utils";

/** A small set-symbol-coloured diamond before a rarity name. */
export function RarityMark({ rarity, className }: { rarity: string | null; className?: string }) {
  return (
    <span
      className={cn("rarity-mark", className)}
      data-tier={rarityTier(rarity)}
      aria-hidden
    />
  );
}
