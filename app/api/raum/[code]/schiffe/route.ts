import { NextRequest, NextResponse } from "next/server";
import { getRoom, saveRoom } from "@/lib/store";
import { allShipsPlaced, canPlace, randomFleet } from "@/lib/game";
import { Orientation, PlacedShip, SHIP_SPECS, ShipKey } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const room = await getRoom(code);
  if (!room) return NextResponse.json({ error: "Raum nicht gefunden." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const playerId: string = (body.playerId || "").toString();
  const player = room.players.find(p => p.id === playerId);
  if (!player) return NextResponse.json({ error: "Kein Mitspieler." }, { status: 403 });
  if (room.status !== "platzieren" && room.status !== "warten") {
    return NextResponse.json({ error: "Platzierung nicht möglich." }, { status: 400 });
  }

  const action: string = body.action || "set";

  if (action === "random") {
    player.board.ships = randomFleet();
    player.ready = false;
  } else if (action === "clear") {
    player.board.ships = [];
    player.ready = false;
  } else if (action === "set") {
    const ships: { key: ShipKey; x: number; y: number; orientation: Orientation }[] = Array.isArray(body.ships) ? body.ships : [];
    const built: PlacedShip[] = [];
    for (const s of ships) {
      const spec = SHIP_SPECS.find(sp => sp.key === s.key);
      if (!spec) return NextResponse.json({ error: `Unbekanntes Schiff: ${s.key}` }, { status: 400 });
      if (built.some(b => b.key === s.key)) return NextResponse.json({ error: "Doppeltes Schiff." }, { status: 400 });
      if (!canPlace(built, s)) return NextResponse.json({ error: `${spec.name} passt nicht.` }, { status: 400 });
      built.push({ ...s, hits: Array(spec.length).fill(false) });
    }
    player.board.ships = built;
    player.ready = false;
  } else if (action === "ready") {
    if (!allShipsPlaced(player)) return NextResponse.json({ error: "Nicht alle Schiffe platziert." }, { status: 400 });
    player.ready = true;
    if (room.players.length === 2 && room.players.every(p => p.ready)) {
      room.status = "spielen";
      room.turn = 0;
    }
  } else if (action === "unready") {
    player.ready = false;
  } else {
    return NextResponse.json({ error: "Unbekannte Aktion." }, { status: 400 });
  }

  room.updatedAt = Date.now();
  await saveRoom(room);
  return NextResponse.json({ ok: true });
}
