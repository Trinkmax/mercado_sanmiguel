import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingComunicaciones() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5">
        <div className="space-y-2">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-5 w-[30rem] max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-11 w-40 rounded-md" />
          <Skeleton className="h-12 w-40 rounded-md" />
        </div>
      </div>

      {/* Pestañas */}
      <div className="flex gap-2">
        <Skeleton className="h-11 w-32 rounded-md" />
        <Skeleton className="h-11 w-56 rounded-md" />
      </div>

      {/* Filas de circulares */}
      <div className="divide-y overflow-hidden rounded-lg border bg-card">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
            <Skeleton className="h-6 w-9" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-1.5 w-24 rounded-full max-md:hidden" />
            <Skeleton className="h-6 w-16 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
