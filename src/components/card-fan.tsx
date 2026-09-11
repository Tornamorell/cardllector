import { CardThumb } from "@/components/card-thumb";
import { cn } from "@/lib/utils";

const CARD = { sm: 88, md: 120 };

/**
 * Cards held like a hand: overlapping, each one turned a little around its bottom edge.
 * Used where the cards themselves are the point — the dashboard's most valuable cards, the
 * game tiles in the catalog.
 */
export function CardFan({
  cards,
  size = "md",
  className,
}: {
  cards: Array<{ src: string | null; alt: string; foil?: boolean }>;
  size?: keyof typeof CARD;
  className?: string;
}) {
  if (!cards.length) return null;
  const w = CARD[size];
  const h = Math.round((w * 88) / 63);
  const spread = w * 0.42;
  const center = (cards.length - 1) / 2;

  return (
    <div
      className={cn("card-fan relative mx-auto", className)}
      style={{ width: w + spread * (cards.length - 1) + w * 0.3, height: h + w * 0.25 }}
      aria-hidden
    >
      {cards.map((card, i) => {
        const offset = i - center;
        return (
          <div
            key={`${card.src}-${i}`}
            className="absolute bottom-0 left-1/2 origin-bottom"
            style={{
              marginLeft: -w / 2,
              transform: `translateX(${offset * spread}px) translateY(${Math.abs(offset) * 6}px) rotate(${offset * 8}deg)`,
              zIndex: i,
            }}
          >
            <CardThumb
              src={card.src}
              alt={card.alt}
              size="md"
              foil={card.foil}
              className={size === "sm" ? "w-[88px]!" : "w-[120px]!"}
            />
          </div>
        );
      })}
    </div>
  );
}
