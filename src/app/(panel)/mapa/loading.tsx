import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Silueta del mapa del mercado mientras carga. */
export default function MapaLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 pb-5">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-5 w-[32rem] max-w-full" />
      </div>

      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <Skeleton className="h-11 w-full max-w-md flex-1" />
          <div className="ml-auto flex gap-2">
            <Skeleton className="h-11 w-40" />
            <Skeleton className="size-11" />
          </div>
        </div>
        <div className="flex flex-col gap-3 border-b px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:gap-6">
          <div className="space-y-2 lg:w-72">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-2.5 w-full rounded-full" />
          </div>
          <div className="flex flex-1 flex-wrap gap-1.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-28 rounded-full" />
            ))}
          </div>
        </div>
        <Skeleton className="aspect-[2.42] max-h-[74vh] min-h-[24rem] w-full rounded-none" />
        <div className="border-t px-4 py-4 md:px-5">
          <Skeleton className="h-5 w-full max-w-xl" />
        </div>
      </Card>
    </div>
  );
}
