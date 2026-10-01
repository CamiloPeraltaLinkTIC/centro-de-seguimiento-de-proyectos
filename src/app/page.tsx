import { redirect } from "next/navigation";
import DashboardLoader from "@/components/DashboardLoader";
import { TASK_COLS } from "@/lib/gantt";
import type { Frente, Responsable, Task } from "@/lib/gantt";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase/server";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [{ data: frentes }, { data: responsables }, { data: tasks }] = await Promise.all([
    db().from("frentes").select("id,nombre,color,orden"),
    db().from("responsables").select("id,nombre"),
    db().from("tasks").select(TASK_COLS),
  ]);

  return (
    <DashboardLoader
      email={session.user}
      role={session.role}
      initialFrentes={(frentes ?? []) as Frente[]}
      initialResponsables={(responsables ?? []) as Responsable[]}
      initialTasks={(tasks ?? []) as Task[]}
    />
  );
}
