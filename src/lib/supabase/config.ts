import "server-only";
import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Configuración de Supabase SOLO para el servidor. Estas variables no llevan el prefijo
 * NEXT_PUBLIC_, por lo que Next.js nunca las incluye en el código que llega al navegador.
 */
export function supabaseEnv() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) throw new Error("Faltan las variables de entorno SUPABASE_URL y SUPABASE_KEY.");
  return { url, key };
}

/** Cookies de sesión inaccesibles desde JavaScript del navegador. */
export const cookieOptions: CookieOptionsWithName = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};
