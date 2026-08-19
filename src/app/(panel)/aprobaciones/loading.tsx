import { Skeleton } from "@/components/ui/skeleton";

/** Silueta de Aprobaciones: header, pestañas y dos cards de cambio con diff. */
export default function LoadingAprobaciones() {
  return (
    <div className="space-y-8">
      {/* PageHeader */}
      <div className="space-y-2 pb-6">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-5 w-full max-w-2xl" />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1">
        <Skeleton className="h-11 w-36 rounded-md" />
        <Skeleton className="h-11 w-32 rounded-md" />
        <Skeleton className="h-11 w-32 rounded-md" />
      </div>

      {/* Cards de cambio */}
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="space-y-5 rounded-lg bg-card p-6 ring-1 ring-foreground/10">
          <div className="space-y-2">
            <Skeleton className="h-6 w-44 rounded-md" />
            <Skeleton className="h-7 w-3/4 max-w-xl" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <div className="space-y-2 rounded-lg border p-3">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="flex justify-end gap-3 border-t pt-5">
            <Skeleton className="h-12 w-32" />
            <Skeleton className="h-12 w-36" />
          </div>
        </div>
      ))}
    </div>
  );
}
