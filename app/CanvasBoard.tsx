"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GRID, PlacedShip, PublicCell } from "@/lib/types";
import { shipCells } from "@/lib/game";

export type Mode = "placement" | "own" | "enemy";

interface Props {
  mode: Mode;
  ships?: PlacedShip[];
  incoming?: { x: number; y: number; hit: boolean }[];
  enemyGrid?: PublicCell[][];
  preview?: { cells: { x: number; y: number }[]; valid: boolean } | null;
  onCellClick?: (x: number, y: number) => void;
  onHover?: (cell: { x: number; y: number } | null) => void;
  interactive?: boolean;
  active?: boolean;
  flashCell?: { x: number; y: number } | null;
}

function cssVar(name: string): string {
  if (typeof window === "undefined") return "0 0 0";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "0 0 0";
}

function rgb(triplet: string): string {
  return `rgb(${triplet.replace(/\s+/g, ",")})`;
}

function rgba(triplet: string, a: number): string {
  return `rgba(${triplet.replace(/\s+/g, ",")},${a})`;
}

export default function CanvasBoard({
  mode, ships = [], incoming = [], enemyGrid, preview, onCellClick, onHover, interactive = true, active = true, flashCell,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(0);
  const [themeTick, setThemeTick] = useState(0);
  const [flashStart, setFlashStart] = useState<number | null>(null);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width;
      setSize(Math.floor(w));
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const obs = new MutationObserver(() => setThemeTick(t => t + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!flashCell) return;
    setFlashStart(performance.now());
    let raf: number;
    const tick = () => {
      setThemeTick(t => t + 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const stop = setTimeout(() => { cancelAnimationFrame(raf); setFlashStart(null); }, 600);
    return () => { cancelAnimationFrame(raf); clearTimeout(stop); };
  }, [flashCell?.x, flashCell?.y]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || size === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const w = size;
    const h = size;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const labelPad = Math.max(18, Math.floor(w * 0.06));
    const board = w - labelPad;
    const cell = board / GRID;
    const ox = labelPad;
    const oy = labelPad;

    const COL_INK     = cssVar("--ink");
    const COL_MUTED   = cssVar("--muted");
    const COL_LINE    = cssVar("--line");
    const COL_OCEAN   = cssVar("--ocean");
    const COL_WAVE    = cssVar("--wave");
    const COL_ROSE    = cssVar("--rose");
    const COL_CORAL   = cssVar("--coral");
    const COL_SHELL   = cssVar("--shell");
    const COL_BLUSH   = cssVar("--blush");
    const COL_CREAM   = cssVar("--cream");
    const COL_SURFACE = cssVar("--surface");

    ctx.font = `500 ${Math.max(9, Math.floor(labelPad * 0.42))}px "Geist Mono", monospace`;
    ctx.fillStyle = rgb(COL_MUTED);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const letters = "ABCDEFGHIJ";
    for (let i = 0; i < GRID; i++) {
      ctx.fillText(letters[i], ox + cell * (i + 0.5), oy * 0.55);
      ctx.fillText(String(i + 1), ox * 0.55, oy + cell * (i + 0.5));
    }

    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const px = ox + x * cell;
        const py = oy + y * cell;
        const inset = Math.max(1.5, cell * 0.05);
        const r = Math.max(2, cell * 0.12);
        roundRect(ctx, px + inset, py + inset, cell - inset * 2, cell - inset * 2, r);
        ctx.fillStyle = rgba(COL_OCEAN, 0.45);
        ctx.fill();
        ctx.strokeStyle = rgba(COL_WAVE, 0.6);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    if (mode !== "enemy") {
      for (const ship of ships) {
        const cells = shipCells(ship);
        const x1 = cells[0].x, y1 = cells[0].y;
        const x2 = cells[cells.length - 1].x, y2 = cells[cells.length - 1].y;
        const inset = Math.max(2, cell * 0.07);
        const r = Math.max(3, cell * 0.18);
        const px = ox + Math.min(x1, x2) * cell + inset;
        const py = oy + Math.min(y1, y2) * cell + inset;
        const sw = (Math.abs(x2 - x1) + 1) * cell - inset * 2;
        const sh = (Math.abs(y2 - y1) + 1) * cell - inset * 2;
        const allHit = ship.hits.every(Boolean);
        roundRect(ctx, px, py, sw, sh, r);
        const grad = ctx.createLinearGradient(px, py, px + sw, py + sh);
        if (allHit) {
          grad.addColorStop(0, rgb(COL_ROSE));
          grad.addColorStop(1, rgb(COL_CORAL));
        } else {
          grad.addColorStop(0, rgb(COL_INK));
          grad.addColorStop(1, rgba(COL_INK, 0.85));
        }
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = rgba(COL_LINE, 0.3);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    if (mode === "own") {
      for (const sh of incoming) {
        drawMark(ctx, ox + sh.x * cell, oy + sh.y * cell, cell, sh.hit ? "hit" : "miss", COL_ROSE, COL_MUTED);
      }
    }

    if (mode === "enemy" && enemyGrid) {
      for (let y = 0; y < GRID; y++) {
        for (let x = 0; x < GRID; x++) {
          const c = enemyGrid[y][x];
          if (c.state === "leer") continue;
          const px = ox + x * cell;
          const py = oy + y * cell;
          const inset = Math.max(2, cell * 0.07);
          const r = Math.max(3, cell * 0.18);
          if (c.state === "versenkt") {
            roundRect(ctx, px + inset, py + inset, cell - inset * 2, cell - inset * 2, r);
            ctx.fillStyle = rgb(COL_INK);
            ctx.fill();
            drawX(ctx, px + cell / 2, py + cell / 2, cell * 0.28, rgb(COL_ROSE), cell * 0.10);
          } else if (c.state === "treffer") {
            roundRect(ctx, px + inset, py + inset, cell - inset * 2, cell - inset * 2, r);
            const grad = ctx.createLinearGradient(px, py, px + cell, py + cell);
            grad.addColorStop(0, rgb(COL_ROSE));
            grad.addColorStop(1, rgb(COL_CORAL));
            ctx.fillStyle = grad;
            ctx.fill();
            drawX(ctx, px + cell / 2, py + cell / 2, cell * 0.24, rgb(COL_SURFACE), cell * 0.10);
          } else if (c.state === "verfehlt") {
            roundRect(ctx, px + inset, py + inset, cell - inset * 2, cell - inset * 2, r);
            ctx.fillStyle = rgba(COL_CREAM, 0.8);
            ctx.fill();
            ctx.fillStyle = rgba(COL_MUTED, 0.7);
            ctx.beginPath();
            ctx.arc(px + cell / 2, py + cell / 2, cell * 0.07, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    if (preview && mode === "placement") {
      const stroke = preview.valid ? rgb(COL_ROSE) : rgba(COL_ROSE, 0.5);
      const fill = preview.valid ? rgba(COL_BLUSH, 0.5) : rgba(COL_ROSE, 0.18);
      for (const c of preview.cells) {
        if (c.x < 0 || c.y < 0 || c.x >= GRID || c.y >= GRID) continue;
        const px = ox + c.x * cell;
        const py = oy + c.y * cell;
        const inset = Math.max(1.5, cell * 0.05);
        const r = Math.max(2, cell * 0.14);
        roundRect(ctx, px + inset, py + inset, cell - inset * 2, cell - inset * 2, r);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    if (flashCell && flashStart) {
      const elapsed = performance.now() - flashStart;
      const t = Math.min(1, elapsed / 600);
      const px = ox + flashCell.x * cell + cell / 2;
      const py = oy + flashCell.y * cell + cell / 2;
      const radius = cell * (0.4 + t * 1.8);
      ctx.strokeStyle = rgba(COL_ROSE, 1 - t);
      ctx.lineWidth = Math.max(1, 3 * (1 - t));
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (!active) {
      ctx.fillStyle = rgba(COL_INK, 0.04);
      ctx.fillRect(0, 0, w, h);
    }
  }, [size, themeTick, mode, ships, incoming, enemyGrid, preview, active, flashCell, flashStart]);

  useEffect(() => { draw(); }, [draw]);

  function cellFromEvent(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const labelPad = Math.max(18, Math.floor(size * 0.06));
    const board = size - labelPad;
    const cell = board / GRID;
    const x = Math.floor((px - labelPad) / cell);
    const y = Math.floor((py - labelPad) / cell);
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) return null;
    return { x, y };
  }

  function handleMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!interactive || !onHover) return;
    const c = cellFromEvent(e);
    onHover(c);
  }

  function handleClick(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!interactive || !onCellClick) return;
    const c = cellFromEvent(e);
    if (c) onCellClick(c.x, c.y);
  }

  function handleLeave() { onHover?.(null); }

  return (
    <div ref={wrapRef} className="w-full" style={{ touchAction: "manipulation" }}>
      <canvas
        ref={canvasRef}
        onPointerMove={handleMove}
        onPointerDown={handleClick}
        onPointerLeave={handleLeave}
        className={interactive ? "cursor-crosshair select-none" : "select-none"}
        style={{ display: "block" }}
      />
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawX(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, lw: number) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - r, cy - r);
  ctx.lineTo(cx + r, cy + r);
  ctx.moveTo(cx + r, cy - r);
  ctx.lineTo(cx - r, cy + r);
  ctx.stroke();
}

function drawMark(ctx: CanvasRenderingContext2D, px: number, py: number, cell: number, kind: "hit" | "miss", roseTriplet: string, mutedTriplet: string) {
  if (kind === "hit") {
    ctx.fillStyle = rgba(roseTriplet, 0.6);
    ctx.beginPath();
    ctx.arc(px + cell / 2, py + cell / 2, cell * 0.32, 0, Math.PI * 2);
    ctx.fill();
    drawX(ctx, px + cell / 2, py + cell / 2, cell * 0.22, "#fff", cell * 0.10);
  } else {
    ctx.fillStyle = rgba(mutedTriplet, 0.55);
    ctx.beginPath();
    ctx.arc(px + cell / 2, py + cell / 2, cell * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }
}
