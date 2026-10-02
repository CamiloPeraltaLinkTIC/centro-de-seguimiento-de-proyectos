import type { Estado, Role } from "@/lib/gantt";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Insert> = { Row: Row; Insert: Insert; Update: Partial<Insert>; Relationships: [] };

type FrenteRow = { id: string; nombre: string; color: string; orden: number; created_at: string };
type ResponsableRow = { id: string; nombre: string; created_at: string };
type ActividadRow = {
  id: string;
  num: number;
  frente_id: string;
  responsable_id: string | null;
  actividad: string;
  estado: Estado;
  avance: number;
  inicio: string;
  fin: string;
  notas: string;
  created_at: string;
  updated_at: string;
};
export type UsuarioRow = {
  id: string;
  usuario: string;
  nombre: string;
  rol: Role;
  password_hash: string;
  activo: boolean;
  ultimo_ingreso: string | null;
  created_at: string;
  updated_at: string;
};
export type HistorialRow = {
  id: number;
  created_at: string;
  usuario: string;
  rol: Role | null;
  accion: string;
  entidad: string | null;
  entidad_id: string | null;
  resumen: string;
  detalle: Json | null;
  ip: string | null;
};
type IntentoRow = { id: number; ip: string; created_at: string };
export type DocumentoRow = {
  id: string;
  titulo: string;
  descripcion: string;
  categoria: string;
  archivo: string;
  portada: string | null;
  tamano: number;
  subido_por: string;
  created_at: string;
  eliminado_at: string | null;
  eliminado_por: string | null;
};

/** Tipos del esquema `seguimiento` (supabase/migrations/0001_seguimiento.sql). */
export type Database = {
  seguimiento: {
    Tables: {
      usuarios: Table<UsuarioRow, Omit<UsuarioRow, "id" | "created_at" | "updated_at" | "ultimo_ingreso" | "activo"> & { activo?: boolean; ultimo_ingreso?: string | null }>;
      frentes: Table<FrenteRow, Omit<FrenteRow, "id" | "created_at"> & { id?: string }>;
      responsables: Table<ResponsableRow, { id?: string; nombre: string }>;
      actividades: Table<ActividadRow, Omit<ActividadRow, "id" | "created_at" | "updated_at"> & { id?: string }>;
      historial: Table<HistorialRow, Omit<HistorialRow, "id" | "created_at">>;
      intentos_ingreso: Table<IntentoRow, { ip: string; created_at?: string }>;
      documentos: Table<DocumentoRow, Omit<DocumentoRow, "id" | "created_at" | "eliminado_at" | "eliminado_por" | "portada"> & { portada?: string | null; eliminado_at?: string | null; eliminado_por?: string | null }>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
