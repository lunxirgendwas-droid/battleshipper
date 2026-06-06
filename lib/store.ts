import type { Redis } from "ioredis";
import { RoomState } from "./types";

const REDIS_URL = process.env.REDIS_URL;
const useRedis = !!REDIS_URL;

const g = globalThis as unknown as {
  __bs_rooms?: Map<string, RoomState>;
  __bs_redis?: Redis | null;
  __bs_redis_promise?: Promise<Redis> | null;
};
if (!g.__bs_rooms) g.__bs_rooms = new Map();
const mem = g.__bs_rooms;

const PREFIX = "bs:room:";
const TTL_SECONDS = 60 * 60 * 4;
const ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

async function getClient(): Promise<Redis> {
  if (g.__bs_redis) return g.__bs_redis;
  if (!g.__bs_redis_promise) {
    g.__bs_redis_promise = (async () => {
      const { default: Redis } = await import("ioredis");
      const isTls = REDIS_URL!.startsWith("rediss://");
      const client = new Redis(REDIS_URL!, {
        lazyConnect: false,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        ...(isTls ? { tls: {} } : {}),
      });
      client.on("error", (e) => console.error("Redis error:", e.message));
      g.__bs_redis = client;
      return client;
    })();
  }
  return g.__bs_redis_promise;
}

export async function getRoom(code: string): Promise<RoomState | null> {
  const key = code.toUpperCase();
  if (useRedis) {
    try {
      const c = await getClient();
      const raw = await c.get(PREFIX + key);
      if (!raw) return null;
      return JSON.parse(raw) as RoomState;
    } catch (e) {
      console.error("Redis GET failed", e);
      return mem.get(key) ?? null;
    }
  }
  return mem.get(key) ?? null;
}

export async function saveRoom(r: RoomState): Promise<void> {
  const key = r.code.toUpperCase();
  if (useRedis) {
    try {
      const c = await getClient();
      await c.set(PREFIX + key, JSON.stringify(r), "EX", TTL_SECONDS);
      return;
    } catch (e) {
      console.error("Redis SET failed, falling back to memory", e);
    }
  }
  mem.set(key, r);
}

export async function deleteRoom(code: string): Promise<void> {
  const key = code.toUpperCase();
  if (useRedis) {
    try {
      const c = await getClient();
      await c.del(PREFIX + key);
    } catch {}
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
  if (useRedis) return;
  const now = Date.now();
  for (const [k, r] of mem.entries()) {
    if (now - r.updatedAt > TTL_SECONDS * 1000) mem.delete(k);
  }
}
