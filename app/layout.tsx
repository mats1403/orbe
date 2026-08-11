import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orbe — Seu segundo cérebro",
  description: "Um espaço livre para pensar, criar, guardar e conectar tudo o que importa.",
  applicationName: "Orbe",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  openGraph: {
    title: "Orbe — Seu segundo cérebro",
    description: "Um espaço livre para pensar, criar, guardar e conectar tudo o que importa.",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "Orbe — Seu segundo cérebro, do seu jeito." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Orbe — Seu segundo cérebro",
    description: "Um espaço livre para pensar, criar, guardar e conectar tudo o que importa.",
    images: ["/og.png"],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Orbe", statusBarStyle: "default" },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
