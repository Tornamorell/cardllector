"use client";

import Image from "next/image";
import { useRef } from "react";

/**
 * The big card on a card page: it tilts towards the pointer and catches the light, like
 * turning a card under a lamp. Foil-only printings also show the iridescent sheen. Tilt is
 * off for people who prefer reduced motion (globals.css).
 */
export function HoloCard({
  src,
  alt,
  foil,
  label,
}: {
  src: string | null;
  alt: string;
  foil?: boolean;
  /** Shown on the placeholder when there's no image (a football card's number). */
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el || e.pointerType === "touch") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--rx", `${((0.5 - y) * 14).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${((x - 0.5) * 18).toFixed(2)}deg`);
    el.style.setProperty("--gx", `${(x * 100).toFixed(1)}%`);
    el.style.setProperty("--gy", `${(y * 100).toFixed(1)}%`);
    el.dataset.active = "true";
  }

  function onPointerLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.removeProperty("--rx");
    el.style.removeProperty("--ry");
    delete el.dataset.active;
  }

  return (
    <div className="holo-stage mx-auto md:mx-0">
      <div
        ref={ref}
        className="holo-card card-frame"
        data-foil={foil || undefined}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        {src ? (
          <Image
            src={src}
            alt={alt}
            width={300}
            height={418}
            unoptimized
            priority
            className="block h-full w-full object-cover"
          />
        ) : (
          <span
            className="bg-muted absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center"
            aria-hidden
          >
            {label && <span className="display text-muted-foreground text-4xl font-bold">{label}</span>}
            <span className="text-muted-foreground text-sm">{alt}</span>
          </span>
        )}
      </div>
    </div>
  );
}
