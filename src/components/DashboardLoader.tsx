"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import Band from "./Band";
import { DashboardSkeleton } from "./Loader";
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
      <DashboardSkeleton label="Preparando el tablero" />
    </>
  ),
});

export default function DashboardLoader(props: ComponentProps<typeof DashboardType>) {
  return <Dashboard {...props} />;
}
