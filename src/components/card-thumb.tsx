import Image from "next/image";
import { cn } from "@/lib/utils";

const SIZES = {
  xs: { width: 36, height: 50 },
  sm: { width: 56, height: 78 },
  md: { width: 146, height: 204 },
  lg: { width: 300, height: 418 },
};

/**
 * A card as a physical object: 63×88 proportions, rounded corners and a real shadow. `foil`
 * adds the iridescent sheen — only for foil copies, so the effect keeps its meaning. A
 * placeholder stands in when there's no image.
 */
export function CardThumb({
  src,
  alt,
  size = "sm",
  className,
  priority,
  foil,
  label,
}: {
  src: string | null | undefined;
  alt: string;
  size?: keyof typeof SIZES;
  className?: string;
  priority?: boolean;
  foil?: boolean;
  /** Shown on the placeholder when there's no image (the number of a football card). */
  label?: string;
}) {
  const { width, height } = SIZES[size];
  return (
    <span
      className={cn("card-frame", size === "xs" && "card-frame-sm", className)}
      style={{ width }}
      data-foil={foil || undefined}
    >
      {/* Absolutely positioned: the frame's height comes from aspect-ratio, and Safari doesn't
          always resolve a percentage height against it (the image came out cropped). */}
      {src ? (
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          unoptimized
          priority={priority}
          className="absolute inset-0 block h-full w-full object-cover"
        />
      ) : (
        // No image (football cards have none): a card back with its number and, when there's
        // room, its name.
        <span
          className="bg-muted absolute inset-0 flex flex-col items-center justify-center gap-1 p-1.5 text-center"
          aria-hidden
        >
          {label && (
            <span
              className={cn(
                "display text-muted-foreground leading-none font-bold",
                size === "xs" ? "text-[9px]" : size === "sm" ? "text-xs" : "text-lg",
              )}
            >
              {label}
            </span>
          )}
          {(size === "md" || size === "lg") && (
            <span className="text-muted-foreground line-clamp-3 text-[10px] leading-tight">{alt}</span>
          )}
        </span>
      )}
    </span>
  );
}

export function SetIcon({ src, alt }: { src: string | null | undefined; alt: string }) {
  if (!src) return null;
  return (
    <Image
      src={src}
      alt={alt}
      width={16}
      height={16}
      unoptimized
      className="set-icon inline-block size-4"
    />
  );
}
