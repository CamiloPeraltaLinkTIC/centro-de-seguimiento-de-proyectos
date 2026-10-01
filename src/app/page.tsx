import { redirect } from "next/navigation";
import DashboardLoader from "@/components/DashboardLoader";
import { TASK_COLS } from "@/lib/gantt";
import type { Frente, Responsable, Role, Task } from "@/lib/gantt";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const [{ data: profile }, { data: frentes }, { data: responsables }, { data: tasks }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle(),
    supabase.from("frentes").select("id,nombre,color,orden"),
    supabase.from("responsables").select("id,nombre"),
    supabase.from("tasks").select(TASK_COLS),
  ]);

  const role: Role = profile?.role === "admin" ? "admin" : "lector";

  return (
    <DashboardLoader
      email={auth.user.email ?? ""}
      role={role}
      initialFrentes={(frentes ?? []) as Frente[]}
      initialResponsables={(responsables ?? []) as Responsable[]}
      initialTasks={(tasks ?? []) as Task[]}
    />
  );
}
