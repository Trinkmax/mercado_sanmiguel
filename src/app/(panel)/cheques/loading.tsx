import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingCheques() {
  return (
    <div className="space-y-8">
      {/* PageHeader: título + total en cartera */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-5 w-80 max-w-full" />
        </div>
        <Skeleton className="h-[4.5rem] w-44 rounded-lg" />
      </div>

      {/* Filtros por estado */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-28 rounded-md" />
        ))}
      </div>

      {/* Tabla de cheques */}
      <div className="space-y-3 rounded-xl border bg-card p-4">
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}
