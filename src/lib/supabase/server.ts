import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Cliente de Supabase SOLO para el servidor, con la secret key.
 * La autorización (sesión y rol) la hacen las server actions antes de usarlo.
 */
let client: SupabaseClient<Database> | null = null;

export function db() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Faltan las variables de entorno SUPABASE_URL y SUPABASE_SECRET_KEY.");
  assertSecretKey(key);
  client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  return client;
}

/**
 * Evita el error silencioso más común: usar la publishable/anon key. Con ella la base de datos
 * (cerrada para anónimos) devuelve listas vacías y el tablero aparece sin datos.
 */
function assertSecretKey(key: string) {
  let ok = key.startsWith("sb_secret_");
  if (key.startsWith("eyJ")) {
    try {
      ok = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role === "service_role";
    } catch {
      ok = false;
    }
  }
  if (!ok)
    throw new Error(
      "SUPABASE_SECRET_KEY no es una secret key. Usa la Secret key (sb_secret_…) o la service_role de Project Settings → API Keys, no la publishable/anon.",
    );
}
