import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Silueta del inicio: saludo + botón, tarjeta principal y columna lateral. */
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
          <CardHeader>
            <Skeleton className="h-6 w-52" />
          </CardHeader>
          <CardContent className="space-y-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-7 w-14" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-full rounded-full" />
                </div>
                <Skeleton className="h-4 w-36 max-sm:hidden" />
              </div>
            ))}
            <div className="flex items-center justify-between border-t pt-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-6 w-64" />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6 max-lg:order-first">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-28" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-8 w-40" />
              </div>
              <Skeleton className="h-11 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[120px] w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3 pt-6">
              <Skeleton className="h-5 w-52" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-11 w-32" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
