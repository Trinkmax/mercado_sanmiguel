import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingNuevoRegistro() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-5 w-96 max-w-full" />
        </div>
        <Skeleton className="h-11 w-48 rounded-md" />
      </div>

      <div className="max-w-2xl space-y-8">
        {/* ¿A quién? buscador grande */}
        <div className="space-y-3">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-14 w-full rounded-md" />
        </div>
        {/* ¿Qué es? tres tarjetas */}
        <div className="space-y-3">
          <Skeleton className="h-6 w-24" />
          <div className="grid gap-2 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </div>
        {/* Título + sugerencias + detalle */}
        <div className="space-y-3">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-12 w-full rounded-md" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-40 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-28 w-full rounded-md" />
        </div>
        <Skeleton className="h-14 w-full rounded-md" />
      </div>
    </div>
  );
}
