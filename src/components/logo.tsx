import { cn } from "@/lib/utils";

/**
 * The Cardllector mark, «Abanico»: a hand of three cards, the front one gold with the rarity
 * diamond the app uses everywhere (docs/design.md). Plain hex colours and an explicit size so
 * the app icon (ImageResponse) can draw it too.
 */
export function LogoMark({ size, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="20" y="14" width="24" height="34" rx="3.5" fill="#4b4580" transform="rotate(-18 32 50)" />
      <rect x="20" y="14" width="24" height="34" rx="3.5" fill="#7a72b8" transform="rotate(18 32 50)" />
      <rect x="20" y="14" width="24" height="34" rx="3.5" fill="#e9b949" />
      <rect x="28.5" y="27.5" width="7" height="7" fill="#16142b" transform="rotate(45 32 31)" />
    </svg>
  );
}

/** Mark and name, as in the app's header: the name in Archivo at its expanded width. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <LogoMark className="size-8 shrink-0" />
      <span className="display text-lg leading-none font-extrabold tracking-tight">Cardllector</span>
    </span>
  );
}
