import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/** Silueta de la ficha: chips (N°, categoría, semáforo), nombre y acciones, Debe hoy, pestañas. */
export default function FichaClienteLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-5">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-7 w-20" />
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4 pb-2">
            <div className="space-y-2">
              <Skeleton className="h-8 w-72 max-w-full" />
              <Skeleton className="h-5 w-96 max-w-full" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-12 w-32" />
              <Skeleton className="h-12 w-28" />
              <Skeleton className="h-12 w-24" />
            </div>
          </div>
          <Skeleton className="mt-2 h-11 w-64 max-w-full rounded-lg" />
        </div>
        <div className="flex flex-wrap items-end gap-10">
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {["w-20", "w-24", "w-28", "w-24", "w-28"].map((w, i) => (
            <Skeleton key={i} className={`h-11 ${w} bg-background/70`} />
          ))}
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-11 w-56" />
          <Skeleton className="h-11 w-36" />
        </div>
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="flex items-center gap-4">
                  <Skeleton className="h-7 w-14" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-56 max-w-full" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-7 w-20" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
