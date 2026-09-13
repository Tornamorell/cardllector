import type { Metadata } from "next";
import Link from "next/link";
import { CardThumb } from "@/components/card-thumb";
import { ListsSwitcher } from "@/components/lists-switcher";
import { ColorIdentity } from "@/components/mana-cost";
import { ProgressMeter } from "@/components/progress-meter";
import { analyzeDeck } from "@/lib/decks/analysis";
import { formatEur } from "@/lib/format";
import { deckCardRows, listDecks, type DeckCardRow } from "@/lib/queries/decks";
import { requireUser } from "@/lib/session";
import { NewDeckForm } from "./new-deck-form";

export const metadata: Metadata = { title: "Mazos" };

/** Copies of the played cards (commander and main deck) already in the deck's box. */
function boxCoverage(rows: DeckCardRow[]) {
  const byCard = new Map<string, { want: number; inBox: number }>();
  for (const r of rows) {
    if (r.board !== "commander" && r.board !== "main") continue;
    const seen = byCard.get(r.oracleId);
    byCard.set(r.oracleId, { want: (seen?.want ?? 0) + r.quantity, inBox: r.inBox });
  }
  let covered = 0;
  for (const { want, inBox } of byCard.values()) covered += Math.min(want, inBox);
  return covered;
}

export default async function DecksPage() {
  const user = await requireUser();
  const [decks, rows] = await Promise.all([listDecks(user.id), deckCardRows(user.id)]);

  return (
    <div className="space-y-6">
      <ListsSwitcher current="decks" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Mazos</h1>
          <p className="text-muted-foreground max-w-prose text-sm">
            Tus mazos de Commander, con su análisis: curva de maná, tipos, colores y si cumplen las
            reglas. Cada mazo tiene su caja, una ubicación: lo que metes en ella está en el mazo, y te
            dice qué cartas tienes en otro sitio y cuáles te faltan.
          </p>
        </div>
        <NewDeckForm />
      </div>

      {!decks.length ? (
        <p className="text-muted-foreground text-sm">
          Aún no tienes mazos. Crea uno y pega su lista de Moxfield o Arena, o añádele cartas una a una.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((d) => {
            const deckRows = rows.filter((r) => r.deckId === d.id);
            const a = analyzeDeck(deckRows);
            const commanders = deckRows.filter((r) => r.board === "commander");
            const covered = boxCoverage(deckRows);
            return (
              <li key={d.id}>
                <Link
                  href={`/decks/${d.id}`}
                  className="bg-card hover:border-primary/60 flex h-full gap-4 rounded-xl border p-4 transition-colors"
                >
                  <div className="flex shrink-0 -space-x-6">
                    {commanders.length ? (
                      commanders.map((c) => <CardThumb key={c.oracleId} src={c.imageSmall} alt={c.name} size="sm" />)
                    ) : (
                      <CardThumb src={null} alt="Sin comandante" size="sm" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="space-y-0.5">
                      <h2 className="truncate text-lg font-bold">{d.name}</h2>
                      <p className="text-muted-foreground truncate text-xs">
                        {commanders.map((c) => c.name).join(" y ") || "Sin comandante"}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <ColorIdentity colors={a.identity} />
                      <span className="tabular-nums">{a.size}/100</span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs">
                        En la caja: {covered} de {a.size}
                      </p>
                      <ProgressMeter value={covered} max={Math.max(a.size, 1)} showLabel={false} className="w-full" />
                    </div>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-primary font-semibold">{formatEur(a.price)}</span>
                      <span className={a.issues.length ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}>
                        {a.issues.length
                          ? `${a.issues.length} ${a.issues.length === 1 ? "aviso" : "avisos"}`
                          : "Cumple las reglas"}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
