import { Skeleton } from "@/components/ui/skeleton";

/** Silueta de la caja: cabecera, banda de lo juntado, acción del día, cobros, bono camioneros, historial y últimos días. */
export default function CargandoCaja() {
  return (
    <div className="space-y-8">
      {/* Cabecera */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-44" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-7 w-20 rounded-sm" />
          <Skeleton className="h-11 w-36 rounded-md" />
          <Skeleton className="h-11 w-44 rounded-md" />
        </div>
      </div>

      {/* Banda de lo juntado */}
      <div className="overflow-hidden rounded-lg border-2">
        <div className="flex justify-between border-b border-dashed px-4 py-2 sm:px-6">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3">
          <div className="col-span-2 space-y-2 border-b border-dashed px-4 py-5 sm:col-span-1 sm:border-b-0 sm:px-6">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-9 w-40" />
          </div>
          {[0, 1].map((i) => (
            <div key={i} className="space-y-2 px-4 py-5 sm:px-6">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-28" />
            </div>
          ))}
        </div>
        <div className="space-y-1.5 border-t border-dashed px-4 py-3 sm:px-6">
          <Skeleton className="h-4 w-full max-w-lg" />
          <Skeleton className="h-4 w-60" />
        </div>
      </div>

      {/* Acción del día (cerrar / recibir / validar) */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-13 w-full rounded-md sm:w-44" />
      </div>

      {/* Cobros por recibo */}
      <div className="space-y-4 rounded-xl border bg-card p-6">
        <div className="flex justify-between">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-5 w-32" />
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-4 border-t pt-3">
            <Skeleton className="h-4 w-10" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-6 w-24" />
          </div>
        ))}
      </div>

      {/* Historial plegado */}
      <Skeleton className="h-12 w-full rounded-lg" />

      {/* Últimos días */}
      <div className="space-y-4 rounded-xl border bg-card p-6">
        <Skeleton className="h-6 w-32" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    </div>
  );
}
