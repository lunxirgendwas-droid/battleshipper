import { RoomState } from "./types";

const g = globalThis as unknown as { __battleshipper_rooms?: Map<string, RoomState> };
if (!g.__battleshipper_rooms) g.__battleshipper_rooms = new Map();
const rooms = g.__battleshipper_rooms;

const ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function genCode(): string {
  for (let attempt = 0; attempt < 20; attempt++) {
    let c = "";
    for (let i = 0; i < 5; i++) c += ALPH[Math.floor(Math.random() * ALPH.length)];
    if (!rooms.has(c)) return c;
  }
  return Date.now().toString(36).toUpperCase().slice(-5);
}

export function saveRoom(r: RoomState) {
  rooms.set(r.code, r);
}

export function getRoom(code: string): RoomState | null {
  return rooms.get(code.toUpperCase()) ?? null;
}

export function deleteRoom(code: string) {
  rooms.delete(code.toUpperCase());
}

const TTL_MS = 1000 * 60 * 60 * 4;
export function purgeStale() {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.updatedAt > TTL_MS) rooms.delete(code);
  }
}
