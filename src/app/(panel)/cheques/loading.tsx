import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingCheques() {
  return (
    <div className="space-y-8">
      {/* PageHeader: título + exportar + Por cobrar */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-5 w-96 max-w-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-11 w-44 rounded-md" />
          <Skeleton className="h-[4.25rem] w-40 rounded-xl" />
        </div>
      </div>

      {/* Aviso de listos para depositar */}
      <Skeleton className="h-20 w-full rounded-xl" />

      {/* Filtros + buscador */}
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {[48, 32, 44, 28, 28, 24].map((w, i) => (
            <Skeleton key={i} className="h-11 rounded-full" style={{ width: `${w * 4}px` }} />
          ))}
        </div>
        <div className="flex max-w-xl gap-2">
          <Skeleton className="h-12 flex-1 rounded-md" />
          <Skeleton className="h-12 w-24 rounded-md" />
        </div>

        {/* Cartera */}
        <div className="divide-y rounded-xl border bg-card">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="grid gap-3 px-4 py-4 lg:grid-cols-[12.5rem_minmax(0,1fr)_15rem] lg:items-center lg:gap-6"
            >
              <div className="space-y-2">
                <Skeleton className="h-7 w-28" />
                <Skeleton className="h-6 w-20 rounded-md" />
                <Skeleton className="h-6 w-24" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-5 w-64 max-w-full" />
                <Skeleton className="h-4 w-80 max-w-full" />
                <Skeleton className="h-7 w-28 rounded-md" />
              </div>
              <div className="flex gap-2 md:justify-end lg:flex-col">
                <Skeleton className="h-11 w-28 rounded-md lg:w-full" />
                <Skeleton className="h-11 w-44 rounded-md lg:w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
