import { RoomState } from "./types";

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const useUpstash = !!(UPSTASH_URL && UPSTASH_TOKEN);

const g = globalThis as unknown as { __bs_rooms?: Map<string, RoomState> };
if (!g.__bs_rooms) g.__bs_rooms = new Map();
const mem = g.__bs_rooms;

const PREFIX = "bs:room:";
const TTL_SECONDS = 60 * 60 * 4;
const ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

async function upstash(args: (string | number)[]): Promise<any> {
  const res = await fetch(UPSTASH_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
    },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  const data = await res.json();
  return data.result;
}

export async function getRoom(code: string): Promise<RoomState | null> {
  const key = code.toUpperCase();
  if (useUpstash) {
    try {
      const raw = await upstash(["GET", PREFIX + key]);
      if (!raw) return null;
      return JSON.parse(raw) as RoomState;
    } catch (e) {
      console.error("Upstash GET failed", e);
      return null;
    }
  }
  return mem.get(key) ?? null;
}

export async function saveRoom(r: RoomState): Promise<void> {
  const key = r.code.toUpperCase();
  if (useUpstash) {
    try {
      await upstash(["SET", PREFIX + key, JSON.stringify(r), "EX", TTL_SECONDS]);
      return;
    } catch (e) {
      console.error("Upstash SET failed, falling back to memory", e);
    }
  }
  mem.set(key, r);
}

export async function deleteRoom(code: string): Promise<void> {
  const key = code.toUpperCase();
  if (useUpstash) {
    try { await upstash(["DEL", PREFIX + key]); } catch {}
  }
  mem.delete(key);
}

export async function genCode(): Promise<string> {
  for (let i = 0; i < 30; i++) {
    let c = "";
    for (let j = 0; j < 5; j++) c += ALPH[Math.floor(Math.random() * ALPH.length)];
    const exists = await getRoom(c);
    if (!exists) return c;
  }
  return Date.now().toString(36).toUpperCase().slice(-5);
}

export async function purgeStale(): Promise<void> {
  if (useUpstash) return;
  const now = Date.now();
  for (const [k, r] of mem.entries()) {
    if (now - r.updatedAt > TTL_SECONDS * 1000) mem.delete(k);
  }
}
