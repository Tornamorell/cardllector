"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { TOOL_LABELS, type ChatEvent } from "@/lib/assistant/events";
import type { ChatTurn } from "@/lib/assistant/history";
import type { ThreadSummary } from "@/lib/queries/assistant";
import { assistantStatus, assistantThread, assistantThreads, deleteAssistantThread } from "./actions";

type Status = { enabled: boolean; spentUsd: number; limitUsd: number };

// The conversation open last on this device, to pick it up again.
function remember(key: string, id: string | null) {
  try {
    if (id) localStorage.setItem(key, id);
    else localStorage.removeItem(key);
  } catch {
    // Starts with a new conversation next time.
  }
}

function recall(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export type Assistant = ReturnType<typeof useAssistant>;

/**
 * The assistant's state (D37), for the floating chat and the /assistant page: the open
 * conversation, the answer arriving, and the list of conversations. Nothing loads until
 * `active`: the floating chat only once it's first opened.
 */
export function useAssistant(userId: string, { active, initialThreadId }: { active: boolean; initialThreadId?: string | null }) {
  const key = `cardllector:assistant:thread:${userId}`;
  const [status, setStatus] = useState<Status | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  // The answer arriving, or null when none is.
  const [answer, setAnswer] = useState<string | null>(null);
  const [activity, setActivity] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [threads, setThreads] = useState<ThreadSummary[] | null>(null);
  const startedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const show = useCallback(
    (thread: { id: string; title: string; messages: ChatTurn[] } | null) => {
      remember(key, thread?.id ?? null);
      setThreadId(thread?.id ?? null);
      setTitle(thread?.title ?? null);
      setMessages(thread?.messages ?? []);
    },
    [key],
  );

  const open = useCallback(
    async (id: string | null) => {
      abortRef.current?.abort();
      setError(null);
      if (!id) return show(null);
      setLoading(true);
      const thread = await assistantThread(id).catch(() => null);
      setLoading(false);
      show(thread);
    },
    [show],
  );

  const refreshThreads = useCallback(async () => {
    setThreads(await assistantThreads().catch(() => []));
  }, []);

  // Once active: this month's spend, and the conversation to show.
  useEffect(() => {
    if (!active || startedRef.current) return;
    startedRef.current = true;
    void (async () => {
      setStatus(await assistantStatus().catch(() => null));
      const id = initialThreadId ?? recall(key);
      if (id) await open(id);
    })();
  }, [active, initialThreadId, key, open]);

  async function ask(text: string, path: string | null) {
    const question = text.trim();
    if (!question || answer !== null) return;
    setError(null);
    setMessages((m) => [...m, { role: "user", content: question }]);
    setAnswer("");
    setActivity(null);
    const controller = new AbortController();
    abortRef.current = controller;
    let written = "";
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, question, path }),
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
          if (event.type === "thread") {
            remember(key, event.id);
            setThreadId(event.id);
            setTitle(event.title);
          } else if (event.type === "text") {
            written += event.text;
            setAnswer(written);
            setActivity(null);
          } else if (event.type === "tool") {
            setActivity(TOOL_LABELS[event.tool] ?? "Consultando tus datos");
          } else if (event.type === "error") {
            setError(event.message);
          } else {
            setStatus((s) => s && { ...s, spentUsd: s.limitUsd - event.remainingUsd });
          }
        }
      }
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "No se ha podido preguntar al asistente.");
    } finally {
      if (written.trim()) setMessages((m) => [...m, { role: "assistant", content: written }]);
      setAnswer(null);
      setActivity(null);
      abortRef.current = null;
      if (threads) void refreshThreads();
    }
  }

  async function remove(id: string) {
    try {
      await deleteAssistantThread(id);
    } catch {
      toast.error("No se ha podido borrar la conversación.");
      return;
    }
    setThreads((list) => list?.filter((t) => t.id !== id) ?? null);
    if (id === threadId) show(null);
    toast.success("Conversación borrada.");
  }

  return {
    status,
    remaining: status ? Math.max(0, status.limitUsd - status.spentUsd) : null,
    threadId,
    title,
    messages,
    answer,
    activity,
    error,
    busy: answer !== null,
    loading,
    threads,
    refreshThreads,
    open,
    ask,
    stop: () => abortRef.current?.abort(),
    remove,
  };
}
