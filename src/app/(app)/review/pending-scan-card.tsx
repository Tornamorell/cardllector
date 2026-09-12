"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CardSearchBox, useCardPicker } from "@/components/card-picker";
import { CardPickerRow } from "@/components/card-picker-row";
import {
  ConditionSelect,
  FinishSelect,
  LanguageSelect,
  finishFor,
} from "@/components/stack-fields";
import { Button } from "@/components/ui/button";
import { placeLabel } from "@/lib/format";
import { gameById, type Finish } from "@/lib/games";
import type { PendingScan } from "@/lib/queries/pending-scans";
import { discardPendingScan, resolvePendingScan } from "./actions";

// Fixed zone so the server and the browser print the same thing.
const savedAt = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});

/** One photo from the queue: search the card (prefilled with what the title read) and add it. */
export function PendingScanCard({ scan }: { scan: PendingScan }) {
  const picker = useCardPicker(null, scan.guess ?? "");
  const [finish, setFinish] = useState<Finish>(scan.finish);
  const [condition, setCondition] = useState(scan.condition);
  const [language, setLanguage] = useState(scan.language);
  const [pending, startTransition] = useTransition();
  const printing = picker.printing;
  const cardFinish = printing ? (finishFor(finish, printing.finishes) as Finish) : finish;

  function add() {
    if (!printing) return;
    startTransition(async () => {
      try {
        const r = await resolvePendingScan(scan.id, {
          catalogCardId: printing.id,
          finish: cardFinish,
          condition,
          language,
        });
        if (r.ok) toast.success(`${r.name} añadida a tus cartas`);
      } catch {
        toast.error("No se ha podido añadir la carta.");
      }
    });
  }

  function discard() {
    startTransition(async () => {
      try {
        await discardPendingScan(scan.id);
      } catch {
        toast.error("No se ha podido descartar.");
      }
    });
  }

  const target = [
    scan.location ? `en ${placeLabel(scan.location.name, scan.section?.name)}` : "sin ubicación",
    scan.collection && `y en «${scan.collection.name}»`,
  ]
    .filter(Boolean)
    .join(" ");
  const photo = `/api/pending-scans/${scan.id}`;

  return (
    <article className="bg-card flex flex-col gap-4 rounded-xl border p-4 sm:flex-row">
      <a href={photo} target="_blank" rel="noreferrer" className="shrink-0 self-start" title="Ver la foto">
        {/* A private photo from our own API: next/image would only add a cache hop. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} alt="Foto de la carta" className="w-40 rounded-lg" />
      </a>
      <div className="min-w-0 flex-1 space-y-3">
        <p className="text-muted-foreground text-xs">
          Guardada el {savedAt.format(new Date(scan.createdAt))}. Se añadirá {target}.
        </p>
        {scan.readText && (
          <p className="text-muted-foreground line-clamp-2 text-xs">Leyó: {scan.readText}</p>
        )}
        <CardSearchBox
          picker={picker}
          onSubmit={add}
          placeholder="Busca la carta por su nombre"
          label="Buscar la carta"
        />
        {picker.selected && printing && (
          <CardPickerRow picker={picker}>
            <FinishSelect
              value={cardFinish}
              available={printing.finishes}
              labels={gameById(printing.game)?.finishLabels}
              onChange={setFinish}
            />
            <ConditionSelect value={condition} onChange={setCondition} />
            <LanguageSelect value={language} onChange={setLanguage} />
          </CardPickerRow>
        )}
        <div className="flex gap-2">
          <Button id={picker.submitId} onClick={add} disabled={!printing || pending}>
            {pending ? "Añadiendo…" : "Añadir"}
          </Button>
          <Button variant="ghost" onClick={discard} disabled={pending}>
            Descartar
          </Button>
        </div>
      </div>
    </article>
  );
}
