"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { SessionEntry } from "@/lib/scan/session";

// The scanner's session, newest first. Kept on the device (localStorage), so a reload, a locked
// phone or closing the camera doesn't lose the history or the running total. «Empezar sesión
// nueva» clears it; the cards themselves stay in the inventory.

const KEY = "cardllector:scan-session";
const listeners = new Set<() => void>();
// Fallback when storage is unavailable (private mode, blocked site data).
let memory = "";

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function read() {
  try {
    return localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
}

function parse(raw: string): SessionEntry[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function useScanSession() {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  const entries = useMemo(() => parse(raw), [raw]);

  // Updaters read the stored list, not a render's copy: the read loop adds cards from old closures.
  const setEntries = useCallback(
    (update: SessionEntry[] | ((current: SessionEntry[]) => SessionEntry[])) => {
      const next = typeof update === "function" ? update(parse(read())) : update;
      memory = JSON.stringify(next);
      try {
        localStorage.setItem(KEY, memory);
      } catch {
        // Keep the in-memory copy.
      }
      listeners.forEach((l) => l());
    },
    [],
  );

  return [entries, setEntries] as const;
}
