import { Skeleton } from "@/components/ui/skeleton";

/** Silueta de la planilla de novedades: encabezado, mes, chips y filas con barra. */
export default function NovedadesLoading() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-5 w-[28rem] max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-11 w-36" />
          <Skeleton className="h-11 w-40" />
          <Skeleton className="h-12 w-44" />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Skeleton className="size-12" />
            <Skeleton className="h-7 w-44" />
            <Skeleton className="size-12" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-11 w-24 rounded-full" />
            <Skeleton className="h-11 w-28 rounded-full" />
            <Skeleton className="h-11 w-28 rounded-full" />
          </div>
        </div>

        <div className="divide-y overflow-hidden rounded-xl border bg-card">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-3 px-4 py-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-52" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-5 w-64" />
              <Skeleton className="h-2.5 w-full max-w-xl rounded-full" />
              <div className="flex gap-1.5">
                <Skeleton className="h-8 w-28 rounded-full" />
                <Skeleton className="h-8 w-36 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
