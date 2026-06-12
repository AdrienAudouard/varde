import type { Metadata } from "next";
import { Hanken_Grotesk, IBM_Plex_Mono, Archivo } from "next/font/google";
import "./globals.css";
import { getLocale } from "@/lib/i18n/get-locale";

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

const archivo = Archivo({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Varde",
  description:
    "Planificateur d'autonomie pour le trail et la montagne : carte topo, profil altimétrique et plan d'eau par segment.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      data-theme="papier"
      data-contours="on"
      className={`${hankenGrotesk.variable} ${ibmPlexMono.variable} ${archivo.variable} h-full`}
    >
      <body className="bg-paper text-ink antialiased">{children}</body>
    </html>
  );
}
