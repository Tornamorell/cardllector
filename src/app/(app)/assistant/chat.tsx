"use client";

import { ArrowUpIcon, LoaderCircleIcon, SparklesIcon, SquareIcon, SquarePenIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { TOOL_LABELS, type ChatEvent } from "@/lib/assistant/events";
import type { ChatTurn } from "@/lib/assistant/history";
import { cn } from "@/lib/utils";
import { Answer } from "./answer";

const SUGGESTIONS = [
  "¿Cuáles son mis 10 cartas más valiosas y dónde están?",
  "¿Cuánto ha cambiado el valor de mis cartas este mes?",
  "¿Qué me falta para completar mis colecciones y cuánto costaría?",
  "¿A alguno de mis mazos le falta rampa o robo? ¿Qué tengo suelto que encaje?",
];

// The conversation lives in this browser (localStorage), per account.
const listeners = new Set<() => void>();
const memory = new Map<string, string>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readSaved(key: string) {
  try {
    return localStorage.getItem(key) ?? memory.get(key) ?? "";
  } catch {
    return memory.get(key) ?? "";
  }
}

function useSavedTurns(key: string) {
  const raw = useSyncExternalStore(subscribe, () => readSaved(key), () => "");
  const turns = useMemo<ChatTurn[]>(() => {
    try {
      return raw ? (JSON.parse(raw) as ChatTurn[]) : [];
    } catch {
      return [];
    }
  }, [raw]);
  const save = useCallback(
    (next: ChatTurn[]) => {
      const value = next.length ? JSON.stringify(next) : "";
      memory.set(key, value);
      try {
        if (value) localStorage.setItem(key, value);
        else localStorage.removeItem(key);
      } catch {
        // Kept in memory for this visit.
      }
      listeners.forEach((l) => l());
    },
    [key],
  );
  return [turns, save] as const;
}

const dollars = (n: number) => `${n.toFixed(2).replace(".", ",")} $`;

/** The assistant's chat (D37): questions, answers as they arrive, and what it's looking up. */
export function Chat({
  userId,
  enabled,
  spentUsd,
  limitUsd,
}: {
  userId: string;
  enabled: boolean;
  spentUsd: number;
  limitUsd: number;
}) {
  const [turns, save] = useSavedTurns(`cardllector:assistant:${userId}`);
  const [draft, setDraft] = useState("");
  // The answer arriving, or null when none is.
  const [answer, setAnswer] = useState<string | null>(null);
  const [activity, setActivity] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(Math.max(0, limitUsd - spentUsd));
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const busy = answer !== null;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [turns.length, answer]);

  async function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const history: ChatTurn[] = [...turns, { role: "user", content: question }];
    save(history);
    setDraft("");
    setError(null);
    setAnswer("");
    setActivity(null);
    const controller = new AbortController();
    abortRef.current = controller;
    let written = "";
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se ha podido preguntar al asistente.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line) continue;
          const event = JSON.parse(line) as ChatEvent;
          if (event.type === "text") {
            written += event.text;
            setAnswer(written);
            setActivity(null);
          } else if (event.type === "tool") {
            setActivity(TOOL_LABELS[event.tool] ?? "Consultando tus datos");
          } else if (event.type === "error") {
            setError(event.message);
          } else {
            setRemaining(event.remainingUsd);
          }
        }
      }
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "No se ha podido preguntar al asistente.");
    } finally {
      if (written.trim()) save([...history, { role: "assistant", content: written }]);
      setAnswer(null);
      setActivity(null);
      abortRef.current = null;
    }
  }

  function startOver() {
    abortRef.current?.abort();
    save([]);
    setError(null);
  }

  if (!enabled) {
    return (
      <p className="text-muted-foreground text-sm">
        El asistente no está configurado: falta la clave de la API de Anthropic (`ANTHROPIC_API_KEY`).
      </p>
    );
  }

  const empty = turns.length === 0 && !busy;
  return (
    <div className="flex flex-col gap-5">
      {turns.length > 0 && (
        <div className="-mt-12 flex justify-end">
          <Button variant="ghost" size="sm" onClick={startOver}>
            <SquarePenIcon />
            Nueva conversación
          </Button>
        </div>
      )}

      {empty ? (
        <div className="space-y-4">
          <p className="text-muted-foreground max-w-prose text-sm">
            Pregúntale por tus cartas, tus colecciones, tus mazos o cómo se mueven los precios. Busca en tus datos
            antes de responder y enlaza lo que menciona. Solo lee: no cambia nada.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {SUGGESTIONS.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => void ask(s)}
                  className="hover:bg-muted h-full w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-colors"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ol className="space-y-5">
          {turns.map((t, i) =>
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
                  <Answer text={t.content} />
                </div>
              </li>
            ),
          )}
          {busy && (
            <li className="flex gap-2.5" aria-live="polite">
              <SparklesIcon className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1 space-y-2">
                {answer ? <Answer text={answer} /> : null}
                {(activity || !answer) && (
                  <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                    <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden />
                    {activity ? `${activity}…` : "Pensando…"}
                  </p>
                )}
              </div>
            </li>
          )}
        </ol>
      )}

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <div ref={endRef} />

      <form
        className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] -mx-1 space-y-1.5 px-1 pt-2 pb-1 backdrop-blur md:bottom-3"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(draft);
        }}
      >
        <div className="bg-card focus-within:ring-ring/50 flex items-end gap-2 rounded-2xl border p-2 focus-within:ring-2">
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
                void ask(draft);
              }
            }}
            rows={Math.min(6, Math.max(1, draft.split("\n").length))}
            placeholder="Pregunta por tus cartas, colecciones o mazos…"
            className="placeholder:text-muted-foreground max-h-40 min-h-9 flex-1 resize-none bg-transparent px-1.5 py-1.5 text-sm outline-none"
            disabled={remaining <= 0}
          />
          {busy ? (
            <Button type="button" size="icon" variant="secondary" onClick={() => abortRef.current?.abort()} aria-label="Parar">
              <SquareIcon />
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={!draft.trim() || remaining <= 0} aria-label="Preguntar">
              <ArrowUpIcon />
            </Button>
          )}
        </div>
        <p className={cn("text-muted-foreground px-1 text-xs", remaining <= 0 && "text-destructive")}>
          {remaining > 0
            ? `Este mes te quedan ${dollars(remaining)} de ${dollars(limitUsd)}. Cada pregunta cuesta unos céntimos.`
            : `Has usado los ${dollars(limitUsd)} de este mes. Vuelve a estar disponible el día 1.`}
        </p>
      </form>
    </div>
  );
}
