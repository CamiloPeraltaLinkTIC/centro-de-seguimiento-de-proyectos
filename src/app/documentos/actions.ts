"use server";

import { randomUUID } from "node:crypto";
import { audit } from "@/lib/audit";
import { BUCKET, DOC_COLS, MAX_BYTES, MAX_PORTADA } from "@/lib/documentos";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase/server";
import type { DocumentoRow } from "@/lib/supabase/types";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
export type Documento = Omit<DocumentoRow, "eliminado_at" | "eliminado_por">;
export type ListaDocumentos = { docs: Documento[]; vistos: string[]; vistas: Record<string, number> };

const fail = (error = "No se pudo completar la operación.") => ({ ok: false as const, error });
const PDF_RE = /^[0-9a-f-]{36}\.pdf$/;
const JPG_RE = /^[0-9a-f-]{36}\.jpg$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SOLO_ADMIN = "Solo los administradores pueden subir documentos.";
const text = (v: unknown, max: number, required = true) => {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return (required && !s) || s.length > max ? null : s;
};

async function admin() {
  const s = await getSession();
  return s?.role === "admin" ? s : null;
}

/** Lee los primeros bytes de un archivo del bucket: firma y tamaño real, sin descargarlo completo. */
async function cabecera(path: string) {
  const { data } = await db().storage.from(BUCKET).createSignedUrl(path, 60);
  const res = data ? await fetch(data.signedUrl, { headers: { Range: "bytes=0-7" } }).catch(() => null) : null;
  if (!res?.ok) return null;
  const firma = Buffer.from(await res.arrayBuffer());
  const total = Number(res.headers.get("content-range")?.split("/")[1] ?? res.headers.get("content-length") ?? 0);
  return { firma, total };
}
const esPdf = (h: Awaited<ReturnType<typeof cabecera>>) => !!h && h.firma.toString("latin1").startsWith("%PDF-") && h.total > 0 && h.total <= MAX_BYTES;
const esJpeg = (h: Awaited<ReturnType<typeof cabecera>>) => !!h && h.firma[0] === 0xff && h.firma[1] === 0xd8 && h.firma[2] === 0xff && h.total > 0 && h.total <= MAX_PORTADA;

async function urlSubida(path: string) {
  const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) console.error("[documentos] no se pudo crear la URL de subida:", error?.message);
  return data?.signedUrl ?? null;
}

/* ---------- lectura ---------- */

/** Documentos visibles, los que el usuario ya abrió (para marcar "Nuevo") y, para administradores, el total de vistas. */
export async function listarDocumentos(): Promise<Result<ListaDocumentos>> {
  const s = await getSession();
  if (!s) return fail("Sesión expirada.");
  const { data, error } = await db().from("documentos").select(DOC_COLS).is("eliminado_at", null).order("created_at", { ascending: false });
  if (error) return fail();
  const q = db().from("historial").select("entidad_id,usuario").eq("accion", "documento_visto");
  const { data: h } = s.role === "admin" ? await q : await q.eq("usuario", s.user);
  const vistos = new Set<string>();
  const vistas: Record<string, number> = {};
  for (const r of h ?? []) {
    if (!r.entidad_id) continue;
    if (r.usuario === s.user) vistos.add(r.entidad_id);
    vistas[r.entidad_id] = (vistas[r.entidad_id] ?? 0) + 1;
  }
  return { ok: true, data: { docs: (data ?? []) as Documento[], vistos: [...vistos], vistas: s.role === "admin" ? vistas : {} } };
}

/* ---------- subida (solo administradores) ---------- */

/** Paso 1: permisos de subida firmados (PDF y portada), de un solo uso y válidos 2 h. El navegador sube directo, sin llaves. */
export async function prepararSubida(tamano: number): Promise<Result<{ path: string; url: string; portadaPath: string; portadaUrl: string }>> {
  if (!(await admin())) return fail(SOLO_ADMIN);
  if (!Number.isInteger(tamano) || tamano <= 0 || tamano > MAX_BYTES) return fail("El PDF debe pesar como máximo 50 MB.");
  const id = randomUUID();
  const [url, portadaUrl] = await Promise.all([urlSubida(`${id}.pdf`), urlSubida(`${id}.jpg`)]);
  if (!url || !portadaUrl) return fail("No se pudo preparar la subida. Revisa que exista el bucket (migración 0002_documentos.sql).");
  return { ok: true, data: { path: `${id}.pdf`, url, portadaPath: `${id}.jpg`, portadaUrl } };
}

/** Paso 2: verifica que el archivo sea un PDF real (y la portada un JPEG) y registra el documento. */
export async function confirmarSubida(input: { path: string; portada: string | null; titulo: string; descripcion: string; categoria: string }): Promise<Result<Documento>> {
  const s = await admin();
  if (!s) return fail(SOLO_ADMIN);
  const titulo = text(input?.titulo, 200);
  const descripcion = text(input?.descripcion ?? "", 1000, false);
  const categoria = text(input?.categoria || "General", 60);
  if (!PDF_RE.test(String(input?.path)) || titulo === null || descripcion === null || categoria === null) return fail("Datos inválidos.");
  if (input.portada !== null && (!JPG_RE.test(String(input.portada)) || input.portada.slice(0, 36) !== input.path.slice(0, 36))) return fail("Datos inválidos.");

  const storage = db().storage.from(BUCKET);
  const pdf = await cabecera(input.path);
  if (!esPdf(pdf)) {
    await storage.remove([input.path, ...(input.portada ? [input.portada] : [])]);
    return fail("El archivo no es un PDF válido.");
  }
  let portada: string | null = null;
  if (input.portada) {
    if (esJpeg(await cabecera(input.portada))) portada = input.portada;
    else await storage.remove([input.portada]);
  }

  const { data, error } = await db()
    .from("documentos")
    .insert({ titulo, descripcion, categoria, archivo: input.path, portada, tamano: pdf!.total, subido_por: s.user })
    .select(DOC_COLS)
    .single();
  if (error || !data) {
    await storage.remove([input.path, ...(portada ? [portada] : [])]);
    return fail();
  }
  await audit({ usuario: s.user, rol: s.role, accion: "documento_subido", entidad: "documento", entidadId: data.id, resumen: titulo, detalle: { categoria, tamano: pdf!.total } });
  return { ok: true, data: data as Documento };
}

/* ---------- portadas de documentos anteriores ---------- */

/** Permiso para subir la portada de un documento que no la tiene (la genera el visor de un administrador). */
export async function prepararPortada(id: string): Promise<Result<{ path: string; url: string }>> {
  if (!(await admin()) || !UUID.test(id)) return fail(SOLO_ADMIN);
  const { data: doc } = await db().from("documentos").select("archivo,portada").eq("id", id).is("eliminado_at", null).maybeSingle();
  if (!doc || doc.portada) return fail("No aplica.");
  const path = `${doc.archivo.slice(0, 36)}.jpg`;
  const url = await urlSubida(path);
  return url ? { ok: true, data: { path, url } } : fail();
}

export async function confirmarPortada(id: string, path: string): Promise<Result> {
  if (!(await admin()) || !UUID.test(id) || !JPG_RE.test(String(path))) return fail();
  const { data: doc } = await db().from("documentos").select("archivo,portada").eq("id", id).maybeSingle();
  if (!doc || doc.portada || path.slice(0, 36) !== doc.archivo.slice(0, 36)) return fail();
  if (!esJpeg(await cabecera(path))) {
    await db().storage.from(BUCKET).remove([path]);
    return fail();
  }
  await db().from("documentos").update({ portada: path }).eq("id", id);
  return { ok: true, data: undefined };
}

/* ---------- eliminación ---------- */

/** Elimina el archivo y su portada (solo administradores). El registro se conserva para el historial. */
export async function eliminarDocumento(id: string): Promise<Result> {
  const s = await admin();
  if (!s) return fail("Solo los administradores pueden eliminar documentos.");
  const { data: doc } = await db().from("documentos").select("id,titulo,archivo,portada").eq("id", id).is("eliminado_at", null).maybeSingle();
  if (!doc) return fail("El documento no existe.");
  const { error } = await db().storage.from(BUCKET).remove([doc.archivo, ...(doc.portada ? [doc.portada] : [])]);
  if (error) return fail();
  await db().from("documentos").update({ eliminado_at: new Date().toISOString(), eliminado_por: s.user }).eq("id", id);
  await audit({ usuario: s.user, rol: s.role, accion: "documento_eliminado", entidad: "documento", entidadId: id, resumen: doc.titulo });
  return { ok: true, data: undefined };
}
