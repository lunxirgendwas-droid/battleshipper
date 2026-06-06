import { NextRequest, NextResponse } from "next/server";
import { getRoom, saveRoom } from "@/lib/store";
import { makePlayer } from "@/lib/game";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const room = getRoom(code);
  if (!room) return NextResponse.json({ error: "Raum nicht gefunden." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const name: string = (body.name || "").toString().trim().slice(0, 20);
  const playerId: string = (body.playerId || "").toString().trim().slice(0, 64);
  if (!name) return NextResponse.json({ error: "Name fehlt." }, { status: 400 });
  if (!playerId) return NextResponse.json({ error: "Spieler-ID fehlt." }, { status: 400 });

  if (room.players.some(p => p.id === playerId)) {
    return NextResponse.json({ ok: true, code: room.code });
  }
  if (room.players.length >= 2) {
    return NextResponse.json({ error: "Raum ist voll." }, { status: 409 });
  }
  room.players.push(makePlayer(playerId, name));
  room.status = "platzieren";
  room.updatedAt = Date.now();
  saveRoom(room);
  return NextResponse.json({ ok: true, code: room.code });
}
