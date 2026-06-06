import { GRID, Orientation, PlacedShip, PlayerState, PublicCell, PublicView, RoomState, SHIP_SPECS, ShipKey } from "./types";

export function emptyBoard() {
  return { ships: [], shotsReceived: [] };
}

export function makePlayer(id: string, name: string): PlayerState {
  return { id, name, ready: false, board: emptyBoard(), shotsFired: [] };
}

export function shipCells(s: PlacedShip): { x: number; y: number }[] {
  const spec = SHIP_SPECS.find(sp => sp.key === s.key)!;
  const cells = [];
  for (let i = 0; i < spec.length; i++) {
    cells.push({
      x: s.x + (s.orientation === "H" ? i : 0),
      y: s.y + (s.orientation === "V" ? i : 0),
    });
  }
  return cells;
}

export function inBounds(x: number, y: number) {
  return x >= 0 && y >= 0 && x < GRID && y < GRID;
}

export function canPlace(existing: PlacedShip[], candidate: Omit<PlacedShip, "hits">): boolean {
  const spec = SHIP_SPECS.find(sp => sp.key === candidate.key);
  if (!spec) return false;
  const cells = shipCells({ ...candidate, hits: [] });
  for (const c of cells) if (!inBounds(c.x, c.y)) return false;
  const occupied = new Set<string>();
  for (const s of existing) for (const c of shipCells(s)) occupied.add(`${c.x},${c.y}`);
  for (const c of cells) if (occupied.has(`${c.x},${c.y}`)) return false;
  return true;
}

export function placeShip(player: PlayerState, key: ShipKey, x: number, y: number, orientation: Orientation): boolean {
  player.board.ships = player.board.ships.filter(s => s.key !== key);
  const spec = SHIP_SPECS.find(sp => sp.key === key)!;
  if (!canPlace(player.board.ships, { key, x, y, orientation })) return false;
  player.board.ships.push({ key, x, y, orientation, hits: Array(spec.length).fill(false) });
  return true;
}

export function randomFleet(): PlacedShip[] {
  const ships: PlacedShip[] = [];
  for (const spec of SHIP_SPECS) {
    let placed = false;
    for (let tries = 0; tries < 500 && !placed; tries++) {
      const orientation: Orientation = Math.random() < 0.5 ? "H" : "V";
      const x = Math.floor(Math.random() * GRID);
      const y = Math.floor(Math.random() * GRID);
      if (canPlace(ships, { key: spec.key, x, y, orientation })) {
        ships.push({ key: spec.key, x, y, orientation, hits: Array(spec.length).fill(false) });
        placed = true;
      }
    }
  }
  return ships;
}

export function allShipsPlaced(player: PlayerState): boolean {
  return SHIP_SPECS.every(spec => player.board.ships.some(s => s.key === spec.key));
}

export function shipSunk(s: PlacedShip): boolean {
  return s.hits.every(Boolean);
}

export function allShipsSunk(player: PlayerState): boolean {
  return player.board.ships.length === SHIP_SPECS.length && player.board.ships.every(shipSunk);
}

export function fireShot(room: RoomState, shooterIdx: 0 | 1, x: number, y: number): { ok: true; hit: boolean; sunk: ShipKey | null; won: boolean } | { ok: false; reason: string } {
  if (room.status !== "spielen") return { ok: false, reason: "Spiel läuft nicht." };
  if (room.turn !== shooterIdx) return { ok: false, reason: "Nicht dein Zug." };
  if (!inBounds(x, y)) return { ok: false, reason: "Außerhalb des Rasters." };
  const shooter = room.players[shooterIdx];
  const target = room.players[1 - shooterIdx];
  if (shooter.shotsFired.some(s => s.x === x && s.y === y)) return { ok: false, reason: "Schon beschossen." };

  let hit = false;
  let sunkKey: ShipKey | null = null;
  for (const ship of target.board.ships) {
    const cells = shipCells(ship);
    const idx = cells.findIndex(c => c.x === x && c.y === y);
    if (idx >= 0) {
      ship.hits[idx] = true;
      hit = true;
      if (shipSunk(ship)) sunkKey = ship.key;
      break;
    }
  }
  shooter.shotsFired.push({ x, y, hit, sunk: sunkKey });
  target.board.shotsReceived.push({ x, y, hit });

  const won = allShipsSunk(target);
  if (won) {
    room.status = "beendet";
    room.winner = shooterIdx;
  } else {
    room.turn = (1 - shooterIdx) as 0 | 1;
  }
  room.updatedAt = Date.now();
  return { ok: true, hit, sunk: sunkKey, won };
}

export function toPublicView(room: RoomState, playerId: string): PublicView {
  const idx = room.players.findIndex(p => p.id === playerId);
  const you = idx === 0 || idx === 1 ? (idx as 0 | 1) : null;
  const enemyIdx = you === null ? 0 : (1 - you);
  const enemy = room.players[enemyIdx];

  const enemyGrid: PublicCell[][] = Array.from({ length: GRID }, () =>
    Array.from({ length: GRID }, () => ({ state: "leer" as const }))
  );

  if (you !== null && enemy) {
    const me = room.players[you];
    const sunkenShipCells = new Set<string>();
    for (const ship of enemy.board.ships) {
      if (shipSunk(ship)) for (const c of shipCells(ship)) sunkenShipCells.add(`${c.x},${c.y}`);
    }
    for (const shot of me.shotsFired) {
      const key = `${shot.x},${shot.y}`;
      if (sunkenShipCells.has(key)) enemyGrid[shot.y][shot.x] = { state: "versenkt" };
      else if (shot.hit) enemyGrid[shot.y][shot.x] = { state: "treffer" };
      else enemyGrid[shot.y][shot.x] = { state: "verfehlt" };
    }
  }

  return {
    code: room.code,
    status: room.status,
    turn: room.turn,
    winner: room.winner,
    you,
    players: room.players.map(p => ({
      name: p.name,
      ready: p.ready,
      shipsSunk: p.board.ships.filter(shipSunk).length,
      shipsTotal: SHIP_SPECS.length,
    })),
    yourBoard: you !== null ? {
      ships: room.players[you].board.ships,
      incoming: room.players[you].board.shotsReceived,
    } : null,
    enemyGrid,
    yourShots: you !== null ? room.players[you].shotsFired : [],
  };
}
