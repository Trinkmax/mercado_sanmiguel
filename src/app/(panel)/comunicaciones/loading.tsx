import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingComunicaciones() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-5 w-[30rem] max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-11 w-40 rounded-md" />
          <Skeleton className="h-12 w-44 rounded-md" />
        </div>
      </div>

      {/* Pestañas: Circulares · Notificaciones · Apercibimientos · Sanciones · Términos */}
      <div className="flex gap-2 overflow-hidden">
        <Skeleton className="h-11 w-32 shrink-0 rounded-md" />
        <Skeleton className="h-11 w-40 shrink-0 rounded-md" />
        <Skeleton className="h-11 w-44 shrink-0 rounded-md" />
        <Skeleton className="h-11 w-32 shrink-0 rounded-md" />
        <Skeleton className="ml-auto h-11 w-28 shrink-0 rounded-md max-sm:hidden" />
      </div>

      {/* Filas: número, título, público, "La vieron X de Y" */}
      <div className="divide-y overflow-hidden rounded-xl border bg-card">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex min-h-16 items-center gap-3 px-4 py-3">
            <Skeleton className="h-6 w-10" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-1.5 w-48 rounded-full" />
            </div>
            <Skeleton className="size-4 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
