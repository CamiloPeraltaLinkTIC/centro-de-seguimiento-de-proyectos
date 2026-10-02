import Band from "@/components/Band";
import { TableSkeleton } from "@/components/Loader";

export default function Loading() {
  return (
    <>
      <Band />
      <TableSkeleton label="Cargando historial" />
    </>
  );
}
