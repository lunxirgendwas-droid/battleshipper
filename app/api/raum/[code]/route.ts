import { NextRequest, NextResponse } from "next/server";
import { getRoom } from "@/lib/store";
import { toPublicView } from "@/lib/game";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const room = await getRoom(code);
  if (!room) return NextResponse.json({ error: "Raum nicht gefunden." }, { status: 404 });
  const playerId = req.headers.get("x-player-id") || req.nextUrl.searchParams.get("pid") || "";
  return NextResponse.json(toPublicView(room, playerId));
}
