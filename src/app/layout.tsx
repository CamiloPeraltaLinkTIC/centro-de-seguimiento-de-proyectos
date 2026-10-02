import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import { headers } from "next/headers";
import "./globals.css";

// Fuentes de marca LinkTIC (las mismas del Centro de Mando Digital).
const clash = localFont({ src: "../fonts/ClashDisplay-Variable.woff2", variable: "--font-clash", weight: "400 700", display: "swap" });
const nexa = localFont({
  src: [
    { path: "../fonts/nexa-regular.woff2", weight: "400" },
    { path: "../fonts/Nexa-Bold.woff2", weight: "700" },
  ],
  variable: "--font-nexa",
  display: "swap",
});
const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Centro de seguimiento de proyectos",
  description: "Plan de trabajo MATERAN · creación, expectativa y lanzamiento de marca",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#070A16" };

// Aplica el tema guardado antes de pintar (evita el parpadeo claro/oscuro).
const THEME_SCRIPT = `try{var t=localStorage.getItem("cs-theme");if(t==="light")document.documentElement.dataset.theme="light"}catch(e){}`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Leer las cabeceras hace el render dinámico: Next.js aplica a sus scripts el nonce de la CSP de cada petición.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="es" className={`${clash.variable} ${nexa.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
