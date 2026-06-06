import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0e0e0c",
        paper: "#fbf9f6",
        cream: "#f4f0e8",
        line: "#e7e2d8",
        muted: "#6b6b66",
        rose: "#ff295c",
        coral: "#ff5b7a",
        blush: "#ffd9e1",
        shell: "#ffeef2",
        ocean: "#e9f0f4",
        wave: "#cfdde4",
        sea: "#7892a0",
      },
      fontFamily: {
        serif: ['"Instrument Serif"', "ui-serif", "Georgia"],
        sans: ['"Geist"', "ui-sans-serif", "system-ui"],
        mono: ['"Geist Mono"', "ui-monospace"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(14,14,12,0.04), 0 8px 24px -12px rgba(14,14,12,0.12)",
        pop: "0 2px 0 rgba(14,14,12,0.9)",
      },
    },
  },
  plugins: [],
} satisfies Config;
