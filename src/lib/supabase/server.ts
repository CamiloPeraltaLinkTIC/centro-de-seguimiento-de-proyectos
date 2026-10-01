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
  client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  return client;
}
