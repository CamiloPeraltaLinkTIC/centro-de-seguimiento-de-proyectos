"use server";

import { randomUUID } from "node:crypto";
import { audit } from "@/lib/audit";
import { BUCKET, DOC_COLS, MAX_BYTES } from "@/lib/documentos";
import { canEdit, getSession } from "@/lib/session";
import { db } from "@/lib/supabase/server";
import type { DocumentoRow } from "@/lib/supabase/types";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
export type Documento = Omit<DocumentoRow, "eliminado_at" | "eliminado_por">;

const fail = (error = "No se pudo completar la operación.") => ({ ok: false as const, error });
const PATH_RE = /^[0-9a-f-]{36}\.pdf$/;
const text = (v: unknown, max: number, required = true) => {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return (required && !s) || s.length > max ? null : s;
};

/** Paso 1: permiso de subida firmado (un solo archivo, válido 2 h). El navegador sube directo a Storage, sin llaves. */
export async function prepararSubida(tamano: number): Promise<Result<{ path: string; url: string }>> {
  const s = await getSession();
  if (!s || !canEdit(s.role)) return fail("No tienes permisos para subir documentos.");
  if (!Number.isInteger(tamano) || tamano <= 0 || tamano > MAX_BYTES) return fail("El PDF debe pesar como máximo 50 MB.");
  const path = `${randomUUID()}.pdf`;
  const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[documentos] no se pudo crear la URL de subida:", error?.message);
    return fail("No se pudo preparar la subida. Revisa que exista el bucket (migración 0002_documentos.sql).");
  }
  return { ok: true, data: { path, url: data.signedUrl } };
}

/** Paso 2: verifica que el archivo subido sea un PDF real y registra el documento. */
export async function confirmarSubida(input: { path: string; titulo: string; descripcion: string; categoria: string }): Promise<Result<Documento>> {
  const s = await getSession();
  if (!s || !canEdit(s.role)) return fail("No tienes permisos para subir documentos.");
  const titulo = text(input?.titulo, 200);
  const descripcion = text(input?.descripcion ?? "", 1000, false);
  const categoria = text(input?.categoria || "General", 60);
  if (!PATH_RE.test(String(input?.path)) || titulo === null || descripcion === null || categoria === null) return fail("Datos inválidos.");

  const storage = db().storage.from(BUCKET);
  // Lee solo los primeros bytes para comprobar la firma %PDF- y el tamaño real.
  const { data: signed } = await storage.createSignedUrl(input.path, 60);
  const head = signed ? await fetch(signed.signedUrl, { headers: { Range: "bytes=0-7" } }).catch(() => null) : null;
  const firma = head?.ok ? Buffer.from(await head.arrayBuffer()).toString("latin1") : "";
  const total = Number(head?.headers.get("content-range")?.split("/")[1] ?? head?.headers.get("content-length") ?? 0);
  if (!firma.startsWith("%PDF-") || !total || total > MAX_BYTES) {
    await storage.remove([input.path]);
    return fail("El archivo no es un PDF válido.");
  }

  const { data, error } = await db()
    .from("documentos")
    .insert({ titulo, descripcion, categoria, archivo: input.path, tamano: total, subido_por: s.user })
    .select(DOC_COLS)
    .single();
  if (error || !data) {
    await storage.remove([input.path]);
    return fail();
  }
  await audit({ usuario: s.user, rol: s.role, accion: "documento_subido", entidad: "documento", entidadId: data.id, resumen: titulo, detalle: { categoria, tamano: total } });
  return { ok: true, data: data as Documento };
}

/** Elimina el archivo (solo administradores). El registro se conserva para el historial. */
export async function eliminarDocumento(id: string): Promise<Result> {
  const s = await getSession();
  if (!s || s.role !== "admin") return fail("Solo los administradores pueden eliminar documentos.");
  const { data: doc } = await db().from("documentos").select("id,titulo,archivo").eq("id", id).is("eliminado_at", null).maybeSingle();
  if (!doc) return fail("El documento no existe.");
  const { error } = await db().storage.from(BUCKET).remove([doc.archivo]);
  if (error) return fail();
  await db().from("documentos").update({ eliminado_at: new Date().toISOString(), eliminado_por: s.user }).eq("id", id);
  await audit({ usuario: s.user, rol: s.role, accion: "documento_eliminado", entidad: "documento", entidadId: id, resumen: doc.titulo });
  return { ok: true, data: undefined };
}
