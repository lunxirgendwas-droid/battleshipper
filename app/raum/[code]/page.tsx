"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getPlayerId, getStoredName } from "@/lib/playerId";
import { GRID, Orientation, PlacedShip, PublicView, SHIP_SPECS, ShipKey } from "@/lib/types";
import { canPlace, randomFleet, shipCells } from "@/lib/game";
import ThemeToggle from "../../ThemeToggle";
import CanvasBoard from "../../CanvasBoard";

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
        <div className="bg-surface border border-line rounded-3xl p-8 max-w-md shadow-soft text-center">
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
      <section className="flex-1 px-3 md:px-6 lg:px-8 py-4 md:py-6 max-w-6xl mx-auto w-full pb-28 md:pb-6">
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
    <header className="border-b border-line/80 px-3 md:px-8 py-3 md:py-4 bg-paper/70 backdrop-blur sticky top-0 z-30">
      <div className="flex items-center justify-between gap-3 max-w-6xl mx-auto">
        <button onClick={copy} className="group flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 shrink-0 rounded-xl bg-shell flex items-center justify-center text-rose text-lg">⚓</div>
          <div className="text-left min-w-0">
            <div className="text-[10px] sans uppercase tracking-wider text-muted leading-tight">
              Code {copied && <span className="text-rose ml-1">kopiert ✓</span>}
            </div>
            <div className="mono text-ink text-base md:text-xl tracking-[0.25em] md:tracking-[0.35em] group-hover:text-rose transition leading-tight">{code}</div>
          </div>
        </button>
        <div className="hidden md:block">
          <StatusBadge status={view.status} turnMe={view.you !== null && view.turn === view.you} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 max-w-6xl mx-auto md:hidden">
        <StatusBadge status={view.status} turnMe={view.you !== null && view.turn === view.you} />
        <div className="flex items-center gap-1.5 text-xs">
          <PlayerChip label={me?.name || "—"} side="me" active={view.you !== null && view.turn === view.you && view.status === "spielen"} compact />
          <span className="serif-it text-muted text-xs">vs</span>
          <PlayerChip label={enemy?.name || "—"} side="foe" active={view.you !== null && view.turn !== view.you && view.status === "spielen"} compact />
        </div>
      </div>
      <div className="mt-2 hidden md:flex items-center justify-end gap-2 max-w-6xl mx-auto">
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
    <div className={`inline-flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-full ${s.color} sans font-medium text-xs md:text-sm whitespace-nowrap`}>
      <span className={`w-1.5 h-1.5 rounded-full ${turnMe && status === "spielen" ? "bg-white pulse-dot" : "bg-current opacity-60"}`} />
      {s.label}
    </div>
  );
}

function PlayerChip({ label, side, active, compact }: { label: string; side: "me" | "foe"; active: boolean; compact?: boolean }) {
  return (
    <span className={`px-2.5 md:px-3 ${compact ? "py-1" : "py-1.5"} rounded-full ${compact ? "text-xs" : "text-sm"} sans font-medium border whitespace-nowrap ${active ? "border-rose bg-shell text-rose" : "border-line bg-surface text-ink"}`}>
      <span className={`mr-1 ${side === "me" ? "text-rose" : "text-muted"}`}>●</span>
      {label}
    </span>
  );
}

function WaitingPanel({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  function copy() { navigator.clipboard?.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  return (
    <div className="grid md:grid-cols-2 gap-8 md:gap-10 py-8 md:py-16 items-center">
      <div className="fade-up">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-shell text-rose text-xs sans font-medium mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-rose pulse-dot" /> Warte auf Mitspieler
        </div>
        <h2 className="font-medium tracking-tight text-ink text-4xl md:text-6xl leading-[0.95]">
          Teile den
          <br/>
          <span className="serif-it text-rose font-normal">Raumcode.</span>
        </h2>
        <p className="mt-5 text-muted text-base md:text-lg max-w-md">
          Sobald dein Gegner beitritt, könnt ihr eure Schiffe platzieren.
        </p>
      </div>
      <div className="bg-surface border border-line rounded-3xl shadow-soft p-6 md:p-8 fade-up">
        <div className="text-xs sans uppercase tracking-wider text-muted mb-3">Raumcode</div>
        <div className="mono text-ink text-4xl md:text-7xl tracking-[0.2em] md:tracking-[0.25em] leading-none">{code}</div>
        <button onClick={copy} className="mt-6 w-full sans font-medium bg-rose text-white py-3.5 rounded-xl hover:bg-coral transition">
          {copied ? "Kopiert ✓" : "Code kopieren"}
        </button>
        <div className="mt-5 flex items-center gap-2 text-sm text-muted">
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
  const opponent = view.players[1 - (view.you ?? 0)];

  function placeAt(x: number, y: number) {
    if (!selectedShip) {
      const ship = localShips.find(s => shipCells(s).some(c => c.x === x && c.y === y));
      if (ship) { setLocalShips(localShips.filter(s => s.key !== ship.key)); setSelectedShip(ship.key); }
      return;
    }
    const existingHere = localShips.find(s => shipCells(s).some(c => c.x === x && c.y === y));
    if (existingHere && existingHere.key !== selectedShip) {
      setLocalShips(localShips.filter(s => s.key !== existingHere.key));
      setSelectedShip(existingHere.key);
      return;
    }
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

  const preview = useMemo(() => {
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
    <div className="grid lg:grid-cols-[1fr,340px] gap-5 md:gap-8 items-start">
      <div className="fade-up min-w-0">
        <h2 className="text-2xl md:text-4xl tracking-tight text-ink font-medium leading-tight mb-1">
          Setze deine <span className="serif-it text-rose font-normal">Flotte</span>
        </h2>
        <p className="text-muted text-xs md:text-sm mb-4 md:mb-6">
          Tippen zum Platzieren · auf Schiff tippen zum Entfernen · <kbd className="px-1.5 py-0.5 text-xs border border-line rounded bg-surface">R</kbd> rotiert
        </p>
        <div className="bg-surface border border-line rounded-2xl md:rounded-3xl shadow-soft p-3 md:p-5">
          <CanvasBoard
            mode="placement"
            ships={localShips}
            preview={preview}
            onCellClick={placeAt}
            onHover={setHover}
          />
        </div>
      </div>

      <aside className="space-y-3 md:space-y-4 lg:sticky lg:top-28">
        <div className="bg-surface border border-line rounded-2xl p-4 md:p-5 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs sans font-medium text-muted uppercase tracking-wider">Flotte</div>
            <button onClick={() => setOrientation(orientation === "H" ? "V" : "H")} className="text-xs sans font-medium text-rose hover:text-coral">
              {orientation === "H" ? "↔ Horizontal" : "↕ Vertikal"} · R
            </button>
          </div>
          <ul className="space-y-1.5">
            {SHIP_SPECS.map(spec => {
              const placed = localShips.some(s => s.key === spec.key);
              const active = selectedShip === spec.key;
              return (
                <li key={spec.key}>
                  <button
                    onClick={() => setSelectedShip(spec.key)}
                    className={[
                      "w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition text-left",
                      active ? "border-rose bg-shell" : "border-line hover:border-rose/40 bg-surface",
                    ].join(" ")}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${placed ? "bg-rose" : "bg-line"}`} />
                      <span className="sans font-medium text-ink text-sm truncate">{spec.name}</span>
                    </span>
                    <span className="flex gap-0.5 shrink-0">
                      {Array.from({ length: spec.length }).map((_, i) => (
                        <span key={i} className={`w-2.5 h-2.5 md:w-3 md:h-3 rounded-sm ${placed ? "bg-ink" : "bg-line"}`} />
                      ))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button onClick={randomize} disabled={busy} className="py-2.5 rounded-xl sans text-sm border border-line text-ink hover:border-rose disabled:opacity-40 transition">⤬ Zufällig</button>
            <button onClick={() => setLocalShips([])} disabled={busy || !localShips.length} className="py-2.5 rounded-xl sans text-sm border border-line text-ink hover:border-rose disabled:opacity-40 transition">Löschen</button>
          </div>
        </div>

        <div className="bg-surface border border-line rounded-2xl p-4 md:p-5 shadow-soft">
          <div className="text-xs sans font-medium text-muted uppercase tracking-wider mb-3">Bereit?</div>
          <div className="text-sm text-muted mb-4 space-y-1">
            <div className="flex items-center gap-2"><span className={`w-1.5 h-1.5 rounded-full ${me?.ready ? "bg-rose" : "bg-line"}`} /> Du: <span className={me?.ready ? "text-rose font-medium" : ""}>{me?.ready ? "bereit" : "nicht bereit"}</span></div>
            <div className="flex items-center gap-2"><span className={`w-1.5 h-1.5 rounded-full ${opponent?.ready ? "bg-rose" : "bg-line"}`} /> Gegner: <span className={opponent?.ready ? "text-rose font-medium" : ""}>{opponent?.ready ? "bereit" : "wartet"}</span></div>
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
    <div className="space-y-4 md:space-y-6">
      <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
        <BoardCard title="Gegnerische Gewässer" sub={myTurn ? "Tippe ein Feld" : "Warte auf Zug"} active={myTurn} order="md:order-1">
          <CanvasBoard
            mode="enemy"
            enemyGrid={view.enemyGrid}
            onCellClick={fire}
            interactive={myTurn && !busy}
            active={myTurn}
            flashCell={lastShot}
          />
        </BoardCard>

        <BoardCard title="Deine Flotte" sub="Eingehende Schüsse" active={!myTurn} order="md:order-2">
          <CanvasBoard
            mode="own"
            ships={view.yourBoard?.ships ?? []}
            incoming={view.yourBoard?.incoming ?? []}
            interactive={false}
            active={!myTurn}
          />
        </BoardCard>
      </div>

      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <Stat label="Versenkt" value={`${enemy?.shipsSunk ?? 0}/${enemy?.shipsTotal ?? 5}`} accent />
        <Stat label="Verloren" value={`${me?.shipsSunk ?? 0}/${me?.shipsTotal ?? 5}`} />
        <Stat label="Schüsse" value={`${view.yourShots.length}`} />
      </div>

      {feedback && (
        <div className={[
          "fixed bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 z-40 px-5 md:px-6 py-3 rounded-full shadow-soft sans font-medium text-sm md:text-base pop-in whitespace-nowrap",
          feedback.tone === "sunk" ? "bg-ink text-paper" : feedback.tone === "hit" ? "bg-rose text-white" : "bg-surface border border-line text-ink",
        ].join(" ")}>
          {feedback.text}
        </div>
      )}
    </div>
  );
}

function BoardCard({ title, sub, active, order, children }: { title: string; sub: string; active: boolean; order?: string; children: React.ReactNode }) {
  return (
    <div className={`bg-surface border ${active ? "border-rose" : "border-line"} rounded-2xl md:rounded-3xl shadow-soft p-3 md:p-5 transition ${order ?? ""}`}>
      <div className="flex items-end justify-between mb-3">
        <div className="min-w-0">
          <div className="sans font-medium text-ink text-sm md:text-base">{title}</div>
          <div className="text-xs text-muted truncate">{sub}</div>
        </div>
        <div className={`text-[10px] sans uppercase tracking-wider shrink-0 ${active ? "text-rose" : "text-muted"}`}>{active ? "● aktiv" : "pause"}</div>
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl md:rounded-2xl border p-3 md:p-5 ${accent ? "bg-shell border-rose/20" : "bg-surface border-line"} shadow-soft`}>
      <div className="text-[10px] sans uppercase tracking-wider text-muted mb-1 md:mb-2 truncate">{label}</div>
      <div className={`serif text-2xl md:text-4xl leading-none ${accent ? "text-rose" : "text-ink"}`}>{value}</div>
    </div>
  );
}

function EndPanel({ view }: { view: PublicView }) {
  const youWon = view.you !== null && view.winner === view.you;
  return (
    <div className="py-8 md:py-20 grid md:grid-cols-2 gap-8 md:gap-10 items-center fade-up">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-shell text-rose text-xs sans font-medium mb-5">
          Spielbericht
        </div>
        <h2 className="font-medium tracking-tight text-ink text-5xl md:text-7xl leading-[0.95]">
          {youWon ? <>Du hast<br/><span className="serif-it text-rose font-normal">gewonnen.</span></> : <>Knappe<br/><span className="serif-it text-rose font-normal">Niederlage.</span></>}
        </h2>
        <p className="mt-5 text-muted text-base md:text-lg max-w-md">
          {youWon ? "Feindliche Flotte versenkt — Glückwunsch, Kapitän." : "Deine Flotte ist gesunken. Eine Revanche?"}
        </p>
        <div className="mt-7 flex gap-3">
          <a href="/" className="sans font-medium bg-rose text-white px-5 py-3.5 rounded-xl hover:bg-coral transition">Neues Spiel →</a>
        </div>
      </div>
      <div className="bg-surface border border-line rounded-3xl shadow-soft p-6 md:p-8">
        <div className="text-xs sans uppercase tracking-wider text-muted mb-4">Endstand</div>
        <ul className="space-y-3">
          {view.players.map((p, i) => (
            <li key={i} className="flex items-center justify-between border-b border-line/70 pb-3 last:border-0 last:pb-0">
              <span className="flex items-center gap-2 min-w-0">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${view.winner === i ? "bg-rose" : "bg-line"}`} />
                <span className={`sans font-medium truncate ${view.you === i ? "text-rose" : "text-ink"}`}>{p.name}</span>
              </span>
              <span className="text-muted text-sm shrink-0">{p.shipsSunk} / {p.shipsTotal}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
