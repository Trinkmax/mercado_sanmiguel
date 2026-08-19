import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/** Silueta de la ficha del empleado mientras carga. */
export default function FichaEmpleadoLoading() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="mb-3 h-5 w-20" />
        <Skeleton className="mb-2 h-6 w-16" />
        <div className="flex flex-wrap items-end justify-between gap-4 pb-2">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64 max-w-full" />
            <Skeleton className="h-5 w-80 max-w-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-12 w-36" />
            <Skeleton className="h-12 w-32" />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="space-y-1.5">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-36" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="divide-y rounded-lg border bg-card">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="grid gap-3 px-4 py-3 sm:grid-cols-[7.5rem_1fr]">
              <Skeleton className="h-6 w-20" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-12 w-32" />
                <Skeleton className="h-4 w-3" />
                <Skeleton className="h-12 w-32" />
              </div>
            </div>
          ))}
        </div>
        <Skeleton className="h-12 w-44" />
      </div>
    </div>
  );
}
