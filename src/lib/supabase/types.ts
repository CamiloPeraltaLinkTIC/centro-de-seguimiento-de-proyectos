import type { Estado } from "@/lib/gantt";

type Table<Row, Insert> = { Row: Row; Insert: Insert; Update: Partial<Insert>; Relationships: [] };

type FrenteRow = { id: string; nombre: string; color: string; orden: number; created_at: string };
type ResponsableRow = { id: string; nombre: string; created_at: string };
type TaskRow = {
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
type LoginAttemptRow = { id: number; ip: string; created_at: string };

/** Tipos del esquema de supabase/migrations/0001_schema.sql. */
export type Database = {
  public: {
    Tables: {
      frentes: Table<FrenteRow, Omit<FrenteRow, "id" | "created_at"> & { id?: string }>;
      responsables: Table<ResponsableRow, { id?: string; nombre: string }>;
      tasks: Table<TaskRow, Omit<TaskRow, "id" | "created_at" | "updated_at"> & { id?: string }>;
      login_attempts: Table<LoginAttemptRow, { ip: string; created_at?: string }>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
