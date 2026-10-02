"use server";

import { audit } from "@/lib/audit";
import { normUser } from "@/lib/auth";
import { generatePassword, hashPassword } from "@/lib/credentials";
import type { Role } from "@/lib/gantt";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase/server";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
export type UsuarioView = { id: string; usuario: string; nombre: string; rol: Role; activo: boolean; ultimo_ingreso: string | null };

const ROLES: Role[] = ["admin", "editor", "lector"];
const USER_RE = /^[a-z0-9._-]{3,60}$/;
const COLS = "id,usuario,nombre,rol,activo,ultimo_ingreso";
const fail = (error = "No se pudo completar la operación.") => ({ ok: false as const, error });

async function admin() {
  const s = await getSession();
  return s?.role === "admin" ? s : null;
}

function validPassword(p: string) {
  if (p.length < 12 || p.length > 200) return "La contraseña debe tener entre 12 y 200 caracteres.";
  return null;
}

/** Evita quedarse sin administradores activos. */
async function quedaAdmin(excluirId: string) {
  const { count } = await db().from("usuarios").select("id", { count: "exact", head: true }).eq("rol", "admin").eq("activo", true).neq("id", excluirId);
  return (count ?? 0) > 0;
}

export async function listarUsuarios(): Promise<Result<UsuarioView[]>> {
  if (!(await admin())) return fail("Sin permisos.");
  const { data, error } = await db().from("usuarios").select(COLS).order("rol").order("nombre");
  return error ? fail() : { ok: true, data: data as UsuarioView[] };
}

export async function crearUsuario(input: { nombre: string; rol: Role; password: string }): Promise<Result<{ password: string }>> {
  const s = await admin();
  if (!s) return fail("Sin permisos.");
  const nombre = String(input?.nombre ?? "").trim();
  const usuario = normUser(nombre);
  if (!USER_RE.test(usuario) || nombre.length > 100) return fail("Usuario inválido: usa 3 a 60 letras, números, punto, guion o guion bajo (sin espacios).");
  if (!ROLES.includes(input.rol)) return fail("Rol inválido.");
  const password = String(input.password ?? "") || generatePassword();
  const err = validPassword(password);
  if (err) return fail(err);
  const { data: existe } = await db().from("usuarios").select("id").eq("usuario", usuario).maybeSingle();
  if (existe) return fail("Ya existe un usuario con ese nombre.");
  const { data, error } = await db()
    .from("usuarios")
    .insert({ usuario, nombre, rol: input.rol, password_hash: await hashPassword(password) })
    .select("id")
    .single();
  if (error || !data) return fail();
  await audit({ usuario: s.user, rol: s.role, accion: "usuario_creado", entidad: "usuario", entidadId: data.id, resumen: `${nombre} (${input.rol})`, detalle: { usuario: nombre, rol: input.rol } });
  return { ok: true, data: { password } };
}

export async function actualizarUsuario(id: string, cambios: { rol?: Role; activo?: boolean }): Promise<Result> {
  const s = await admin();
  if (!s) return fail("Sin permisos.");
  const { data: prev } = await db().from("usuarios").select(COLS).eq("id", id).maybeSingle();
  if (!prev) return fail("El usuario no existe.");
  const body: { rol?: Role; activo?: boolean } = {};
  if (cambios.rol !== undefined) {
    if (!ROLES.includes(cambios.rol)) return fail("Rol inválido.");
    body.rol = cambios.rol;
  }
  if (cambios.activo !== undefined) body.activo = !!cambios.activo;
  if (id === s.id && (body.rol !== undefined || body.activo !== undefined)) return fail("No puedes cambiar tu propio rol ni desactivarte.");
  const pierdeAdmin = prev.rol === "admin" && prev.activo && ((body.rol && body.rol !== "admin") || body.activo === false);
  if (pierdeAdmin && !(await quedaAdmin(id))) return fail("Debe quedar al menos un administrador activo.");
  const { error } = await db().from("usuarios").update(body).eq("id", id);
  if (error) return fail();
  const detalle: Record<string, { antes: string | boolean; despues: string | boolean }> = {};
  if (body.rol !== undefined && body.rol !== prev.rol) detalle.rol = { antes: prev.rol, despues: body.rol };
  if (body.activo !== undefined && body.activo !== prev.activo) detalle.activo = { antes: prev.activo, despues: body.activo };
  if (Object.keys(detalle).length) await audit({ usuario: s.user, rol: s.role, accion: "usuario_editado", entidad: "usuario", entidadId: id, resumen: prev.nombre, detalle });
  return { ok: true, data: undefined };
}

export async function restablecerPassword(id: string, nueva: string): Promise<Result<{ password: string }>> {
  const s = await admin();
  if (!s) return fail("Sin permisos.");
  const { data: prev } = await db().from("usuarios").select("nombre").eq("id", id).maybeSingle();
  if (!prev) return fail("El usuario no existe.");
  const password = String(nueva ?? "") || generatePassword();
  const err = validPassword(password);
  if (err) return fail(err);
  const { error } = await db().from("usuarios").update({ password_hash: await hashPassword(password) }).eq("id", id);
  if (error) return fail();
  await audit({ usuario: s.user, rol: s.role, accion: "usuario_password", entidad: "usuario", entidadId: id, resumen: prev.nombre });
  return { ok: true, data: { password } };
}
