import { Skeleton } from "@/components/ui/skeleton";

/** Silueta de "Cargar novedad": encabezado y la grilla de empleados para elegir. */
export default function NuevaNovedadLoading() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-5 w-[30rem] max-w-full" />
        </div>
        <Skeleton className="h-11 w-48" />
      </div>
      <div className="max-w-4xl space-y-3">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-12 w-full" />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
