import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Silueta del inicio: saludo + botón, tarjeta principal (número grande y barras) y columna lateral. */
export default function InicioLoading() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-9 w-56" />
        </div>
        <Skeleton className="h-13 w-32" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader className="space-y-2">
            <Skeleton className="h-6 w-52" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-9 w-48" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-44" />
              </div>
            </div>
            <Skeleton className="h-4 w-full rounded-full" />
            {/* Cada concepto: código, nombre, barra y debajo los montos (cobrado · faltan) */}
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 sm:grid-cols-[5rem_minmax(0,1fr)]"
              >
                <Skeleton className="h-6 w-12" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-48 max-w-full" />
                  <Skeleton className="h-3 w-full rounded-full" />
                  <div className="flex flex-wrap justify-between gap-x-4 gap-y-2">
                    <Skeleton className="h-4 w-40 max-w-full" />
                    <Skeleton className="ml-auto h-4 w-28" />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6 max-lg:order-first">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-8 w-40" />
              </div>
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-11 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-6 w-28 max-w-full" />
                </div>
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-28 max-w-full" />
                </div>
              </div>
              <Skeleton className="h-[120px] w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
