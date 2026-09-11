import { cn } from "@/lib/utils";

/** "Have X of Y" bar: filled part in the primary color over a lighter track of the same hue. */
export function ProgressMeter({
  value,
  max,
  className,
  showLabel = true,
}: {
  value: number;
  max: number;
  className?: string;
  showLabel?: boolean;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={`${value} de ${max}`}
        className={cn("bg-primary/15 h-1.5 w-20 overflow-hidden rounded-full", className)}
      >
        <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
      </div>
      {showLabel && (
        <span className="text-muted-foreground text-xs tabular-nums">
          {value}/{max}
        </span>
      )}
    </div>
  );
}
