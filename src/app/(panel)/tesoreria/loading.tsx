import { Skeleton } from "@/components/ui/skeleton";

export default function TesoreriaLoading() {
  return (
    <div className="space-y-8">
      {/* PageHeader */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-5 w-[32rem] max-w-full" />
        </div>
        <Skeleton className="h-11 w-44 rounded-md" />
      </div>

      {/* Pestañas: de a dos en el celular, en fila desde 640 px */}
      <Skeleton className="h-[6.4rem] w-full rounded-xl sm:h-13 sm:w-[34rem] sm:max-w-full" />

      {/* Plata de la cooperativa: banda + Pesos · Dólares · Cheques */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between bg-muted px-5 py-4">
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-56 bg-background/60" />
            <Skeleton className="h-4 w-44 bg-background/60" />
          </div>
          <Skeleton className="h-9 w-44 bg-background/60" />
        </div>
        <div className="grid divide-y lg:grid-cols-[1.3fr_1fr_1fr] lg:divide-x lg:divide-y-0">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-4 px-5 py-5">
              <Skeleton className="h-3 w-16" />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-8 w-32" />
                </div>
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-8 w-28" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Acciones rápidas */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-56" />
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      </div>

      {/* Cajas para validar */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-64" />
        <div className="divide-y rounded-xl border bg-card">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="grid gap-4 px-4 py-4 sm:px-5 md:grid-cols-[14rem_minmax(0,1fr)] md:items-center xl:grid-cols-[16rem_minmax(0,1fr)_auto]"
            >
              <div className="space-y-2">
                <Skeleton className="h-5 w-44" />
                <Skeleton className="h-6 w-36" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-6 w-64" />
                <Skeleton className="h-4 w-80 max-w-full" />
              </div>
              <div className="flex gap-2 md:col-span-2 md:justify-end xl:col-span-1">
                <Skeleton className="size-11 rounded-md" />
                <Skeleton className="h-11 w-40 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
