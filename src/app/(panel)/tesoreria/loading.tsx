import { Skeleton } from "@/components/ui/skeleton";

function TituloSeccionSkeleton({ conAccion = false }: { conAccion?: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-1.5">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {conAccion ? <Skeleton className="h-11 w-40" /> : null}
    </div>
  );
}

function TablaSkeleton({ filas = 4 }: { filas?: number }) {
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: filas }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export default function TesoreriaLoading() {
  return (
    <div className="space-y-8">
      {/* PageHeader */}
      <div className="space-y-2 pb-5">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>

      {/* Banda de flujo de caja */}
      <div className="overflow-hidden rounded-xl border">
        <div className="flex items-center justify-between px-5 py-3.5">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64 max-sm:hidden" />
        </div>
        <div className="grid gap-px border-t bg-border sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card px-5 py-5 sm:px-6">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="mt-2 h-8 w-36" />
            </div>
          ))}
        </div>
      </div>

      {/* Cajas para validar */}
      <div className="space-y-4">
        <TituloSeccionSkeleton conAccion />
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4 rounded-xl border bg-card p-5"
          >
            <div className="space-y-2">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-5 w-32" />
            </div>
            <div className="flex gap-8 max-sm:hidden">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="space-y-1.5">
                  <Skeleton className="h-3.5 w-16" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-5">
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-7 w-28" />
              </div>
              <Skeleton className="h-12 w-32" />
            </div>
          </div>
        ))}
      </div>

      {/* Conciliación bancaria */}
      <div className="space-y-4">
        <TituloSeccionSkeleton conAccion />
        <TablaSkeleton filas={4} />
      </div>

      {/* Comprobantes de gastos */}
      <div className="space-y-4">
        <TituloSeccionSkeleton />
        <TablaSkeleton filas={3} />
      </div>

      {/* Flujo de fondos y movimientos bancarios */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-80 max-w-full" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-11 w-44" />
            <Skeleton className="h-11 w-44" />
            <Skeleton className="h-11 w-52" />
          </div>
        </div>
        <TablaSkeleton filas={4} />
      </div>

      {/* Saldos iniciales */}
      <div className="space-y-4">
        <TituloSeccionSkeleton />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-4 rounded-lg border bg-card p-4">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-40" />
              <Skeleton className="h-11 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
