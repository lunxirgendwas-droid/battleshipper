"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getPlayerId, getStoredName, setStoredName } from "@/lib/playerId";
import ThemeToggle from "./ThemeToggle";

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"erstellen" | "beitreten">("erstellen");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setName(getStoredName()); }, []);

  async function createRoom() {
    setError(null);
    if (!name.trim()) return setError("Bitte einen Namen eingeben.");
    setBusy(true);
    setStoredName(name.trim());
    try {
      const res = await fetch("/api/raum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), playerId: getPlayerId() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fehler.");
      router.push(`/raum/${data.code}`);
    } catch (e: any) { setError(e.message); setBusy(false); }
  }

  async function joinRoom() {
    setError(null);
    if (!name.trim()) return setError("Bitte einen Namen eingeben.");
    const c = code.trim().toUpperCase();
    if (c.length !== 5) return setError("Der Raumcode hat 5 Zeichen.");
    setBusy(true);
    setStoredName(name.trim());
    try {
      const res = await fetch(`/api/raum/${c}/beitreten`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), playerId: getPlayerId() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fehler.");
      router.push(`/raum/${data.code}`);
    } catch (e: any) { setError(e.message); setBusy(false); }
  }

  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-4 md:px-12 py-4 md:py-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="sans font-medium text-ink">Battleshipper</span>
        </div>
        <div className="flex items-center gap-5 text-sm text-muted">
          <a href="#wie" className="hidden md:inline hover:text-ink transition">So funktioniert's</a>
          <span className="hidden md:flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-rose pulse-dot" /> Live</span>
          <ThemeToggle />
        </div>
      </header>

      <section className="flex-1 px-4 md:px-12 grid lg:grid-cols-[1.1fr,1fr] gap-8 lg:gap-16 max-w-6xl mx-auto w-full pt-4 lg:pt-16 pb-12">
        <div className="fade-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-shell text-rose text-xs sans font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-rose" /> Schiffe versenken · online · zu zweit
          </div>
          <h1 className="font-medium tracking-tight text-ink text-[clamp(2.6rem,11vw,6.5rem)] leading-[0.95]">
            Zwei Flotten.
            <br/>
            <span className="serif-it text-rose font-normal">Ein Ozean.</span>
            <br/>
            Ein Sieger.
          </h1>
          <p className="mt-5 md:mt-7 max-w-md text-muted text-base md:text-lg leading-relaxed">
            Klassisches Schiffe-Versenken, gespielt im Browser. Erstelle einen Raum, teile den Code, und versenke die Flotte deines Gegners — Zelle für Zelle.
          </p>

          <ol id="wie" className="mt-8 md:mt-12 space-y-4 md:space-y-5 max-w-md">
            {[
              ["01", "Raum erstellen", "Du bekommst einen 5-Zeichen-Code."],
              ["02", "Code teilen", "Dein Mitspieler tritt damit bei."],
              ["03", "Schiffe platzieren", "Fünf Schiffe, 10×10-Raster, frei drehbar."],
              ["04", "Abwechselnd feuern", "Wer zuerst alle gegnerischen Schiffe versenkt, gewinnt."],
            ].map(([n, h, t]) => (
              <li key={n} className="flex gap-5 items-baseline">
                <span className="serif-it text-rose text-3xl leading-none w-10 shrink-0">{n}</span>
                <div>
                  <div className="sans font-medium text-ink">{h}</div>
                  <div className="text-muted text-sm">{t}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="lg:pt-16">
          <div className="relative bg-surface border border-line rounded-3xl shadow-soft overflow-hidden">
            <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-blush blur-2xl opacity-70" />
            <div className="relative p-7 md:p-9">
              <div className="flex items-center gap-2 mb-7">
                {(["erstellen", "beitreten"] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`px-4 py-2 rounded-full text-sm sans font-medium transition ${mode === m ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}
                  >
                    {m === "erstellen" ? "Raum erstellen" : "Raum beitreten"}
                  </button>
                ))}
              </div>

              <label className="block mb-5">
                <div className="text-xs sans font-medium text-muted mb-2 uppercase tracking-wider">Dein Name</div>
                <input
                  value={name}
                  onChange={e => setName(e.target.value.slice(0, 20))}
                  placeholder="z. B. Mira"
                  className="w-full bg-cream/60 border border-line rounded-xl px-4 py-3.5 sans text-ink text-base focus:outline-none focus:border-rose focus:bg-surface transition"
                  maxLength={20}
                />
              </label>

              {mode === "beitreten" && (
                <label className="block mb-5">
                  <div className="text-xs sans font-medium text-muted mb-2 uppercase tracking-wider">Raumcode</div>
                  <input
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 5))}
                    placeholder="ABCDE"
                    className="w-full bg-cream/60 border border-line rounded-xl px-4 py-3.5 mono text-ink text-2xl tracking-[0.4em] text-center focus:outline-none focus:border-rose focus:bg-surface transition"
                    maxLength={5}
                  />
                </label>
              )}

              {error && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-shell border border-rose/30 text-rose text-sm shake">
                  {error}
                </div>
              )}

              <button
                onClick={mode === "erstellen" ? createRoom : joinRoom}
                disabled={busy}
                className="w-full bg-rose text-white sans font-medium text-base py-4 rounded-xl hover:bg-coral transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {busy ? "Verbindet…" : mode === "erstellen" ? "Raum erstellen →" : "Beitreten →"}
              </button>

              <div className="mt-7 grid grid-cols-3 gap-3 text-center">
                <Stat n="5" l="Schiffe" />
                <Stat n="10×10" l="Felder" />
                <Stat n="2" l="Spieler" />
              </div>
            </div>
          </div>

          <p className="mt-5 text-xs text-muted text-center">
            Kein Account nötig. Räume verfallen nach vier Stunden Inaktivität.
          </p>
        </div>
      </section>

      <footer className="px-6 md:px-12 py-6 border-t border-line/70 flex items-center justify-between text-sm text-muted">
        <span className="sans">Battleshipper</span>
        <span className="serif-it">Volltreffer.</span>
      </footer>
    </main>
  );
}

function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" className="text-rose">
      <circle cx="13" cy="13" r="11" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="13" cy="13" r="3" fill="currentColor" />
      <line x1="13" y1="2" x2="13" y2="6" stroke="currentColor" strokeWidth="1.5" />
      <line x1="13" y1="20" x2="13" y2="24" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div className="bg-cream/60 rounded-xl py-3 border border-line/60">
      <div className="serif text-ink text-2xl leading-none">{n}</div>
      <div className="text-[10px] sans text-muted uppercase tracking-wider mt-1.5">{l}</div>
    </div>
  );
}
