import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/** Silueta de la ficha del cliente mientras carga. */
export default function FichaClienteLoading() {
  return (
    <div className="space-y-8">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-7 w-20" />
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4 pb-4">
          <div className="space-y-2">
            <Skeleton className="h-9 w-72 max-w-full" />
            <Skeleton className="h-5 w-96 max-w-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-12 w-32" />
            <Skeleton className="h-12 w-28" />
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-9 w-40" />
        </div>
      </div>

      <div className="space-y-4">
        <Skeleton className="h-13 w-full max-w-xl" />
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
