"use client";

import { LayersIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { SetPicker, type SetOption } from "@/components/set-picker";
import { Button } from "@/components/ui/button";
import { formatInt } from "@/lib/format";
import { addSetToCollection } from "../actions";

// Loaded once per visit, when first asked for (/api/sets): too many to send with every page.
let cached: SetOption[] | null = null;

/**
 * «Añadir una expansión entera»: every card of a set into this collection, one of each. Cards
 * already in it keep the copies wanted (addSetToCollection).
 */
export function AddSetToCollection({ collectionId }: { collectionId: string }) {
  const [sets, setSets] = useState<SetOption[] | null>(cached);
  const [loading, setLoading] = useState(false);
  // Opened by a click: the search opens as soon as the sets arrive.
  const [justLoaded, setJustLoaded] = useState(false);
  const [picked, setPicked] = useState<{ game: string; code: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const set = picked ? sets?.find((s) => s.game === picked.game && s.code === picked.code) : undefined;

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/sets");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      cached = ((await res.json()) as { sets: SetOption[] }).sets;
      setJustLoaded(true);
      setSets(cached);
    } catch {
      toast.error("No se han podido cargar las expansiones.");
    } finally {
      setLoading(false);
    }
  }

  function add() {
    if (!set) return;
    startTransition(async () => {
      try {
        const r = await addSetToCollection(collectionId, {
          game: set.game as "mtg" | "pokemon" | "sports",
          setCode: set.code,
          rarity: null,
        });
        toast.success(`Las ${formatInt(r.added)} cartas de «${set.name}» están en la colección`, {
          description: "Las que ya estaban conservan las copias que quieres.",
        });
        setPicked(null);
      } catch {
        toast.error("No se ha podido añadir la expansión.");
      }
    });
  }

  if (!sets) {
    return (
      <Button variant="outline" size="sm" onClick={load} disabled={loading} aria-busy={loading || undefined}>
        <LayersIcon />
        {loading ? "Cargando expansiones…" : "Añadir una expansión entera…"}
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Añadir entera</span>
      <SetPicker
        sets={sets}
        value={picked}
        onChange={setPicked}
        label="Expansión"
        placeholder="Elige una expansión"
        defaultOpen={justLoaded}
      />
      {set && (
        <Button size="sm" onClick={add} disabled={pending} aria-busy={pending || undefined}>
          {pending ? "Añadiendo…" : "Añadir sus cartas"}
        </Button>
      )}
    </div>
  );
}
