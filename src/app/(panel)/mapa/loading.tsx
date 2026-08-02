import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Silueta del mapa del mercado mientras carga. */
export default function MapaLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2 pb-5">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} size="sm" className="gap-0">
            <CardContent className="space-y-1.5">
              <Skeleton className="h-6 w-10" />
              <Skeleton className="h-4 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-3">
          <div className="flex justify-end gap-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-28" />
          </div>
          <Skeleton className="aspect-[1000/640] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
