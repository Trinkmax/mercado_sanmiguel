import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingGastos() {
  return (
    <div className="space-y-8">
      {/* PageHeader: título + botón Cargar gasto */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-5 w-80 max-w-full" />
        </div>
        <Skeleton className="h-13 w-44 rounded-md" />
      </div>

      {/* Selector de mes + resumen */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Skeleton className="size-11 rounded-md" />
          <Skeleton className="h-7 w-40" />
          <Skeleton className="size-11 rounded-md" />
        </div>
        <Skeleton className="h-[4.25rem] w-80 max-w-full rounded-lg" />
      </div>

      {/* Tabla de gastos */}
      <div className="space-y-3 rounded-xl border bg-card p-4">
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}
