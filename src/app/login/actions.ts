"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENERIC = "Correo o contraseña incorrectos.";

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!EMAIL.test(email) || email.length > 254 || !password || password.length > 128) return { error: GENERIC };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Mensaje genérico: no revela si el correo existe.
    return { error: error.status === 429 ? "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." : GENERIC };
  }
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
