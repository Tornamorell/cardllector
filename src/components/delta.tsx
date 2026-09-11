import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { formatEur } from "@/lib/format";
import { cn } from "@/lib/utils";

/** A change in euros. Arrow and sign carry the direction too, so it never relies on colour alone. */
export function Delta({ value, className }: { value: number; className?: string }) {
  const Icon = value > 0 ? TrendingUpIcon : value < 0 ? TrendingDownIcon : null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-semibold whitespace-nowrap",
        value > 0 ? "text-gain" : value < 0 ? "text-loss" : "text-muted-foreground",
        className,
      )}
    >
      {Icon && <Icon className="size-[1em]" aria-hidden />}
      {value > 0 ? "+" : value < 0 ? "−" : ""}
      {formatEur(Math.abs(value))}
    </span>
  );
}
