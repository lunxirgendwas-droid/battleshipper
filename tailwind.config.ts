import type { Config } from "tailwindcss";

const c = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink:     c("--ink"),
        paper:   c("--paper"),
        surface: c("--surface"),
        cream:   c("--cream"),
        line:    c("--line"),
        muted:   c("--muted"),
        rose:    c("--rose"),
        coral:   c("--coral"),
        blush:   c("--blush"),
        shell:   c("--shell"),
        ocean:   c("--ocean"),
        wave:    c("--wave"),
        sea:     c("--sea"),
      },
      fontFamily: {
        serif: ['"Instrument Serif"', "ui-serif", "Georgia"],
        sans: ['"Geist"', "ui-sans-serif", "system-ui"],
        mono: ['"Geist Mono"', "ui-monospace"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px -12px rgba(0,0,0,0.12)",
        pop: "0 2px 0 rgba(0,0,0,0.9)",
      },
    },
  },
  plugins: [],
} satisfies Config;
