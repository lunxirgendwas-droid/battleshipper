export type Orientation = "H" | "V";

export type ShipKey = "carrier" | "battleship" | "cruiser" | "submarine" | "destroyer";

export interface ShipSpec {
  key: ShipKey;
  name: string;
  length: number;
}

export const SHIP_SPECS: ShipSpec[] = [
  { key: "carrier",    name: "Flugzeugträger", length: 5 },
  { key: "battleship", name: "Schlachtschiff", length: 4 },
  { key: "cruiser",    name: "Kreuzer",        length: 3 },
  { key: "submarine",  name: "U-Boot",         length: 3 },
  { key: "destroyer",  name: "Zerstörer",      length: 2 },
];

export const GRID = 10;

export interface PlacedShip {
  key: ShipKey;
  x: number;
  y: number;
  orientation: Orientation;
  hits: boolean[];
}

export interface BoardState {
  ships: PlacedShip[];
  shotsReceived: { x: number; y: number; hit: boolean }[];
}

export interface PlayerState {
  id: string;
  name: string;
  ready: boolean;
  board: BoardState;
  shotsFired: { x: number; y: number; hit: boolean; sunk: ShipKey | null }[];
}

export type RoomStatus = "warten" | "platzieren" | "spielen" | "beendet";

export interface RoomState {
  code: string;
  status: RoomStatus;
  players: PlayerState[];
  turn: 0 | 1;
  winner: 0 | 1 | null;
  createdAt: number;
  updatedAt: number;
}

export interface PublicCell {
  state: "leer" | "treffer" | "verfehlt" | "versenkt";
}

export interface PublicView {
  code: string;
  status: RoomStatus;
  turn: 0 | 1;
  winner: 0 | 1 | null;
  you: 0 | 1 | null;
  players: { name: string; ready: boolean; shipsSunk: number; shipsTotal: number }[];
  yourBoard: {
    ships: PlacedShip[];
    incoming: { x: number; y: number; hit: boolean }[];
  } | null;
  enemyGrid: PublicCell[][];
  yourShots: { x: number; y: number; hit: boolean; sunk: ShipKey | null }[];
  message?: string;
}
