import { NextRequest, NextResponse } from "next/server";
import { getRoom, saveRoom } from "@/lib/store";
import { fireShot } from "@/lib/game";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const room = await getRoom(code);
  if (!room) return NextResponse.json({ error: "Raum nicht gefunden." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const playerId: string = (body.playerId || "").toString();
  const x = Number(body.x);
  const y = Number(body.y);
  const idx = room.players.findIndex(p => p.id === playerId);
  if (idx !== 0 && idx !== 1) return NextResponse.json({ error: "Kein Mitspieler." }, { status: 403 });

  const result = fireShot(room, idx as 0 | 1, x, y);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });
  await saveRoom(room);
  return NextResponse.json(result);
}
