import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

/** Silueta de la garita mientras carga: pestañas, talonario del canon y cobros del día. */
export default function PorteriaLoading() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-5 w-96 max-w-full" />
        </div>
      </div>

      {/* Pestañas: Canon de transporte · Personal */}
      <div className="grid w-full grid-cols-2 gap-1 rounded-lg bg-muted p-1 sm:w-[32rem]">
        <Skeleton className="h-14 w-full bg-background" />
        <Skeleton className="h-14 w-full bg-muted-foreground/10" />
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] xl:items-start">
        {/* Talonario del canon */}
        <div className="space-y-6 rounded-lg border bg-card p-5 sm:p-6">
          <div className="space-y-2">
            <Skeleton className="h-7 w-36" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <div className="flex gap-2">
                <Skeleton className="size-14 rounded-lg" />
                <Skeleton className="h-14 flex-1" />
                <Skeleton className="size-14 rounded-lg" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-5 w-28" />
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-14 w-full rounded-lg" />
                <Skeleton className="h-14 w-full rounded-lg" />
              </div>
            </div>
          </div>
          <div className="grid gap-6 border-t pt-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-12 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <div className="flex gap-2">
                <Skeleton className="h-12 flex-1 rounded-full" />
                <Skeleton className="h-12 flex-1 rounded-full" />
                <Skeleton className="h-12 flex-1 rounded-full" />
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-9 w-36" />
            </div>
            <Skeleton className="h-14 w-full" />
          </div>
        </div>

        {/* Cobros de hoy */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <div className="space-y-3 rounded-lg border bg-card px-4 py-4">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-5 w-48" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-7 w-28 rounded-full" />
              <Skeleton className="h-7 w-24 rounded-full" />
              <Skeleton className="h-7 w-32 rounded-full" />
            </div>
          </div>
          <Card className="gap-0 divide-y overflow-hidden py-0">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <div className="w-14 space-y-1">
                  <Skeleton className="h-5 w-12" />
                  <Skeleton className="h-3 w-10" />
                </div>
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-5 w-40 max-w-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}
