import { Skeleton } from "@/components/ui/skeleton";

/** Silueta de la pantalla de caja: cabecera, banda de totales, cobros, canon, cierre y últimos días. */
export default function CargandoCaja() {
  return (
    <div className="space-y-8">
      {/* Cabecera */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-5 w-44" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-11 w-32 rounded-md" />
        </div>
      </div>

      {/* Banda de totales */}
      <div className="overflow-hidden rounded-lg border-2">
        <div className="border-b border-dashed px-4 py-2">
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="grid grid-cols-3 divide-x divide-dashed">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2 px-4 py-5 sm:px-6">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32" />
            </div>
          ))}
        </div>
      </div>

      {/* Cobros del día */}
      <div className="space-y-4 rounded-xl border bg-card p-6">
        <Skeleton className="h-6 w-40" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>

      {/* Canon del día (carga + lista) */}
      <div className="space-y-4 rounded-xl border bg-card p-6">
        <Skeleton className="h-6 w-64" />
        <div className="space-y-3 rounded-lg border border-dashed p-4">
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12 w-40" />
          </div>
        </div>
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>

      {/* Cierre de caja */}
      <div className="flex items-center justify-between gap-4 rounded-lg border bg-card p-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-13 w-44 rounded-md" />
      </div>

      {/* Últimos días */}
      <div className="space-y-4 rounded-xl border bg-card p-6">
        <Skeleton className="h-6 w-32" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
