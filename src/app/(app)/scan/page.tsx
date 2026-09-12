import type { Metadata } from "next";
import { setOptions } from "@/lib/queries/catalog";
import { collectionOptions } from "@/lib/queries/collections";
import { locationOptions } from "@/lib/queries/locations";
import { pendingScanCount } from "@/lib/queries/pending-scans";
import { requireUser } from "@/lib/session";
import { Scanner } from "./scanner";

export const metadata: Metadata = { title: "Escanear" };

export default async function ScanPage({ searchParams }: PageProps<"/scan">) {
  const user = await requireUser();
  const { set } = await searchParams;
  const [collections, locations, sets, pending] = await Promise.all([
    collectionOptions(user.id),
    locationOptions(user.id),
    setOptions(),
    pendingScanCount(user.id),
  ]);

  // ?set=mtg:m10 (from a set page) starts in fixed-set mode.
  const [game, code] = typeof set === "string" ? set.split(":") : [];
  const fixed = sets.find((s) => s.game === game && s.code === code);

  return (
    <Scanner
      collections={collections}
      locations={locations}
      sets={sets}
      initialFixedSet={fixed ? { game: fixed.game, code: fixed.code } : null}
      initialPending={pending}
      aiEnabled={Boolean(process.env.ANTHROPIC_API_KEY)}
    />
  );
}
