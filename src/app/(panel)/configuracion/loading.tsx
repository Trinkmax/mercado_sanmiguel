import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingConfiguracion() {
  return (
    <div className="space-y-8">
      {/* PageHeader */}
      <div className="space-y-2 pb-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1">
        <Skeleton className="h-11 w-28 rounded-md" />
        <Skeleton className="h-11 w-28 rounded-md" />
        <Skeleton className="h-11 w-28 rounded-md" />
        <Skeleton className="h-11 w-36 rounded-md" />
      </div>

      {/* Aviso */}
      <Skeleton className="h-16 w-full rounded-lg" />

      {/* Tabla de conceptos */}
      <div className="space-y-3 rounded-lg border bg-card p-4">
        <Skeleton className="h-6 w-full" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
