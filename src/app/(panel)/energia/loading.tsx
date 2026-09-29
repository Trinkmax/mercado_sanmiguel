import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function LoadingEnergia() {
  return (
    <div className="space-y-8">
      {/* PageHeader: título + precio del kWh + planilla + exportar */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-5 w-80 max-w-full" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-16 w-44 rounded-lg" />
          <Skeleton className="h-11 w-72 max-w-full" />
          <Skeleton className="h-11 w-44 max-w-full" />
        </div>
      </div>

      {/* Selector de período */}
      <div className="flex items-center justify-center gap-2">
        <Skeleton className="size-11" />
        <Skeleton className="h-8 w-52" />
        <Skeleton className="size-11" />
      </div>

      {/* Energía del mes: abono × clientes + consumo = total */}
      <div className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-16 w-40 rounded-lg" />
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3 border-t pt-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-7 w-28" />
            </div>
          ))}
        </div>
      </div>

      {/* Progreso + lecturas (tarjetas en celular y tablet, filas en escritorio) */}
      <Card>
        <CardContent className="space-y-5 pt-6">
          <div className="space-y-2">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-3 w-full rounded-full" />
          </div>
          <div className="@container">
            <Skeleton className="mb-3 hidden h-10 w-full @5xl:block" />
            <div className="grid gap-3 @xl:grid-cols-2 @5xl:grid-cols-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-56 w-full rounded-lg @5xl:h-20" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Skeleton className="h-5 w-96 max-w-full" />
    </div>
  );
}
