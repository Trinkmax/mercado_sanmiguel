import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

/** Silueta del listado de clientes: buscador, dos filas de chips y filas con etiquetas. */
export default function ClientesLoading() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-5 w-80 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-12 w-36" />
          <Skeleton className="h-12 w-44" />
        </div>
      </div>

      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        {[7, 3].map((n, fila) => (
          <div key={fila} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: n }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-28 rounded-full" />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <Skeleton className="h-4 w-48" />
        <Card className="gap-0 divide-y overflow-hidden py-0">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex min-h-16 items-center gap-3 px-4 py-2.5">
              <Skeleton className="h-6 w-12" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-5 w-52 max-w-full" />
                <Skeleton className="h-4 w-40 max-w-full" />
              </div>
              <div className="flex flex-col items-end gap-1">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-6 w-16" />
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
