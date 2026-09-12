"use client";

import { ChevronsUpDownIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { SetIcon } from "@/components/card-thumb";
import { selectClass } from "@/components/stack-fields";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { GAMES } from "@/lib/games";
import { normalizeForSearch } from "@/lib/search/normalize";
import { cn } from "@/lib/utils";

export type SetOption = {
  game: string;
  code: string;
  name: string;
  setType?: string | null;
  iconUri?: string | null;
  releasedAt?: string | null;
};

type SetRef = { game: string; code: string };

const keyOf = (s: SetRef) => `${s.game}:${s.code}`;

// Football albums first: there are few, and the scanner can only read them with the album fixed.
const GAME_ORDER = [...GAMES].sort((a, b) => Number(b.id === "sports") - Number(a.id === "sports"));

/**
 * Optional set, searched by name or code across games, newest first within each. Replaces a
 * native datalist, which was hard to use on iOS and fixed nothing unless a suggestion was
 * tapped.
 */
export function SetPicker({
  sets,
  value,
  onChange,
  label = "Expansión fija",
}: {
  sets: SetOption[];
  value: SetRef | null;
  onChange: (set: SetRef | null) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? (sets.find((s) => keyOf(s) === keyOf(value)) ?? null) : null;
  const groups = GAME_ORDER.map((game) => ({ game, sets: sets.filter((s) => s.game === game.id) })).filter(
    (g) => g.sets.length,
  );

  return (
    <>
      <div className="flex max-w-sm min-w-0 flex-1 items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(selectClass, "flex min-w-0 flex-1 items-center gap-2 text-left")}
          aria-haspopup="dialog"
          aria-label={selected ? `${label}: ${selected.name}` : label}
        >
          {selected ? (
            <>
              <SetIcon src={selected.iconUri} alt="" />
              <span className="min-w-0 truncate">{selected.name}</span>
              <span className="text-muted-foreground shrink-0 text-xs">{selected.code.toUpperCase()}</span>
            </>
          ) : (
            <span className="text-muted-foreground">Ninguna</span>
          )}
          <ChevronsUpDownIcon className="text-muted-foreground ml-auto size-4 shrink-0" />
        </button>
        {selected && (
          <Button variant="ghost" size="icon-sm" onClick={() => onChange(null)} aria-label={`Quitar ${label.toLowerCase()}`}>
            <XIcon />
          </Button>
        )}
      </div>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title={label}
        description="Busca una expansión o un álbum por nombre o código."
        // Near the top on phones, so the list stays above the keyboard.
        className="top-4 sm:top-1/3"
      >
        <Command>
          <CommandInput placeholder="Nombre o código…" />
          <CommandList className="max-h-[min(24rem,55dvh)]">
            <CommandEmpty>No hay ninguna expansión con ese nombre o código.</CommandEmpty>
            {groups.map(({ game, sets: gameSets }) => (
              <CommandGroup key={game.id} heading={game.shortName}>
                {gameSets.map((s) => (
                  <CommandItem
                    key={keyOf(s)}
                    value={keyOf(s)}
                    keywords={[s.name, normalizeForSearch(s.name), s.code]}
                    data-checked={selected ? keyOf(selected) === keyOf(s) : undefined}
                    onSelect={() => {
                      onChange({ game: s.game, code: s.code });
                      setOpen(false);
                    }}
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center">
                      <SetIcon src={s.iconUri} alt="" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                      {s.code.toUpperCase()}
                      {s.releasedAt ? ` · ${s.releasedAt.slice(0, 4)}` : ""}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
