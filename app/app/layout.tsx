import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Varde — Planification",
  description:
    "Planifie tes traces de trail : carte topo, profil et plan d'autonomie.",
};

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
