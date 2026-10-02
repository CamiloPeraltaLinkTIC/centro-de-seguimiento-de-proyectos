import "server-only";
import { headers } from "next/headers";
import type { Role } from "@/lib/gantt";
import { db } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

export type AuditEntry = {
  usuario: string;
  rol: Role | null;
  accion: string;
  entidad?: string;
  entidadId?: string;
  resumen: string;
  detalle?: Json;
};

export async function clientIp() {
  const h = await headers();
  return (h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0] || "desconocida").trim().slice(0, 64);
}

/** Registra un evento en el historial. Nunca interrumpe la operación si el registro falla. */
export async function audit(e: AuditEntry) {
  try {
    const { error } = await db()
      .from("historial")
      .insert({
        usuario: e.usuario.slice(0, 100),
        rol: e.rol,
        accion: e.accion,
        entidad: e.entidad ?? null,
        entidad_id: e.entidadId ?? null,
        resumen: e.resumen.slice(0, 500),
        detalle: e.detalle ?? null,
        ip: await clientIp(),
      });
    if (error) console.error("[historial] no se pudo registrar:", error.message);
  } catch (err) {
    console.error("[historial] no se pudo registrar:", err);
  }
}

/** Campos que cambiaron entre dos objetos: { campo: { antes, despues } }. */
export function diff<T extends Record<string, unknown>>(antes: T, despues: Partial<T>) {
  const out: Record<string, { antes: Json; despues: Json }> = {};
  for (const k of Object.keys(despues)) {
    const a = (antes[k] ?? null) as Json;
    const d = (despues[k] ?? null) as Json;
    if (JSON.stringify(a) !== JSON.stringify(d)) out[k] = { antes: a, despues: d };
  }
  return out;
}
