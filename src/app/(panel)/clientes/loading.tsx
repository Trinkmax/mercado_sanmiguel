import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

/** Silueta del listado de clientes mientras carga. */
export default function ClientesLoading() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-5 w-80 max-w-full" />
        </div>
        <Skeleton className="h-13 w-44" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-11 w-full" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-full" />
          ))}
        </div>
      </div>

      <Card className="gap-0 divide-y overflow-hidden py-0">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex min-h-12 items-center gap-3 px-4 py-2">
            <Skeleton className="h-6 w-12" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-48 max-w-full" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-14" />
          </div>
        ))}
      </Card>
    </div>
  );
}
