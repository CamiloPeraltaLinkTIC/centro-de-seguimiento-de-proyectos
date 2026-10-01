"use server";

import { TASK_COLS } from "@/lib/gantt";
import type { Frente, Responsable, Task, TaskInput } from "@/lib/gantt";
import { createClient } from "@/lib/supabase/server";

/*
 * Toda lectura y escritura del tablero pasa por aquí: el navegador no tiene acceso directo a Supabase.
 * Cada acción valida la sesión, el rol y los datos recibidos. La base de datos vuelve a verificar
 * el rol con RLS (defensa en profundidad).
 */

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
export type Board = { frentes: Frente[]; responsables: Responsable[]; tasks: Task[] };
export type FrenteDraftInput = { id: string | null; nombre: string; color: string; del: boolean };
export type ResponsableDraftInput = { id: string | null; nombre: string; del: boolean };

const fail = (error = "No se pudo completar la operación.") => ({ ok: false as const, error });

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
async function session(requireAdmin: boolean) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  if (requireAdmin) {
    const { data: p } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
    if (p?.role !== "admin") return null;
  }
  return supabase;
}

/* ---------- lectura ---------- */
export async function getBoard(): Promise<Result<Board>> {
  const supabase = await session(false);
  if (!supabase) return fail("Sesión expirada.");
  const [fr, rs, ts] = await Promise.all([
    supabase.from("frentes").select("id,nombre,color,orden"),
    supabase.from("responsables").select("id,nombre"),
    supabase.from("tasks").select(TASK_COLS),
  ]);
  if (fr.error || rs.error || ts.error) return fail();
  return { ok: true, data: { frentes: fr.data as Frente[], responsables: rs.data as Responsable[], tasks: ts.data as Task[] } };
}

/* ---------- actividades ---------- */
export async function saveTask(id: string | null, input: TaskInput): Promise<Result<Task>> {
  const supabase = await session(true);
  if (!supabase) return fail("No tienes permisos para editar.");
  if (id !== null && !isUuid(id)) return fail();
  const body = parseTask(input);
  if (!body) return fail("Datos inválidos.");
  const q = id ? supabase.from("tasks").update(body).eq("id", id) : supabase.from("tasks").insert(body);
  const { data, error } = await q.select(TASK_COLS).single();
  if (error || !data) return fail();
  return { ok: true, data: data as Task };
}

export async function deleteTask(id: string): Promise<Result> {
  const supabase = await session(true);
  if (!supabase || !isUuid(id)) return fail("No tienes permisos para editar.");
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  return error ? fail() : { ok: true, data: undefined };
}

/* ---------- frentes ---------- */
export async function createFrente(nombre: string, color: string): Promise<Result<Frente>> {
  const supabase = await session(true);
  if (!supabase) return fail("No tienes permisos para editar.");
  const n = text(nombre, 120);
  if (n === null || typeof color !== "string" || !HEX.test(color)) return fail("Datos inválidos.");
  const { data: last } = await supabase.from("frentes").select("orden").order("orden", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase
    .from("frentes")
    .insert({ nombre: n, color, orden: (last?.orden ?? 0) + 1 })
    .select("id,nombre,color,orden")
    .single();
  if (error || !data) return fail();
  return { ok: true, data: data as Frente };
}

export async function saveFrentes(draft: FrenteDraftInput[]): Promise<Result> {
  const supabase = await session(true);
  if (!supabase) return fail("No tienes permisos para editar.");
  if (!Array.isArray(draft) || draft.length > 200) return fail("Datos inválidos.");
  for (const d of draft) {
    if (d.id !== null && !isUuid(d.id)) return fail("Datos inválidos.");
    if (!d.del && (text(d.nombre, 120) === null || !HEX.test(d.color))) return fail("Datos inválidos.");
  }
  const { data: current } = await supabase.from("frentes").select("id,nombre,color,orden");
  const byId = new Map((current ?? []).map((f) => [f.id, f]));

  for (const d of draft) {
    if (d.del && d.id) {
      const { error } = await supabase.from("frentes").delete().eq("id", d.id);
      if (error) return fail();
    }
  }
  let orden = 1;
  for (const d of draft) {
    if (d.del) continue;
    const body = { nombre: d.nombre.trim(), color: d.color, orden: orden++ };
    const prev = d.id ? byId.get(d.id) : null;
    if (prev && prev.nombre === body.nombre && prev.color === body.color && prev.orden === body.orden) continue;
    const { error } = d.id ? await supabase.from("frentes").update(body).eq("id", d.id) : await supabase.from("frentes").insert(body);
    if (error) return fail();
  }
  return { ok: true, data: undefined };
}

/* ---------- responsables ---------- */
export async function createResponsable(nombre: string): Promise<Result<Responsable>> {
  const supabase = await session(true);
  if (!supabase) return fail("No tienes permisos para editar.");
  const n = text(nombre, 120);
  if (n === null) return fail("Datos inválidos.");
  const { data, error } = await supabase.from("responsables").insert({ nombre: n }).select("id,nombre").single();
  if (error || !data) return fail();
  return { ok: true, data: data as Responsable };
}

export async function saveResponsables(draft: ResponsableDraftInput[]): Promise<Result> {
  const supabase = await session(true);
  if (!supabase) return fail("No tienes permisos para editar.");
  if (!Array.isArray(draft) || draft.length > 1000) return fail("Datos inválidos.");
  for (const d of draft) {
    if (d.id !== null && !isUuid(d.id)) return fail("Datos inválidos.");
    if (!d.del && text(d.nombre, 120) === null) return fail("Datos inválidos.");
  }
  const { data: current } = await supabase.from("responsables").select("id,nombre");
  const byId = new Map((current ?? []).map((r) => [r.id, r.nombre]));

  for (const d of draft) {
    if (d.del && d.id) {
      const { error } = await supabase.from("responsables").delete().eq("id", d.id);
      if (error) return fail();
    }
  }
  for (const d of draft) {
    if (d.del) continue;
    const nombre = d.nombre.trim();
    if (d.id && byId.get(d.id) === nombre) continue;
    const { error } = d.id
      ? await supabase.from("responsables").update({ nombre }).eq("id", d.id)
      : await supabase.from("responsables").insert({ nombre });
    if (error) return fail();
  }
  return { ok: true, data: undefined };
}
