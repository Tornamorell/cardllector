import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { createGunzip } from "node:zlib";
import type { ScryfallBulkEntry, ScryfallSet } from "./types";

const API = "https://api.scryfall.com";

// Scryfall requires an accurate User-Agent and an Accept header on every API request.
const HEADERS = {
  "User-Agent": "Cardllector/0.1",
  Accept: "application/json",
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Scryfall ${res.status} ${res.statusText} for ${url}`);
  return (await res.json()) as T;
}

export async function getBulkEntry(type: ScryfallBulkEntry["type"]): Promise<ScryfallBulkEntry> {
  const { data } = await getJson<{ data: ScryfallBulkEntry[] }>(`${API}/bulk-data`);
  const entry = data.find((e) => e.type === type);
  if (!entry) throw new Error(`Scryfall bulk data "${type}" not found`);
  return entry;
}

export async function getAllSets(): Promise<ScryfallSet[]> {
  const { data } = await getJson<{ data: ScryfallSet[] }>(`${API}/sets`);
  return data;
}

/**
 * Streams a gzipped JSONL bulk file line by line, so the whole file (hundreds of MB once
 * decompressed) never sits in memory. The file host (*.scryfall.io) has no rate limits.
 */
export async function* streamBulkLines(url: string): AsyncGenerator<string> {
  const res = await fetch(url, { headers: { "User-Agent": HEADERS["User-Agent"] } });
  if (!res.ok || !res.body) throw new Error(`Bulk download failed: ${res.status} for ${url}`);

  const input = Readable.fromWeb(res.body as WebReadableStream).pipe(createGunzip());
  const lines = createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    if (line.trim()) yield line;
  }
}
