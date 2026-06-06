import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Battleshipper",
  description: "Zwei Kapitäne. Ein Ozean. Ein Sieger.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="relative">{children}</body>
    </html>
  );
}
