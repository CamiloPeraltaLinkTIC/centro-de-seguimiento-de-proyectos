"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkCredentials, createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { db } from "@/lib/supabase/server";

export type LoginState = { error: string };

const GENERIC = "Usuario o contraseña incorrectos.";
const MAX_FAILS = 10; // intentos fallidos permitidos por IP…
const WINDOW_MIN = 15; // …en esta ventana de minutos

async function clientIp() {
  const h = await headers();
  return (h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0] || "desconocida").trim().slice(0, 64);
}

const pause = () => new Promise((r) => setTimeout(r, 400 + Math.random() * 400));

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const user = String(form.get("username") ?? "");
  const pass = String(form.get("password") ?? "");
  if (!user || !pass || user.length > 100 || pass.length > 200) return { error: GENERIC };

  const ip = await clientIp();
  const since = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString();
  const { count, error: countError } = await db()
    .from("login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", since);
  if (countError) return { error: "No se pudo verificar el ingreso. Intenta de nuevo." };
  if ((count ?? 0) >= MAX_FAILS) return { error: `Demasiados intentos. Espera ${WINDOW_MIN} minutos e inténtalo de nuevo.` };

  const cuenta = await checkCredentials(user, pass);
  if (!cuenta) {
    await db().from("login_attempts").insert({ ip });
    await db().from("login_attempts").delete().lt("created_at", new Date(Date.now() - 86_400_000).toISOString());
    await pause();
    return { error: GENERIC };
  }

  await db().from("login_attempts").delete().eq("ip", ip);
  (await cookies()).set(SESSION_COOKIE, await createSessionToken(cuenta), sessionCookieOptions);
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
