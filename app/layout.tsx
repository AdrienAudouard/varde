import type { Metadata } from "next";
import { Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Varde — Planification",
  description: "Planifie tes traces de trail : carte topo, profil et plan d'autonomie.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      data-theme="papier"
      data-contours="on"
      className={`${hankenGrotesk.variable} ${ibmPlexMono.variable} h-full`}
    >
      <body className="h-full overflow-hidden bg-paper text-ink antialiased">{children}</body>
    </html>
  );
}
