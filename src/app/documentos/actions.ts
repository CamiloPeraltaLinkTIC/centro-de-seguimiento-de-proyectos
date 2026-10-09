"use server";

import { randomUUID } from "node:crypto";
import { audit, diff } from "@/lib/audit";
import { BUCKET, DOC_COLS, MAX_BYTES, MAX_PORTADA, tipoDe, type TipoDocumento } from "@/lib/documentos";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase/server";
import type { DocumentoRow } from "@/lib/supabase/types";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
export type Documento = Omit<DocumentoRow, "eliminado_at" | "eliminado_por">;
export type Categoria = { id: string; nombre: string };
export type ListaDocumentos = { docs: Documento[]; categorias: Categoria[]; vistos: string[]; vistas: Record<string, number> };

const fail = (error = "No se pudo completar la operación.") => ({ ok: false as const, error });
const ARCHIVO_RE = /^[0-9a-f-]{36}\.(pdf|html)$/;
const JPG_RE = /^[0-9a-f-]{36}\.jpg$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SOLO_ADMIN = "Solo los administradores pueden subir documentos.";
const SOLO_ADMIN_CAT = "Solo los administradores pueden gestionar las categorías.";
const GENERAL = "General";
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
async function cabecera(path: string, bytes = 8) {
  const { data } = await db().storage.from(BUCKET).createSignedUrl(path, 60);
  const res = data ? await fetch(data.signedUrl, { headers: { Range: `bytes=0-${bytes - 1}` } }).catch(() => null) : null;
  if (!res?.ok) return null;
  const firma = Buffer.from(await res.arrayBuffer());
  const total = Number(res.headers.get("content-range")?.split("/")[1] ?? res.headers.get("content-length") ?? 0);
  return { firma, total };
}
const esPdf = (h: Awaited<ReturnType<typeof cabecera>>) => !!h && h.firma.toString("latin1").startsWith("%PDF-") && h.total > 0 && h.total <= MAX_BYTES;
/** HTML de verdad: texto (sin bytes nulos) que empieza con una etiqueta y declara un documento HTML. */
const esHtml = (h: Awaited<ReturnType<typeof cabecera>>) => {
  if (!h || h.total <= 0 || h.total > MAX_BYTES || h.firma.includes(0)) return false;
  const inicio = h.firma.toString("utf8").replace(/^\uFEFF/, "").trimStart().toLowerCase();
  return inicio.startsWith("<") && (inicio.includes("<!doctype html") || inicio.includes("<html"));
};
const esJpeg = (h: Awaited<ReturnType<typeof cabecera>>) => !!h && h.firma[0] === 0xff && h.firma[1] === 0xd8 && h.firma[2] === 0xff && h.total > 0 && h.total <= MAX_PORTADA;

async function urlSubida(path: string) {
  const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) console.error("[documentos] no se pudo crear la URL de subida:", error?.message);
  return data?.signedUrl ?? null;
}

/* ---------- lectura ---------- */

const ordenar = (cats: Categoria[]) =>
  cats.sort((a, b) => (a.nombre === GENERAL ? -1 : b.nombre === GENERAL ? 1 : a.nombre.localeCompare(b.nombre, "es")));

/** Categorías en orden alfabético, con "General" primero. Null si la tabla aún no existe (migración 0005 pendiente). */
async function categorias(): Promise<Categoria[] | null> {
  const { data, error } = await db().from("documento_categorias").select("id,nombre");
  if (error) console.error("[documentos] no se pudieron leer las categorías (¿falta la migración 0005?):", error.message);
  return error ? null : ordenar(data ?? []);
}

/** Documentos visibles, categorías, los que el usuario ya abrió (para marcar "Nuevo") y, para administradores, el total de vistas. */
export async function listarDocumentos(): Promise<Result<ListaDocumentos>> {
  const s = await getSession();
  if (!s) return fail("Sesión expirada.");
  const [{ data, error }, cats] = await Promise.all([db().from("documentos").select(DOC_COLS).is("eliminado_at", null).order("created_at", { ascending: false }), categorias()]);
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
  return { ok: true, data: { docs: (data ?? []) as Documento[], categorias: cats ?? ordenar([...new Set([GENERAL, ...(data ?? []).map((d) => d.categoria)])].map((nombre) => ({ id: nombre, nombre }))), vistos: [...vistos], vistas: s.role === "admin" ? vistas : {} } };
}

/* ---------- subida (solo administradores) ---------- */

/** Paso 1: permisos de subida firmados (archivo y portada), de un solo uso y válidos 2 h. El navegador sube directo, sin llaves. */
export async function prepararSubida(tamano: number, tipo: TipoDocumento = "pdf"): Promise<Result<{ path: string; url: string; portadaPath: string; portadaUrl: string }>> {
  if (!(await admin())) return fail(SOLO_ADMIN);
  if (tipo !== "pdf" && tipo !== "html") return fail("Datos inválidos.");
  if (!Number.isInteger(tamano) || tamano <= 0 || tamano > MAX_BYTES) return fail("El archivo debe pesar como máximo 50 MB.");
  const id = randomUUID();
  const [url, portadaUrl] = await Promise.all([urlSubida(`${id}.${tipo}`), urlSubida(`${id}.jpg`)]);
  if (!url || !portadaUrl) return fail("No se pudo preparar la subida. Revisa que exista el bucket (migraciones 0002 a 0004).");
  return { ok: true, data: { path: `${id}.${tipo}`, url, portadaPath: `${id}.jpg`, portadaUrl } };
}

type Datos = { titulo: string; descripcion: string; categoria: string };

/** Título, descripción y categoría validados (la categoría, con el nombre exacto de la tabla). */
async function validarDatos(input: Datos): Promise<{ ok: true; data: Datos } | { ok: false; error: string }> {
  const titulo = text(input?.titulo, 200);
  const descripcion = text(input?.descripcion ?? "", 1000, false);
  const nombreCat = text(input?.categoria || GENERAL, 60);
  if (titulo === null || descripcion === null || nombreCat === null) return fail("Datos inválidos.");
  const cats = await categorias();
  const categoria = cats ? cats.find((c) => c.nombre.toLowerCase() === nombreCat.toLowerCase())?.nombre : nombreCat;
  if (!categoria) return fail("La categoría no existe. Elige una de la lista.");
  return { ok: true, data: { titulo, descripcion, categoria } };
}

/**
 * Verifica un archivo recién subido (PDF o HTML real, y la portada un JPEG). Si el archivo no sirve, lo borra.
 * Una portada inválida solo se descarta.
 */
async function verificarArchivo(path: string, portadaPath: string | null): Promise<Result<{ archivo: string; portada: string | null; tamano: number }>> {
  if (!ARCHIVO_RE.test(String(path))) return fail("Datos inválidos.");
  if (portadaPath !== null && (!JPG_RE.test(String(portadaPath)) || portadaPath.slice(0, 36) !== path.slice(0, 36))) return fail("Datos inválidos.");
  const storage = db().storage.from(BUCKET);
  const html = tipoDe(path) === "html";
  const archivo = await cabecera(path, html ? 4096 : 8);
  if (!(html ? esHtml(archivo) : esPdf(archivo))) {
    await storage.remove([path, ...(portadaPath ? [portadaPath] : [])]);
    return fail(html ? "El archivo no es un HTML válido." : "El archivo no es un PDF válido.");
  }
  let portada: string | null = null;
  if (portadaPath) {
    if (esJpeg(await cabecera(portadaPath))) portada = portadaPath;
    else await storage.remove([portadaPath]);
  }
  return { ok: true, data: { archivo: path, portada, tamano: archivo!.total } };
}

/** Paso 2: verifica el archivo y registra el documento. */
export async function confirmarSubida(input: Datos & { path: string; portada: string | null }): Promise<Result<Documento>> {
  const s = await admin();
  if (!s) return fail(SOLO_ADMIN);
  const datos = await validarDatos(input);
  if (!datos.ok) return datos;
  const f = await verificarArchivo(input?.path, input?.portada ?? null);
  if (!f.ok) return f;

  const { data, error } = await db()
    .from("documentos")
    .insert({ ...datos.data, ...f.data, subido_por: s.user })
    .select(DOC_COLS)
    .single();
  if (error || !data) {
    await db().storage.from(BUCKET).remove([f.data.archivo, ...(f.data.portada ? [f.data.portada] : [])]);
    return fail();
  }
  const { titulo, categoria } = datos.data;
  await audit({ usuario: s.user, rol: s.role, accion: "documento_subido", entidad: "documento", entidadId: data.id, resumen: titulo, detalle: { categoria, tamano: f.data.tamano, formato: tipoDe(f.data.archivo) } });
  return { ok: true, data: data as Documento };
}

/* ---------- edición (solo administradores) ---------- */

/**
 * Cambia título, descripción y categoría y, si se envía `nuevo`, reemplaza el archivo (PDF o HTML, puede cambiar de formato).
 * El archivo nuevo se sube antes con `prepararSubida`; el anterior y su portada se borran del bucket.
 */
export async function editarDocumento(id: string, input: Datos & { nuevo: { path: string; portada: string | null } | null }): Promise<Result<Documento>> {
  const s = await admin();
  if (!s) return fail("Solo los administradores pueden editar documentos.");
  if (!UUID.test(id)) return fail("Datos inválidos.");
  const { data: antes } = await db().from("documentos").select(DOC_COLS).eq("id", id).is("eliminado_at", null).maybeSingle();
  const descartar = () => input?.nuevo && db().storage.from(BUCKET).remove([input.nuevo.path, ...(input.nuevo.portada ? [input.nuevo.portada] : [])]);
  if (!antes) {
    if (input?.nuevo && ARCHIVO_RE.test(String(input.nuevo.path))) await descartar();
    return fail("El documento no existe.");
  }
  const datos = await validarDatos(input);
  if (!datos.ok) return datos;

  let cambios: Datos & { archivo?: string; portada?: string | null; tamano?: number } = { ...datos.data };
  if (input.nuevo) {
    if (input.nuevo.path === antes.archivo) return fail("Datos inválidos.");
    const f = await verificarArchivo(input.nuevo.path, input.nuevo.portada ?? null);
    if (!f.ok) return f;
    cambios = { ...cambios, ...f.data };
  }

  const { data, error } = await db().from("documentos").update(cambios).eq("id", id).select(DOC_COLS).single();
  if (error || !data) {
    if (input.nuevo) await descartar();
    return fail();
  }
  if (input.nuevo) await db().storage.from(BUCKET).remove([antes.archivo, ...(antes.portada ? [antes.portada] : [])]);

  const detalle = diff(
    { titulo: antes.titulo, descripcion: antes.descripcion, categoria: antes.categoria, formato: tipoDe(antes.archivo), tamano: antes.tamano },
    { titulo: data.titulo, descripcion: data.descripcion, categoria: data.categoria, ...(input.nuevo ? { formato: tipoDe(data.archivo), tamano: data.tamano } : {}) },
  );
  if (input.nuevo) detalle.archivo = { antes: "anterior", despues: "reemplazado" };
  if (Object.keys(detalle).length) await audit({ usuario: s.user, rol: s.role, accion: "documento_editado", entidad: "documento", entidadId: id, resumen: data.titulo, detalle });
  return { ok: true, data: data as Documento };
}

/* ---------- portadas de documentos anteriores ---------- */

/** Permiso para subir la portada de un documento que no la tiene (la genera el visor de un administrador). */
export async function prepararPortada(id: string): Promise<Result<{ path: string; url: string }>> {
  if (!(await admin()) || !UUID.test(id)) return fail(SOLO_ADMIN);
  const { data: doc } = await db().from("documentos").select("archivo,portada").eq("id", id).is("eliminado_at", null).maybeSingle();
  if (!doc || doc.portada || tipoDe(doc.archivo) !== "pdf") return fail("No aplica.");
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

/* ---------- categorías (filtros, solo administradores) ---------- */

const nombreValido = (v: unknown) => text(v, 60)?.replace(/\s+/g, " ") ?? null;
const DUPLICADA = "Ya existe una categoría con ese nombre.";

export async function crearCategoria(nombre: string): Promise<Result<Categoria>> {
  const s = await admin();
  if (!s) return fail(SOLO_ADMIN_CAT);
  const n = nombreValido(nombre);
  if (!n) return fail("El nombre debe tener entre 1 y 60 caracteres.");
  const { data, error } = await db().from("documento_categorias").insert({ nombre: n }).select("id,nombre").single();
  if (error?.code === "23505") return fail(DUPLICADA);
  if (error || !data) return fail();
  await audit({ usuario: s.user, rol: s.role, accion: "categoria_creada", entidad: "categoria", entidadId: data.id, resumen: n });
  return { ok: true, data };
}

/** Renombra una categoría; sus documentos se actualizan solos (llave foránea con on update cascade). */
export async function renombrarCategoria(id: string, nombre: string): Promise<Result<Categoria>> {
  const s = await admin();
  if (!s) return fail(SOLO_ADMIN_CAT);
  const n = nombreValido(nombre);
  if (!UUID.test(id) || !n) return fail("El nombre debe tener entre 1 y 60 caracteres.");
  const { data: antes } = await db().from("documento_categorias").select("id,nombre").eq("id", id).maybeSingle();
  if (!antes) return fail("La categoría no existe.");
  if (antes.nombre === GENERAL) return fail("La categoría General no se puede renombrar.");
  if (antes.nombre === n) return { ok: true, data: antes };
  const { data, error } = await db().from("documento_categorias").update({ nombre: n }).eq("id", id).select("id,nombre").single();
  if (error?.code === "23505") return fail(DUPLICADA);
  if (error || !data) return fail();
  await audit({ usuario: s.user, rol: s.role, accion: "categoria_editada", entidad: "categoria", entidadId: id, resumen: n, detalle: { nombre: { antes: antes.nombre, despues: n } } });
  return { ok: true, data };
}

/** Elimina una categoría; sus documentos pasan a "General". */
export async function eliminarCategoria(id: string): Promise<Result<{ movidos: number }>> {
  const s = await admin();
  if (!s) return fail(SOLO_ADMIN_CAT);
  if (!UUID.test(id)) return fail();
  const { data: cat } = await db().from("documento_categorias").select("id,nombre").eq("id", id).maybeSingle();
  if (!cat) return fail("La categoría no existe.");
  if (cat.nombre === GENERAL) return fail("La categoría General no se puede eliminar.");
  const { data: movidos, error: e1 } = await db().from("documentos").update({ categoria: GENERAL }).eq("categoria", cat.nombre).select("id");
  if (e1) return fail();
  const { error } = await db().from("documento_categorias").delete().eq("id", id);
  if (error) return fail();
  await audit({ usuario: s.user, rol: s.role, accion: "categoria_eliminada", entidad: "categoria", entidadId: id, resumen: cat.nombre, detalle: { documentos_movidos: movidos?.length ?? 0 } });
  return { ok: true, data: { movidos: movidos?.length ?? 0 } };
}
