import "server-only";

export const BUCKET = "seguimiento-documentos";
export const MAX_BYTES = 50 * 1024 * 1024; // 50 MB (igual que el límite del bucket)
export const DOC_COLS = "id,titulo,descripcion,categoria,archivo,portada,tamano,subido_por,created_at";
export const MAX_PORTADA = 2 * 1024 * 1024; // 2 MB

/** Formato de un documento según la extensión de su archivo en el bucket. */
export type TipoDocumento = "pdf" | "html";
export const tipoDe = (archivo: string): TipoDocumento => (archivo.endsWith(".html") ? "html" : "pdf");
