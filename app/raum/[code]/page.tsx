"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getPlayerId, getStoredName } from "@/lib/playerId";
import { GRID, Orientation, PlacedShip, PublicView, SHIP_SPECS, ShipKey } from "@/lib/types";
import { canPlace, randomFleet, shipCells } from "@/lib/game";

type Phase = PublicView["status"];

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = (params?.code || "").toString().toUpperCase();
  const pid = useRef<string>("");
  const [view, setView] = useState<PublicView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [localShips, setLocalShips] = useState<PlacedShip[]>([]);
  const [selectedShip, setSelectedShip] = useState<ShipKey | null>(SHIP_SPECS[0].key);
  const [orientation, setOrientation] = useState<Orientation>("H");
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [lastShot, setLastShot] = useState<{ x: number; y: number; hit: boolean } | null>(null);
  const placementDirty = useRef(false);

  useEffect(() => { pid.current = getPlayerId(); }, []);

  const fetchView = useCallback(async () => {
    try {
      const res = await fetch(`/api/raum/${code}?pid=${pid.current}`, { cache: "no-store" });
      if (res.status === 404) { setError("Raum nicht gefunden."); return; }
      const data: PublicView = await res.json();
      setView(data);
      if (data.yourBoard && !placementDirty.current && data.status !== "warten") {
        setLocalShips(data.yourBoard.ships);
      }
    } catch {}
  }, [code]);

  useEffect(() => {
    if (!pid.current) return;
    fetchView();
    const id = setInterval(fetchView, 1500);
    return () => clearInterval(id);
  }, [fetchView]);

  useEffect(() => {
    if (!view) return;
    if (view.you === null && !joining) {
      const name = getStoredName();
      if (!name) { router.replace("/"); return; }
      setJoining(true);
      fetch(`/api/raum/${code}/beitreten`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, playerId: pid.current }),
      }).then(r => r.json()).then(d => { if (d.error) setError(d.error); })
        .finally(() => { setJoining(false); fetchView(); });
    }
  }, [view, joining, code, router, fetchView]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "r" || e.key === "R") setOrientation(o => o === "H" ? "V" : "H"); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="bg-white border border-line rounded-3xl p-8 max-w-md shadow-soft text-center">
          <div className="serif-it text-rose text-4xl mb-2">Oh nein.</div>
          <p className="text-muted">{error}</p>
          <button onClick={() => router.push("/")} className="mt-6 sans font-medium bg-rose text-white px-5 py-3 rounded-xl hover:bg-coral transition">
            Zur Startseite
          </button>
        </div>
      </main>
    );
  }

  if (!view) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted">
        <span className="w-2 h-2 rounded-full bg-rose pulse-dot mr-3" /> Verbinde mit {code}…
      </main>
    );
  }

  const me = view.you !== null ? view.players[view.you] : null;
  const enemy = view.you !== null ? view.players[1 - view.you] : null;

  return (
    <main className="min-h-screen flex flex-col">
      <TopBar code={code} view={view} />
      <section className="flex-1 px-4 md:px-8 py-6 max-w-6xl mx-auto w-full">
        {view.status === "warten" && <WaitingPanel code={code} />}
        {view.status === "platzieren" && (
          <PlacementPanel
            view={view}
            localShips={localShips}
            setLocalShips={(s) => { placementDirty.current = true; setLocalShips(s); }}
            selectedShip={selectedShip}
            setSelectedShip={setSelectedShip}
            orientation={orientation}
            setOrientation={setOrientation}
            hover={hover}
            setHover={setHover}
            code={code}
            pid={pid}
            resetDirty={() => { placementDirty.current = false; }}
            onAfter={fetchView}
          />
        )}
        {view.status === "spielen" && me && enemy && (
          <BattlePanel view={view} code={code} pid={pid} lastShot={lastShot} setLastShot={setLastShot} onAfter={fetchView} />
        )}
        {view.status === "beendet" && <EndPanel view={view} />}
      </section>
    </main>
  );
}

function TopBar({ code, view }: { code: string; view: PublicView }) {
  const me = view.you !== null ? view.players[view.you] : null;
  const enemy = view.you !== null ? view.players[1 - view.you] : view.players[1] || null;
  const [copied, setCopied] = useState(false);
  function copy() { navigator.clipboard?.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1200); }
  return (
    <header className="border-b border-line/80 px-4 md:px-8 py-4 flex flex-wrap items-center gap-4 justify-between bg-paper/70 backdrop-blur">
      <button onClick={copy} className="group flex items-center gap-3 text-left">
        <div className="w-9 h-9 rounded-xl bg-shell flex items-center justify-center text-rose">⚓</div>
        <div>
          <div className="text-[10px] sans uppercase tracking-wider text-muted">Raumcode {copied && <span className="text-rose ml-1">kopiert ✓</span>}</div>
          <div className="mono text-ink text-xl tracking-[0.35em] group-hover:text-rose transition">{code}</div>
        </div>
      </button>
      <div className="order-3 md:order-2 w-full md:w-auto">
        <StatusBadge status={view.status} turnMe={view.you !== null && view.turn === view.you} />
      </div>
      <div className="flex items-center gap-2 md:gap-3 order-2 md:order-3">
        <PlayerChip label={me?.name || "—"} side="me" active={view.you !== null && view.turn === view.you && view.status === "spielen"} />
        <span className="serif-it text-muted">vs</span>
        <PlayerChip label={enemy?.name || "wartet"} side="foe" active={view.you !== null && view.turn !== view.you && view.status === "spielen"} />
      </div>
    </header>
  );
}

function StatusBadge({ status, turnMe }: { status: Phase; turnMe: boolean }) {
  const map: Record<Phase, { label: string; color: string }> = {
    warten:     { label: "Warte auf Gegner",  color: "bg-cream text-ink" },
    platzieren: { label: "Schiffe platzieren", color: "bg-shell text-rose" },
    spielen:    { label: turnMe ? "Du bist dran" : "Gegner ist dran", color: turnMe ? "bg-rose text-white" : "bg-cream text-muted" },
    beendet:    { label: "Spiel beendet", color: "bg-ink text-paper" },
  };
  const s = map[status];
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${s.color} sans font-medium text-sm`}>
      <span className={`w-1.5 h-1.5 rounded-full ${turnMe && status === "spielen" ? "bg-white pulse-dot" : "bg-current opacity-60"}`} />
      {s.label}
    </div>
  );
}

function PlayerChip({ label, side, active }: { label: string; side: "me" | "foe"; active: boolean }) {
  return (
    <span className={`px-3 py-1.5 rounded-full text-sm sans font-medium border ${active ? "border-rose bg-shell text-rose" : "border-line bg-white text-ink"}`}>
      <span className={`mr-1.5 ${side === "me" ? "text-rose" : "text-muted"}`}>●</span>
      {label}
    </span>
  );
}

function WaitingPanel({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  function copy() { navigator.clipboard?.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  return (
    <div className="grid md:grid-cols-2 gap-10 py-10 md:py-16 items-center">
      <div className="fade-up">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-shell text-rose text-xs sans font-medium mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-rose pulse-dot" /> Warte auf Mitspieler
        </div>
        <h2 className="font-medium tracking-tight text-ink text-5xl md:text-6xl leading-[0.95]">
          Teile den
          <br/>
          <span className="serif-it text-rose font-normal">Raumcode.</span>
        </h2>
        <p className="mt-6 text-muted text-lg max-w-md">
          Sobald dein Gegner beitritt, könnt ihr eure Schiffe platzieren.
        </p>
      </div>
      <div className="bg-white border border-line rounded-3xl shadow-soft p-8 fade-up">
        <div className="text-xs sans uppercase tracking-wider text-muted mb-3">Raumcode</div>
        <div className="mono text-ink text-5xl md:text-7xl tracking-[0.25em] leading-none">{code}</div>
        <button onClick={copy} className="mt-7 w-full sans font-medium bg-rose text-white py-3.5 rounded-xl hover:bg-coral transition">
          {copied ? "Kopiert ✓" : "Code kopieren"}
        </button>
        <div className="mt-6 flex items-center gap-2 text-sm text-muted">
          <span className="w-2 h-2 rounded-full bg-rose pulse-dot" /> Verbindung aktiv
        </div>
      </div>
    </div>
  );
}

function PlacementPanel(props: {
  view: PublicView;
  localShips: PlacedShip[];
  setLocalShips: (s: PlacedShip[]) => void;
  selectedShip: ShipKey | null;
  setSelectedShip: (k: ShipKey | null) => void;
  orientation: Orientation;
  setOrientation: (o: Orientation) => void;
  hover: { x: number; y: number } | null;
  setHover: (c: { x: number; y: number } | null) => void;
  code: string;
  pid: React.RefObject<string>;
  resetDirty: () => void;
  onAfter: () => void;
}) {
  const { view, localShips, setLocalShips, selectedShip, setSelectedShip, orientation, setOrientation, hover, setHover, code, pid } = props;
  const [busy, setBusy] = useState(false);
  const me = view.you !== null ? view.players[view.you] : null;
  const allPlaced = SHIP_SPECS.every(spec => localShips.some(s => s.key === spec.key));

  function handleClick(x: number, y: number) {
    if (!selectedShip) return;
    const spec = SHIP_SPECS.find(s => s.key === selectedShip)!;
    const others = localShips.filter(s => s.key !== selectedShip);
    const cand = { key: selectedShip, x, y, orientation };
    if (!canPlace(others, cand)) return;
    const next: PlacedShip = { ...cand, hits: Array(spec.length).fill(false) };
    const updated = [...others, next];
    setLocalShips(updated);
    const nextSpec = SHIP_SPECS.find(s => !updated.some(u => u.key === s.key));
    setSelectedShip(nextSpec ? nextSpec.key : null);
  }

  function removeShip(key: ShipKey) {
    setLocalShips(localShips.filter(s => s.key !== key));
    setSelectedShip(key);
  }

  async function send(action: string, ships?: PlacedShip[]) {
    setBusy(true);
    try {
      const body: any = { playerId: pid.current, action };
      if (ships) body.ships = ships.map(s => ({ key: s.key, x: s.x, y: s.y, orientation: s.orientation }));
      const res = await fetch(`/api/raum/${code}/schiffe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fehler.");
      props.resetDirty();
      props.onAfter();
    } catch (e) { console.error(e); } finally { setBusy(false); }
  }

  async function randomize() {
    const fleet = randomFleet();
    setLocalShips(fleet);
    setSelectedShip(null);
    await send("set", fleet);
  }

  async function ready() {
    if (!allPlaced) return;
    await send("set", localShips);
    await send("ready");
  }

  async function unready() { await send("unready"); }

  const previewCells = useMemo(() => {
    if (!hover || !selectedShip) return null;
    const spec = SHIP_SPECS.find(s => s.key === selectedShip)!;
    const cells: { x: number; y: number }[] = [];
    for (let i = 0; i < spec.length; i++) {
      cells.push({
        x: hover.x + (orientation === "H" ? i : 0),
        y: hover.y + (orientation === "V" ? i : 0),
      });
    }
    const others = localShips.filter(s => s.key !== selectedShip);
    const valid = canPlace(others, { key: selectedShip, x: hover.x, y: hover.y, orientation });
    return { cells, valid };
  }, [hover, selectedShip, orientation, localShips]);

  return (
    <div className="grid lg:grid-cols-[1fr,360px] gap-8">
      <div className="fade-up">
        <h2 className="text-3xl md:text-4xl tracking-tight text-ink font-medium leading-tight mb-1">
          Setze deine <span className="serif-it text-rose font-normal">Flotte</span>
        </h2>
        <p className="text-muted text-sm mb-6">Klicken um zu setzen · auf Schiff klicken um zu entfernen · <kbd className="px-1.5 py-0.5 text-xs border border-line rounded bg-white">R</kbd> rotiert</p>
        <div className="bg-white border border-line rounded-2xl shadow-soft p-4 md:p-6 inline-block">
          <Grid
            cells={(x, y) => {
              const ship = localShips.find(s => shipCells(s).some(c => c.x === x && c.y === y));
              const preview = previewCells?.cells.some(c => c.x === x && c.y === y);
              const valid = previewCells?.valid;
              return (
                <div
                  className={[
                    "relative w-full aspect-square rounded-[5px] transition-colors border",
                    ship ? "bg-ink border-ink" : "bg-ocean/40 border-wave/60 hover:bg-ocean",
                    preview ? (valid ? "ring-2 ring-rose ring-offset-1 bg-blush/60" : "ring-2 ring-rose/50 bg-rose/20") : "",
                  ].join(" ")}
                  onClick={() => ship ? removeShip(ship.key) : handleClick(x, y)}
                  onMouseEnter={() => setHover({ x, y })}
                  onMouseLeave={() => setHover(null)}
                />
              );
            }}
          />
        </div>
      </div>

      <aside className="space-y-4">
        <div className="bg-white border border-line rounded-2xl p-5 shadow-soft">
          <div className="text-xs sans font-medium text-muted uppercase tracking-wider mb-3">Flotte</div>
          <ul className="space-y-2">
            {SHIP_SPECS.map(spec => {
              const placed = localShips.some(s => s.key === spec.key);
              const active = selectedShip === spec.key;
              return (
                <li key={spec.key}>
                  <button
                    onClick={() => setSelectedShip(spec.key)}
                    className={[
                      "w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition text-left",
                      active ? "border-rose bg-shell" : "border-line hover:border-rose/40 bg-white",
                    ].join(" ")}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className={`w-2 h-2 rounded-full ${placed ? "bg-rose" : "bg-line"}`} />
                      <span className="sans font-medium text-ink text-sm">{spec.name}</span>
                    </span>
                    <span className="flex gap-0.5">
                      {Array.from({ length: spec.length }).map((_, i) => (
                        <span key={i} className={`w-3 h-3 rounded-sm ${placed ? "bg-ink" : "bg-line"}`} />
                      ))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="bg-white border border-line rounded-2xl p-5 shadow-soft space-y-3">
          <div className="text-xs sans font-medium text-muted uppercase tracking-wider">Ausrichtung</div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setOrientation("H")} className={`py-2.5 rounded-xl sans font-medium text-sm border transition ${orientation === "H" ? "bg-ink text-paper border-ink" : "border-line text-ink hover:border-rose"}`}>↔ Horizontal</button>
            <button onClick={() => setOrientation("V")} className={`py-2.5 rounded-xl sans font-medium text-sm border transition ${orientation === "V" ? "bg-ink text-paper border-ink" : "border-line text-ink hover:border-rose"}`}>↕ Vertikal</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={randomize} disabled={busy} className="py-2.5 rounded-xl sans text-sm border border-line text-ink hover:border-rose disabled:opacity-40 transition">⤬ Zufällig</button>
            <button onClick={() => setLocalShips([])} disabled={busy || !localShips.length} className="py-2.5 rounded-xl sans text-sm border border-line text-ink hover:border-rose disabled:opacity-40 transition">Löschen</button>
          </div>
        </div>

        <div className="bg-white border border-line rounded-2xl p-5 shadow-soft">
          <div className="text-xs sans font-medium text-muted uppercase tracking-wider mb-3">Bereit?</div>
          <div className="text-sm text-muted mb-4 space-y-1">
            <div className="flex items-center gap-2"><span className={`w-1.5 h-1.5 rounded-full ${me?.ready ? "bg-rose" : "bg-line"}`} /> Du: <span className={me?.ready ? "text-rose font-medium" : ""}>{me?.ready ? "bereit" : "nicht bereit"}</span></div>
            <div className="flex items-center gap-2"><span className={`w-1.5 h-1.5 rounded-full ${view.players[1 - (view.you ?? 0)]?.ready ? "bg-rose" : "bg-line"}`} /> Gegner: <span className={view.players[1 - (view.you ?? 0)]?.ready ? "text-rose font-medium" : ""}>{view.players[1 - (view.you ?? 0)]?.ready ? "bereit" : "wartet"}</span></div>
          </div>
          {!me?.ready ? (
            <button onClick={ready} disabled={!allPlaced || busy} className="w-full sans font-medium text-base py-3.5 bg-rose text-white rounded-xl disabled:opacity-30 hover:bg-coral transition">
              {allPlaced ? "Bereit →" : "Erst alle Schiffe setzen"}
            </button>
          ) : (
            <button onClick={unready} disabled={busy} className="w-full sans text-sm py-3 rounded-xl border border-line text-muted hover:text-ink hover:border-ink transition">
              Bereit zurücknehmen
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

function BattlePanel(props: {
  view: PublicView;
  code: string;
  pid: React.RefObject<string>;
  lastShot: { x: number; y: number; hit: boolean } | null;
  setLastShot: (s: { x: number; y: number; hit: boolean } | null) => void;
  onAfter: () => void;
}) {
  const { view, code, pid, lastShot, setLastShot, onAfter } = props;
  const myTurn = view.you !== null && view.turn === view.you;
  const me = view.you !== null ? view.players[view.you] : null;
  const enemy = view.you !== null ? view.players[1 - view.you] : null;
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; tone: "hit" | "miss" | "sunk" } | null>(null);

  async function fire(x: number, y: number) {
    if (!myTurn || busy) return;
    if (view.enemyGrid[y][x].state !== "leer") return;
    setBusy(true);
    try {
      const res = await fetch(`/api/raum/${code}/schuss`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: pid.current, x, y }),
      });
      const data = await res.json();
      if (!res.ok) return;
      setLastShot({ x, y, hit: data.hit });
      if (data.sunk) setFeedback({ text: `Versenkt: ${SHIP_SPECS.find(s => s.key === data.sunk)?.name}`, tone: "sunk" });
      else if (data.hit) setFeedback({ text: "Treffer!", tone: "hit" });
      else setFeedback({ text: "Daneben.", tone: "miss" });
      setTimeout(() => setFeedback(null), 1800);
      onAfter();
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6">
        <BoardCard title="Gegnerische Gewässer" sub="Klicke ein Feld zum Feuern" active={myTurn}>
          <Grid
            cells={(x, y) => {
              const cell = view.enemyGrid[y][x];
              const isLast = lastShot && lastShot.x === x && lastShot.y === y;
              const clickable = myTurn && cell.state === "leer" && !busy;
              return (
                <button
                  disabled={!clickable}
                  onClick={() => fire(x, y)}
                  className={[
                    "relative w-full aspect-square rounded-[5px] transition border",
                    cell.state === "leer" ? (clickable ? "bg-ocean/40 border-wave/60 hover:bg-shell hover:border-rose cursor-crosshair" : "bg-ocean/40 border-wave/60") : "",
                    cell.state === "treffer" ? "bg-rose border-rose text-white" : "",
                    cell.state === "versenkt" ? "bg-ink border-ink text-rose" : "",
                    cell.state === "verfehlt" ? "bg-cream border-line" : "",
                    isLast && cell.state === "treffer" ? "pop-in" : "",
                  ].join(" ")}
                >
                  {cell.state === "treffer" && <span className="absolute inset-0 flex items-center justify-center text-base font-bold">✕</span>}
                  {cell.state === "versenkt" && <span className="absolute inset-0 flex items-center justify-center text-base font-bold">✕</span>}
                  {cell.state === "verfehlt" && <span className="absolute inset-0 flex items-center justify-center text-muted">·</span>}
                </button>
              );
            }}
          />
        </BoardCard>

        <BoardCard title="Deine Flotte" sub="Eingehende Schüsse" active={!myTurn}>
          <Grid
            cells={(x, y) => {
              const ship = view.yourBoard?.ships.find(s => shipCells(s).some(c => c.x === x && c.y === y));
              const incoming = view.yourBoard?.incoming.find(i => i.x === x && i.y === y);
              return (
                <div className={[
                  "relative w-full aspect-square rounded-[5px] border",
                  ship && !incoming?.hit ? "bg-ink border-ink" : "",
                  !ship && !incoming ? "bg-ocean/40 border-wave/60" : "",
                  incoming?.hit ? "bg-rose border-rose text-white" : "",
                  incoming && !incoming.hit ? "bg-cream border-line" : "",
                ].join(" ")}>
                  {incoming?.hit && <span className="absolute inset-0 flex items-center justify-center text-base font-bold">✕</span>}
                  {incoming && !incoming.hit && <span className="absolute inset-0 flex items-center justify-center text-muted">·</span>}
                </div>
              );
            }}
          />
        </BoardCard>
      </div>

      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <Stat label="Feindliche Schiffe versenkt" value={`${enemy?.shipsSunk ?? 0} / ${enemy?.shipsTotal ?? 5}`} accent />
        <Stat label="Eigene Verluste" value={`${me?.shipsSunk ?? 0} / ${me?.shipsTotal ?? 5}`} />
        <Stat label="Schüsse abgegeben" value={`${view.yourShots.length}`} />
      </div>

      {feedback && (
        <div className={[
          "fixed bottom-8 left-1/2 -translate-x-1/2 z-40 px-6 py-3 rounded-full shadow-soft sans font-medium text-base pop-in",
          feedback.tone === "sunk" ? "bg-ink text-paper" : feedback.tone === "hit" ? "bg-rose text-white" : "bg-white border border-line text-ink",
        ].join(" ")}>
          {feedback.text}
        </div>
      )}
    </div>
  );
}

function BoardCard({ title, sub, active, children }: { title: string; sub: string; active: boolean; children: React.ReactNode }) {
  return (
    <div className={`bg-white border ${active ? "border-rose" : "border-line"} rounded-3xl shadow-soft p-5 md:p-6 transition`}>
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="sans font-medium text-ink">{title}</div>
          <div className="text-xs text-muted">{sub}</div>
        </div>
        <div className={`text-[10px] sans uppercase tracking-wider ${active ? "text-rose" : "text-muted"}`}>{active ? "● aktiv" : "pause"}</div>
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 md:p-5 ${accent ? "bg-shell border-rose/20" : "bg-white border-line"} shadow-soft`}>
      <div className="text-[10px] sans uppercase tracking-wider text-muted mb-2">{label}</div>
      <div className={`serif text-3xl md:text-4xl leading-none ${accent ? "text-rose" : "text-ink"}`}>{value}</div>
    </div>
  );
}

function EndPanel({ view }: { view: PublicView }) {
  const youWon = view.you !== null && view.winner === view.you;
  return (
    <div className="py-12 md:py-20 grid md:grid-cols-2 gap-10 items-center fade-up">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-shell text-rose text-xs sans font-medium mb-6">
          Spielbericht
        </div>
        <h2 className="font-medium tracking-tight text-ink text-6xl md:text-7xl leading-[0.95]">
          {youWon ? <>Du hast<br/><span className="serif-it text-rose font-normal">gewonnen.</span></> : <>Knappe<br/><span className="serif-it text-rose font-normal">Niederlage.</span></>}
        </h2>
        <p className="mt-6 text-muted text-lg max-w-md">
          {youWon ? "Feindliche Flotte versenkt — Glückwunsch, Kapitän." : "Deine Flotte ist gesunken. Eine Revanche?"}
        </p>
        <div className="mt-8 flex gap-3">
          <a href="/" className="sans font-medium bg-rose text-white px-5 py-3.5 rounded-xl hover:bg-coral transition">Neues Spiel →</a>
        </div>
      </div>
      <div className="bg-white border border-line rounded-3xl shadow-soft p-6 md:p-8">
        <div className="text-xs sans uppercase tracking-wider text-muted mb-4">Endstand</div>
        <ul className="space-y-3">
          {view.players.map((p, i) => (
            <li key={i} className="flex items-center justify-between border-b border-line/70 pb-3 last:border-0 last:pb-0">
              <span className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${view.winner === i ? "bg-rose" : "bg-line"}`} />
                <span className={`sans font-medium ${view.you === i ? "text-rose" : "text-ink"}`}>{p.name}</span>
              </span>
              <span className="text-muted text-sm">{p.shipsSunk} / {p.shipsTotal} versenkt</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Grid({ cells }: { cells: (x: number, y: number) => React.ReactNode }) {
  const letters = "ABCDEFGHIJ".split("");
  return (
    <div className="w-full max-w-[480px]">
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `1.2rem repeat(${GRID}, minmax(0, 1fr))` }}>
        <div />
        {letters.map(l => (
          <div key={l} className="text-center text-[10px] mono text-muted pb-1">{l}</div>
        ))}
        {Array.from({ length: GRID }).map((_, y) => (
          <ROW key={y} y={y} cells={cells} />
        ))}
      </div>
    </div>
  );
}

function ROW({ y, cells }: { y: number; cells: (x: number, y: number) => React.ReactNode }) {
  return (
    <>
      <div className="text-center text-[10px] mono text-muted pr-1 flex items-center justify-center">{y + 1}</div>
      {Array.from({ length: GRID }).map((_, x) => (
        <div key={x} className="min-w-0">{cells(x, y)}</div>
      ))}
    </>
  );
}
