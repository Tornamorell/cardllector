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
}: {
  src: string | null | undefined;
  alt: string;
  size?: keyof typeof SIZES;
  className?: string;
  priority?: boolean;
  foil?: boolean;
}) {
  const { width, height } = SIZES[size];
  return (
    <span
      className={cn("card-frame", size === "xs" && "card-frame-sm", className)}
      style={{ width }}
      data-foil={foil || undefined}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          unoptimized
          priority={priority}
          className="block h-full w-full object-cover"
        />
      ) : (
        <span className="bg-muted block h-full w-full" aria-hidden />
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
