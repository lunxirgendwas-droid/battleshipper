"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("battleshipper_theme", next ? "dark" : "light"); } catch {}
    setDark(next);
  }

  return (
    <button
      onClick={toggle}
      aria-label="Farbschema umschalten"
      title={dark ? "Heller Modus" : "Dunkler Modus"}
      className={`relative inline-flex items-center w-12 h-6 rounded-full border border-line bg-cream hover:border-rose transition ${className}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-surface shadow-soft flex items-center justify-center text-[10px] transition-transform ${dark ? "translate-x-6" : "translate-x-0"}`}
      >
        {dark ? "🌙" : "☀"}
      </span>
    </button>
  );
}
