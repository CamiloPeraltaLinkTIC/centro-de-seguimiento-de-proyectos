export type Estado = "Pendiente" | "En curso" | "Cerrada";
export type Role = "admin" | "editor" | "lector";
export const ROLE_LABEL: Record<Role, string> = { admin: "Administrador", editor: "Editor", lector: "Lector" };

export type Frente = {
  id: string;
  nombre: string;
  color: string;
  orden: number;
};

export type Responsable = {
  id: string;
  nombre: string;
};

export type Task = {
  id: string;
  num: number;
  frente_id: string;
  responsable_id: string | null;
  actividad: string;
  estado: Estado;
  avance: number;
  inicio: string; // YYYY-MM-DD
  fin: string; // YYYY-MM-DD
  notas: string;
};

export type TaskInput = Omit<Task, "id">;

export const DAY = 864e5;
export const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Paleta del Manual de Marca LinkTIC v3
export const PAL: [string, string][] = [
  ["#2709CD", "Azul Premium"],
  ["#0094FF", "Azul LinkTIC"],
  ["#00D9FF", "Cian LinkTIC"],
  ["#75DDFF", "Azul Cian"],
  ["#1DCE00", "Verde Brillante"],
  ["#008800", "Verde Oscuro"],
  ["#516276", "Gris Azul"],
  ["#86858A", "Gris institucional"],
  ["#1E232F", "Negro Grafito"],
];

export const pd = (s: string) => {
  const [y, m, d] = String(s).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
export const fmt = (t: number) => {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
};
export const human = (t: number) => {
  const d = new Date(t);
  return `${d.getUTCDate()} ${MES[d.getUTCMonth()]}`;
};
export const todayUTC = () => {
  const n = new Date();
  return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate());
};

export const dur = (t: Pick<Task, "inicio" | "fin">) => Math.max(1, (pd(t.fin) - pd(t.inicio)) / DAY + 1);
export const isLate = (t: Task, today: number) => t.estado !== "Cerrada" && pd(t.fin) < today;
/** Clase CSS por estado ("En curso" → "En"). */
export const sk = (e: Estado) => (e === "En curso" ? "En" : e);

/** Avance ponderado por duración. */
export const weighted = (ts: Task[]) => {
  const w = ts.reduce((a, t) => a + dur(t), 0) || 1;
  return Math.round(ts.reduce((a, t) => a + dur(t) * (+t.avance || 0), 0) / w);
};

export const TASK_COLS = "id,num,frente_id,responsable_id,actividad,estado,avance,inicio,fin,notas";

export const sortResponsables = (rs: Responsable[]) => [...rs].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

export const sortFrentes = (fs: Frente[]) =>
  [...fs].sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999) || a.nombre.localeCompare(b.nombre, "es"));
