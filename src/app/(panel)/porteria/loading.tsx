import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/** Silueta de la pantalla de Portería mientras carga. */
export default function PorteriaLoading() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-5 w-80 max-w-full" />
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] xl:items-start">
        {/* Registrar ingreso */}
        <div className="space-y-6 rounded-lg border bg-card p-5 sm:p-6">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-12 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-[180px] w-full" />
          </div>
          <Skeleton className="h-16 w-full" />
        </div>

        <div className="space-y-8">
          {/* Ingresos de hoy */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="space-y-2">
                <Skeleton className="h-7 w-44" />
                <Skeleton className="h-4 w-40" />
              </div>
              <Skeleton className="h-11 w-40" />
            </div>
            <Skeleton className="h-14 w-full" />
            <Card className="gap-0 divide-y overflow-hidden py-0">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3">
                  <Skeleton className="h-6 w-12" />
                  <Skeleton className="h-12 w-24" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-5 w-40 max-w-full" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-12 w-32" />
                </div>
              ))}
            </Card>
          </div>

          {/* Solicitudes */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full max-w-md" />
            </CardHeader>
            <CardContent className="flex gap-3">
              <Skeleton className="h-12 w-56" />
              <Skeleton className="h-12 w-40" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
