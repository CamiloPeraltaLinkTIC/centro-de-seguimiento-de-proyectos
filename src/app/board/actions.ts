"use server";

import { audit, diff } from "@/lib/audit";
import { TASK_COLS } from "@/lib/gantt";
import type { Frente, Responsable, Task, TaskInput } from "@/lib/gantt";
import { canEdit, getSession, type Session } from "@/lib/session";
import { db } from "@/lib/supabase/server";

/*
 * Toda lectura y escritura del tablero pasa por aquí: el navegador no tiene acceso directo a Supabase.
 * Cada acción valida la sesión firmada, el rol y los datos recibidos antes de tocar la base de datos,
 * y registra los cambios en el historial.
 */

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
export type Board = { frentes: Frente[]; responsables: Responsable[]; tasks: Task[] };
export type FrenteDraftInput = { id: string | null; nombre: string; color: string; del: boolean };
export type ResponsableDraftInput = { id: string | null; nombre: string; del: boolean };

const fail = (error = "No se pudo completar la operación.") => ({ ok: false as const, error });
const NO_PERM = "No tienes permisos para editar.";

/* ---------- validación ---------- */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HEX = /^#[0-9a-f]{6}$/i;
const ESTADOS = ["Pendiente", "En curso", "Cerrada"] as const;

const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
const text = (v: unknown, max: number, required = true) => {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if ((required && !s) || s.length > max) return null;
  return s;
};
const validDate = (v: unknown): v is string => typeof v === "string" && DATE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

function parseTask(b: TaskInput): TaskInput | null {
  if (!b || typeof b !== "object") return null;
  const actividad = text(b.actividad, 300);
  const notas = text(b.notas ?? "", 5000, false);
  const num = Number(b.num);
  const avance = Number(b.avance);
  if (actividad === null || notas === null) return null;
  if (!Number.isInteger(num) || num < 1 || num > 100000) return null;
  if (!Number.isInteger(avance) || avance < 0 || avance > 100) return null;
  if (!isUuid(b.frente_id) || (b.responsable_id !== null && !isUuid(b.responsable_id))) return null;
  if (!ESTADOS.includes(b.estado)) return null;
  if (!validDate(b.inicio) || !validDate(b.fin) || b.fin < b.inicio) return null;
  return { num, frente_id: b.frente_id, responsable_id: b.responsable_id, actividad, estado: b.estado, avance, inicio: b.inicio, fin: b.fin, notas };
}

/* ---------- sesión y rol ---------- */
async function session(requireEdit: boolean): Promise<Session | null> {
  const s = await getSession();
  if (!s || (requireEdit && !canEdit(s.role))) return null;
  return s;
}
const who = (s: Session) => ({ usuario: s.user, rol: s.role });

/** Nombres legibles para el historial (frente y responsable en lugar de sus ids). */
async function legible(t: Partial<TaskInput>) {
  const out: Record<string, unknown> = { ...t };
  if (t.frente_id) out.frente_id = (await db().from("frentes").select("nombre").eq("id", t.frente_id).maybeSingle()).data?.nombre ?? t.frente_id;
  if (t.responsable_id) out.responsable_id = (await db().from("responsables").select("nombre").eq("id", t.responsable_id).maybeSingle()).data?.nombre ?? t.responsable_id;
  if ("frente_id" in out) {
    out.frente = out.frente_id;
    delete out.frente_id;
  }
  if ("responsable_id" in out) {
    out.responsable = out.responsable_id;
    delete out.responsable_id;
  }
  return out;
}

/* ---------- lectura ---------- */
export async function getBoard(): Promise<Result<Board>> {
  if (!(await session(false))) return fail("Sesión expirada.");
  const [fr, rs, ts] = await Promise.all([
    db().from("frentes").select("id,nombre,color,orden"),
    db().from("responsables").select("id,nombre"),
    db().from("actividades").select(TASK_COLS),
  ]);
  if (fr.error || rs.error || ts.error) return fail();
  return { ok: true, data: { frentes: fr.data as Frente[], responsables: rs.data as Responsable[], tasks: ts.data as Task[] } };
}

/* ---------- actividades ---------- */
export async function saveTask(id: string | null, input: TaskInput): Promise<Result<Task>> {
  const s = await session(true);
  if (!s) return fail(NO_PERM);
  if (id !== null && !isUuid(id)) return fail();
  const body = parseTask(input);
  if (!body) return fail("Datos inválidos.");

  if (!id) {
    const { data, error } = await db().from("actividades").insert(body).select(TASK_COLS).single();
    if (error || !data) return fail();
    await audit({ ...who(s), accion: "actividad_creada", entidad: "actividad", entidadId: data.id, resumen: `#${body.num} ${body.actividad}`, detalle: (await legible(body)) as never });
    return { ok: true, data: data as Task };
  }

  const { data: prev } = await db().from("actividades").select(TASK_COLS).eq("id", id).maybeSingle();
  if (!prev) return fail("La actividad ya no existe.");
  const { data, error } = await db().from("actividades").update(body).eq("id", id).select(TASK_COLS).single();
  if (error || !data) return fail();
  const cambios = diff(await legible(prev as TaskInput), await legible(body));
  if (Object.keys(cambios).length)
    await audit({
      ...who(s),
      accion: "actividad_editada",
      entidad: "actividad",
      entidadId: id,
      resumen: `#${body.num} ${body.actividad} · ${Object.keys(cambios).join(", ")}`,
      detalle: cambios,
    });
  return { ok: true, data: data as Task };
}

export async function deleteTask(id: string): Promise<Result> {
  const s = await session(true);
  if (!s || !isUuid(id)) return fail(NO_PERM);
  const { data: prev } = await db().from("actividades").select(TASK_COLS).eq("id", id).maybeSingle();
  const { error } = await db().from("actividades").delete().eq("id", id);
  if (error) return fail();
  if (prev)
    await audit({ ...who(s), accion: "actividad_eliminada", entidad: "actividad", entidadId: id, resumen: `#${prev.num} ${prev.actividad}`, detalle: (await legible(prev as TaskInput)) as never });
  return { ok: true, data: undefined };
}

/* ---------- frentes ---------- */
export async function createFrente(nombre: string, color: string): Promise<Result<Frente>> {
  const s = await session(true);
  if (!s) return fail(NO_PERM);
  const n = text(nombre, 120);
  if (n === null || typeof color !== "string" || !HEX.test(color)) return fail("Datos inválidos.");
  const { data: last } = await db().from("frentes").select("orden").order("orden", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await db()
    .from("frentes")
    .insert({ nombre: n, color, orden: (last?.orden ?? 0) + 1 })
    .select("id,nombre,color,orden")
    .single();
  if (error || !data) return fail();
  await audit({ ...who(s), accion: "frente_creado", entidad: "frente", entidadId: data.id, resumen: n, detalle: { nombre: n, color } });
  return { ok: true, data: data as Frente };
}

export async function saveFrentes(draft: FrenteDraftInput[]): Promise<Result> {
  const s = await session(true);
  if (!s) return fail(NO_PERM);
  if (!Array.isArray(draft) || draft.length > 200) return fail("Datos inválidos.");
  for (const d of draft) {
    if (d.id !== null && !isUuid(d.id)) return fail("Datos inválidos.");
    if (!d.del && (text(d.nombre, 120) === null || !HEX.test(d.color))) return fail("Datos inválidos.");
  }
  const { data: current } = await db().from("frentes").select("id,nombre,color,orden");
  const byId = new Map((current ?? []).map((f) => [f.id, f]));

  for (const d of draft) {
    if (d.del && d.id) {
      const { error } = await db().from("frentes").delete().eq("id", d.id);
      if (error) return fail();
      await audit({ ...who(s), accion: "frente_eliminado", entidad: "frente", entidadId: d.id, resumen: byId.get(d.id)?.nombre ?? d.nombre });
    }
  }
  let orden = 1;
  for (const d of draft) {
    if (d.del) continue;
    const body = { nombre: d.nombre.trim(), color: d.color, orden: orden++ };
    const prev = d.id ? byId.get(d.id) : null;
    if (prev && prev.nombre === body.nombre && prev.color === body.color && prev.orden === body.orden) continue;
    if (d.id) {
      const { error } = await db().from("frentes").update(body).eq("id", d.id);
      if (error) return fail();
      if (prev) await audit({ ...who(s), accion: "frente_editado", entidad: "frente", entidadId: d.id, resumen: body.nombre, detalle: diff(prev, body) });
    } else {
      const { data, error } = await db().from("frentes").insert(body).select("id").single();
      if (error) return fail();
      await audit({ ...who(s), accion: "frente_creado", entidad: "frente", entidadId: data?.id, resumen: body.nombre, detalle: body });
    }
  }
  return { ok: true, data: undefined };
}

/* ---------- responsables ---------- */
export async function createResponsable(nombre: string): Promise<Result<Responsable>> {
  const s = await session(true);
  if (!s) return fail(NO_PERM);
  const n = text(nombre, 120);
  if (n === null) return fail("Datos inválidos.");
  const { data, error } = await db().from("responsables").insert({ nombre: n }).select("id,nombre").single();
  if (error || !data) return fail();
  await audit({ ...who(s), accion: "responsable_creado", entidad: "responsable", entidadId: data.id, resumen: n });
  return { ok: true, data: data as Responsable };
}

export async function saveResponsables(draft: ResponsableDraftInput[]): Promise<Result> {
  const s = await session(true);
  if (!s) return fail(NO_PERM);
  if (!Array.isArray(draft) || draft.length > 1000) return fail("Datos inválidos.");
  for (const d of draft) {
    if (d.id !== null && !isUuid(d.id)) return fail("Datos inválidos.");
    if (!d.del && text(d.nombre, 120) === null) return fail("Datos inválidos.");
  }
  const { data: current } = await db().from("responsables").select("id,nombre");
  const byId = new Map((current ?? []).map((r) => [r.id, r.nombre]));

  for (const d of draft) {
    if (d.del && d.id) {
      const { error } = await db().from("responsables").delete().eq("id", d.id);
      if (error) return fail();
      await audit({ ...who(s), accion: "responsable_eliminado", entidad: "responsable", entidadId: d.id, resumen: byId.get(d.id) ?? d.nombre });
    }
  }
  for (const d of draft) {
    if (d.del) continue;
    const nombre = d.nombre.trim();
    const prev = d.id ? byId.get(d.id) : undefined;
    if (d.id && prev === nombre) continue;
    if (d.id) {
      const { error } = await db().from("responsables").update({ nombre }).eq("id", d.id);
      if (error) return fail();
      await audit({ ...who(s), accion: "responsable_editado", entidad: "responsable", entidadId: d.id, resumen: nombre, detalle: { nombre: { antes: prev ?? null, despues: nombre } } });
    } else {
      const { data, error } = await db().from("responsables").insert({ nombre }).select("id").single();
      if (error) return fail();
      await audit({ ...who(s), accion: "responsable_creado", entidad: "responsable", entidadId: data?.id, resumen: nombre });
    }
  }
  return { ok: true, data: undefined };
}
