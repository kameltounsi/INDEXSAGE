import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SAGE INDEX — Portail unifié",
  description: "Votre espace unifié pour la traçabilité et les ressources humaines.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={geist.variable}>{children}</body>
    </html>
  );
}
