import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

/** Silueta del listado de personal mientras carga. */
export default function PersonalLoading() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-5 w-96 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-11 w-40" />
          <Skeleton className="h-13 w-44" />
        </div>
      </div>

      <div className="space-y-3">
        <Skeleton className="h-11 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24 rounded-full" />
          <Skeleton className="h-10 w-20 rounded-full" />
        </div>
      </div>

      <Card className="gap-0 divide-y overflow-hidden py-0">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex min-h-16 items-center gap-4 px-4 py-3">
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-5 w-56 max-w-full" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-6 w-16" />
          </div>
        ))}
      </Card>
    </div>
  );
}
