import { redirect } from "next/navigation";
import DashboardLoader from "@/components/DashboardLoader";
import { TASK_COLS } from "@/lib/gantt";
import type { Frente, Responsable, Task } from "@/lib/gantt";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase/server";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/sesion/expirada");

  const [fr, rs, ts] = await Promise.all([
    db().from("frentes").select("id,nombre,color,orden"),
    db().from("responsables").select("id,nombre"),
    db().from("actividades").select(TASK_COLS),
  ]);
  const error = fr.error ?? rs.error ?? ts.error;
  if (error) throw new Error(`No se pudieron leer los datos de Supabase: ${error.message}`);
  const frentes = fr.data;
  const responsables = rs.data;
  const tasks = ts.data;

  return (
    <DashboardLoader
      user={session.user}
      role={session.role}
      initialFrentes={(frentes ?? []) as Frente[]}
      initialResponsables={(responsables ?? []) as Responsable[]}
      initialTasks={(tasks ?? []) as Task[]}
    />
  );
}
