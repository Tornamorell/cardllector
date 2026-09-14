"use client";

import { ArrowUpIcon, LoaderCircleIcon, SparklesIcon, SquareIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Answer } from "./answer";
import type { Assistant } from "./use-assistant";

const dollars = (n: number) => `${n.toFixed(2).replace(".", ",")} $`;

/** A conversation and the box to ask in (D37): in the floating chat and on /assistant. */
export function ChatView({
  a,
  path,
  suggestions,
  onLinkClick,
  autoFocus,
  className,
}: {
  a: Assistant;
  /** The page the user has open, sent with each question. */
  path: string | null;
  suggestions: string[];
  onLinkClick?: () => void;
  autoFocus?: boolean;
  className?: string;
}) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [a.messages.length, a.answer, a.loading]);

  if (a.status && !a.status.enabled) {
    return (
      <p className={cn("text-muted-foreground p-3 text-sm", className)}>
        El asistente no está configurado: falta la clave de la API de Anthropic (`ANTHROPIC_API_KEY`).
      </p>
    );
  }

  const send = (text: string) => {
    if (!text.trim() || a.busy) return;
    setDraft("");
    void a.ask(text, path);
  };
  const spent = a.remaining !== null && a.remaining <= 0;
  const empty = a.messages.length === 0 && !a.busy;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {a.loading ? (
          <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden />
            Cargando la conversación…
          </p>
        ) : empty ? (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Pregúntale por tus cartas, colecciones, mazos o precios. Busca en tus datos antes de responder y enlaza lo
              que menciona. Solo lee: no cambia nada.
            </p>
            <ul className="space-y-2">
              {suggestions.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => send(s)}
                    disabled={spent}
                    className="hover:bg-muted w-full rounded-xl border px-3 py-2 text-left text-sm transition-colors disabled:opacity-50"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ol className="space-y-5">
            {a.messages.map((t, i) =>
              t.role === "user" ? (
                <li key={i} className="flex justify-end">
                  <p className="bg-primary/12 max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2 text-sm whitespace-pre-wrap">
                    {t.content}
                  </p>
                </li>
              ) : (
                <li key={i} className="flex gap-2.5">
                  <SparklesIcon className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <Answer text={t.content} onLinkClick={onLinkClick} />
                  </div>
                </li>
              ),
            )}
            {a.busy && (
              <li className="flex gap-2.5" aria-live="polite">
                <SparklesIcon className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
                <div className="min-w-0 flex-1 space-y-2">
                  {a.answer ? <Answer text={a.answer} onLinkClick={onLinkClick} /> : null}
                  {(a.activity || !a.answer) && (
                    <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                      <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden />
                      {a.activity ? `${a.activity}…` : "Pensando…"}
                    </p>
                  )}
                </div>
              </li>
            )}
          </ol>
        )}
        {a.error && (
          <p role="alert" className="text-destructive text-sm">
            {a.error}
          </p>
        )}
      </div>

      <form
        className="space-y-1.5 border-t px-3 pt-2 pb-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <div className="bg-card focus-within:ring-ring/50 flex items-end gap-2 rounded-2xl border p-1.5 focus-within:ring-2">
          <label htmlFor="assistant-question" className="sr-only">
            Tu pregunta
          </label>
          <textarea
            id="assistant-question"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(draft);
              }
            }}
            rows={Math.min(5, Math.max(1, draft.split("\n").length))}
            placeholder="Pregunta por tus cartas, colecciones o mazos…"
            className="placeholder:text-muted-foreground max-h-36 min-h-9 flex-1 resize-none bg-transparent px-1.5 py-1.5 text-sm outline-none"
            disabled={spent}
            autoFocus={autoFocus}
          />
          {a.busy ? (
            <Button type="button" size="icon" variant="secondary" onClick={a.stop} aria-label="Parar">
              <SquareIcon />
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={!draft.trim() || spent} aria-label="Preguntar">
              <ArrowUpIcon />
            </Button>
          )}
        </div>
        {a.status && (
          <p className={cn("text-muted-foreground px-1 text-xs", spent && "text-destructive")}>
            {spent
              ? `Has usado los ${dollars(a.status.limitUsd)} de este mes. Vuelve a estar disponible el día 1.`
              : `Este mes te quedan ${dollars(a.remaining ?? 0)} de ${dollars(a.status.limitUsd)}.`}
          </p>
        )}
      </form>
    </div>
  );
}
