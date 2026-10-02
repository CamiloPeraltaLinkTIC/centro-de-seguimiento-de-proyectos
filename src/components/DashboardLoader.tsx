"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { ui } from "@/lib/ui";
import Band from "./Band";
import SyncBadge from "./SyncBadge";
import type DashboardType from "./Dashboard";

// El tablero depende de la fecha local del navegador ("hoy"), así que se renderiza solo en el cliente.
const Dashboard = dynamic(() => import("./Dashboard"), {
  ssr: false,
  loading: () => (
    <>
      <Band>
        <SyncBadge s="idle" txt="Conectando…" />
      </Band>
      <main className={ui.page}>
        <div className="edge-gradient grid h-[420px] place-items-center rounded-[22px] bg-surface" aria-busy="true">
          <div className={ui.emptyState}>
            <b className={ui.emptyTitle}>Cargando el plan…</b>
            <span>Las actividades aparecen aquí en cuanto se conecta la base del proyecto.</span>
          </div>
        </div>
      </main>
    </>
  ),
});

export default function DashboardLoader(props: ComponentProps<typeof DashboardType>) {
  return <Dashboard {...props} />;
}
