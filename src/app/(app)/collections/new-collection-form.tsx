"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { gameById } from "@/lib/games";
import { createCollection } from "./actions";

type SetOption = { game: string; code: string; name: string };

const setLabel = (s: SetOption) =>
  `${s.name} (${s.code.toUpperCase()} · ${gameById(s.game)?.shortName ?? s.game})`;

/**
 * New collection: a name and, optionally, a set to start it with every one of its cards —
 * a whole expansion, or later a whole sticker album.
 */
export function NewCollectionForm({ sets }: { sets: SetOption[] }) {
  const [name, setName] = useState("");
  const [setText, setSetText] = useState("");
  const chosen = sets.find((s) => setLabel(s) === setText) ?? null;
  const unmatched = setText.trim() !== "" && !chosen;

  return (
    <form action={createCollection} className="grid w-full gap-2 sm:w-auto sm:min-w-[26rem]">
      <div className="flex gap-2">
        <Input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nueva colección…"
          required
          maxLength={80}
          aria-label="Nombre de la colección"
        />
        <SubmitButton pendingText="Creando…" disabled={unmatched}>
          Crear
        </SubmitButton>
      </div>
      <Input
        list="new-collection-sets"
        value={setText}
        onChange={(e) => {
          const text = e.target.value;
          setSetText(text);
          const set = sets.find((s) => setLabel(s) === text);
          if (set && !name.trim()) setName(set.name);
        }}
        placeholder="Opcional: con todas las cartas de una expansión"
        aria-label="Expansión con la que llenar la colección"
      />
      <datalist id="new-collection-sets">
        {sets.map((s) => (
          <option key={`${s.game}:${s.code}`} value={setLabel(s)} />
        ))}
      </datalist>
      {chosen && <input type="hidden" name="set" value={`${chosen.game}:${chosen.code}`} />}
      {unmatched && (
        <p className="text-muted-foreground text-xs">Elige la expansión de la lista, o déjalo vacío.</p>
      )}
    </form>
  );
}
