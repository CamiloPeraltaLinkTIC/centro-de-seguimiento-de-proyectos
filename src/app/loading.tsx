import Band from "@/components/Band";
import { DashboardSkeleton } from "@/components/Loader";
import SyncBadge from "@/components/SyncBadge";

export default function Loading() {
  return (
    <>
      <Band>
        <SyncBadge s="idle" txt="Conectando…" />
      </Band>
      <DashboardSkeleton />
    </>
  );
}
