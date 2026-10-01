"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error: string };

const GENERIC = "Contraseña incorrecta.";

/**
 * Login solo con contraseña: hay dos cuentas fijas en Supabase Auth (administrador y lector),
 * cuyos correos viven únicamente en variables de entorno del servidor. La contraseña escrita
 * determina con cuál cuenta se inicia sesión y, por tanto, el rol.
 */
function cuentas() {
  const admin = process.env.AUTH_ADMIN_EMAIL;
  const lector = process.env.AUTH_LECTOR_EMAIL;
  if (!admin || !lector) throw new Error("Faltan las variables de entorno AUTH_ADMIN_EMAIL y AUTH_LECTOR_EMAIL.");
  return [admin, lector];
}

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const password = String(form.get("password") ?? "");
  if (!password || password.length > 128) return { error: GENERIC };

  const supabase = await createClient();
  for (const email of cuentas()) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) redirect("/");
    if (error.status === 429) return { error: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." };
  }
  return { error: GENERIC };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
