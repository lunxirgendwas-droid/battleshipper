"use client";

export function getPlayerId(): string {
  if (typeof window === "undefined") return "";
  const key = "battleshipper_pid";
  let v = localStorage.getItem(key);
  if (!v) {
    v = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36));
    localStorage.setItem(key, v);
  }
  return v;
}

export function getStoredName(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("battleshipper_name") || "";
}

export function setStoredName(name: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("battleshipper_name", name);
}
