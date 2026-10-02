"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { audit, clientIp } from "@/lib/audit";
import { createSessionToken, fingerprint, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { checkCredentials } from "@/lib/credentials";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase/server";

export type LoginState = { error: string };

const GENERIC = "Usuario o contraseña incorrectos.";
const MAX_FAILS = 10; // intentos fallidos permitidos por IP…
const WINDOW_MIN = 15; // …en esta ventana de minutos

const pause = () => new Promise((r) => setTimeout(r, 400 + Math.random() * 400));

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const user = String(form.get("username") ?? "").trim();
  const pass = String(form.get("password") ?? "");
  if (!user || !pass || user.length > 100 || pass.length > 200) return { error: GENERIC };

  const ip = await clientIp();
  const since = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString();
  const { count, error: countError } = await db()
    .from("intentos_ingreso")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", since);
  if (countError) return { error: "No se pudo verificar el ingreso. Intenta de nuevo." };
  if ((count ?? 0) >= MAX_FAILS) {
    await audit({ usuario: user, rol: null, accion: "login_bloqueado", resumen: `Ingreso bloqueado por exceso de intentos (${WINDOW_MIN} min)` });
    return { error: `Demasiados intentos. Espera ${WINDOW_MIN} minutos e inténtalo de nuevo.` };
  }

  const cuenta = await checkCredentials(user, pass);
  if (!cuenta) {
    await db().from("intentos_ingreso").insert({ ip });
    await db().from("intentos_ingreso").delete().lt("created_at", new Date(Date.now() - 86_400_000).toISOString());
    await audit({ usuario: user, rol: null, accion: "login_fallido", resumen: "Usuario o contraseña incorrectos" });
    await pause();
    return { error: GENERIC };
  }

  await db().from("intentos_ingreso").delete().eq("ip", ip);
  await db().from("usuarios").update({ ultimo_ingreso: new Date().toISOString() }).eq("id", cuenta.id);
  const token = await createSessionToken({ uid: cuenta.id, role: cuenta.rol, v: await fingerprint(cuenta) });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
  await audit({ usuario: cuenta.nombre, rol: cuenta.rol, accion: "login", resumen: "Inicio de sesión" });
  redirect("/");
}

export async function logout() {
  const s = await getSession();
  if (s) await audit({ usuario: s.user, rol: s.role, accion: "logout", resumen: "Cierre de sesión" });
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
