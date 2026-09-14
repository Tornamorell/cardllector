import { cn } from "@/lib/utils";

/**
 * The Tapmat mark, «Carta girada»: a gold card turned sideways, tapped, over its zone on the
 * mat, the dashed outline playmats print where each card goes: tap and mat (docs/design.md).
 * The diamond is the rarity mark the app uses everywhere. Plain hex colours and an explicit
 * size, so the app icon (ImageResponse) can draw it too.
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
      <rect
        x="19.5"
        y="12"
        width="25"
        height="35"
        rx="3.5"
        fill="none"
        stroke="#7a72b8"
        strokeWidth="2.2"
        strokeDasharray="4.2 3"
      />
      <g transform="rotate(-8 32 31.75)">
        <rect x="14" y="19" width="36" height="25.5" rx="3.5" fill="#e9b949" />
        <rect x="28.5" y="28.25" width="7" height="7" fill="#16142b" transform="rotate(45 32 31.75)" />
      </g>
    </svg>
  );
}

/** Mark and name, as in the app's header: the name in Archivo at its expanded width. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <LogoMark className="size-8 shrink-0" />
      <span className="display text-lg leading-none font-extrabold tracking-tight">Tapmat</span>
    </span>
  );
}
