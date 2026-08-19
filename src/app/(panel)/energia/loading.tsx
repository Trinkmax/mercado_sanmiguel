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

      {/* Progreso + tabla de carga rápida */}
      <Card>
        <CardContent className="space-y-5 pt-6">
          <div className="space-y-2">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-3 w-full rounded-full" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>

      <Skeleton className="h-5 w-96 max-w-full" />
    </div>
  );
}
