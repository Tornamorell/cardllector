"use client";

import { LoaderCircleIcon, SquarePenIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ThreadSummary } from "@/lib/queries/assistant";
import { cn } from "@/lib/utils";

const when = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" });

/** The user's conversations with the assistant (D37): open one, start another, delete. */
export function ThreadList({
  threads,
  currentId,
  onOpen,
  onNew,
  onRemove,
  className,
}: {
  threads: ThreadSummary[] | null;
  currentId: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  onRemove: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-0 flex-col gap-2", className)}>
      <Button variant="outline" size="sm" className="justify-start" onClick={onNew}>
        <SquarePenIcon />
        Nueva conversación
      </Button>
      {threads === null ? (
        <p className="text-muted-foreground flex items-center gap-1.5 px-1 text-sm">
          <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden />
          Cargando…
        </p>
      ) : threads.length === 0 ? (
        <p className="text-muted-foreground px-1 text-sm">Aún no hay conversaciones.</p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          {threads.map((t) => (
            <li key={t.id} className={cn("flex items-center gap-1 rounded-lg", t.id === currentId && "bg-muted")}>
              <button
                type="button"
                onClick={() => onOpen(t.id)}
                aria-current={t.id === currentId ? "true" : undefined}
                className="hover:bg-muted min-w-0 flex-1 rounded-lg px-2.5 py-1.5 text-left"
              >
                <span className="block truncate text-sm">{t.title}</span>
                <span className="text-muted-foreground text-xs">{when.format(new Date(t.updatedAt))}</span>
              </button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground shrink-0"
                aria-label={`Borrar «${t.title}»`}
                onClick={() => onRemove(t.id)}
              >
                <Trash2Icon />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
