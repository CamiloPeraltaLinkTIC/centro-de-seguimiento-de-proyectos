import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import type { Role } from "@/lib/gantt";
import { fingerprint, SESSION_COOKIE, verifySessionToken } from "./auth";
import { db } from "./supabase/server";

export type Session = { id: string; user: string; role: Role };

/**
 * Sesión válida: firma correcta y, en la base de datos, usuario activo con el mismo rol y contraseña.
 * Cambiar la contraseña, el rol o desactivar a alguien cierra sus sesiones de inmediato.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const t = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!t) return null;
  const { data: u } = await db().from("usuarios").select("id,nombre,rol,password_hash,activo").eq("id", t.uid).maybeSingle();
  if (!u || !u.activo || u.rol !== t.role || (await fingerprint(u)) !== t.v) return null;
  return { id: u.id, user: u.nombre, role: u.rol };
});

export const canEdit = (role: string) => role === "admin" || role === "editor";
