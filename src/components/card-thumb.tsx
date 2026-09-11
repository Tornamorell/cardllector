import Image from "next/image";
import { cn } from "@/lib/utils";

const SIZES = {
  xs: { width: 36, height: 50 },
  sm: { width: 56, height: 78 },
  md: { width: 146, height: 204 },
  lg: { width: 300, height: 418 },
};

/** A card image at Magic's 63×88 proportions, with a placeholder when there's no image. */
export function CardThumb({
  src,
  alt,
  size = "sm",
  className,
  priority,
}: {
  src: string | null | undefined;
  alt: string;
  size?: keyof typeof SIZES;
  className?: string;
  priority?: boolean;
}) {
  const { width, height } = SIZES[size];
  const shape = cn("aspect-[63/88] h-auto rounded-[4.5%] bg-muted", className);
  if (!src) return <div className={shape} style={{ width }} aria-hidden />;
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      unoptimized
      priority={priority}
      className={shape}
      style={{ width }}
    />
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
      className="inline-block size-4 dark:invert"
    />
  );
}
