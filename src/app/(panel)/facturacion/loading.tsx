import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Silueta de la página de Facturación mientras cargan los datos. */
export default function FacturacionLoading() {
  return (
    <div className="space-y-8">
      {/* PageHeader */}
      <div className="space-y-2 pb-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-full max-w-2xl" />
      </div>

      {/* Tarjeta protagonista del próximo período */}
      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-1">
                <Skeleton className="h-7 w-14" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t pt-4">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-8 w-36" />
          </div>
          <Skeleton className="h-13 w-full sm:w-64" />
        </CardContent>
      </Card>

      {/* Historial */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-44" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
