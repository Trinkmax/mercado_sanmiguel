import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { COLUMNAS_FILA_GASTO } from "@/components/gastos/fila-gasto";

function FilaSkeleton() {
  return (
    <div className={cn("grid gap-3 px-4 py-4", COLUMNAS_FILA_GASTO)}>
      <Skeleton className="hidden h-4 w-20 xl:block" />
      <div className="space-y-2">
        <Skeleton className="h-5 w-56 max-w-full" />
        {/* Celular: el monto va debajo del nombre. */}
        <Skeleton className="h-6 w-28 md:hidden" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-12 rounded-md" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <div className="hidden flex-col items-end gap-2 md:flex">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-6 w-20 rounded-md" />
      </div>
      <div className="flex items-center justify-between gap-2 md:justify-end">
        <Skeleton className="h-7 w-20 rounded-md md:hidden" />
        <Skeleton className="h-11 w-24 rounded-md" />
      </div>
    </div>
  );
}

export default function LoadingGastos() {
  return (
    <div className="space-y-8">
      {/* PageHeader: título + exportar + Cargar gasto */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-5 w-96 max-w-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-11 w-40 rounded-md" />
          <Skeleton className="h-12 w-40 rounded-md" />
        </div>
      </div>

      {/* Mes + resumen (Por pagar · Pagado · Vencen en los próximos 7 días) */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Skeleton className="size-11 rounded-md" />
          <Skeleton className="h-7 w-40" />
          <Skeleton className="size-11 rounded-md" />
        </div>
        <Skeleton className="h-20 w-full rounded-xl sm:w-[28rem] sm:max-w-full" />
      </div>

      {/* Aviso de fijos para traer */}
      <Skeleton className="h-20 w-full rounded-xl" />

      {/* Chips de tipo */}
      <div className="flex gap-2">
        <Skeleton className="h-11 w-24 rounded-full" />
        <Skeleton className="h-11 w-24 rounded-full" />
        <Skeleton className="h-11 w-28 rounded-full" />
      </div>

      {/* Por pagar */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="divide-y rounded-xl border bg-card">
          {Array.from({ length: 5 }).map((_, i) => (
            <FilaSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
