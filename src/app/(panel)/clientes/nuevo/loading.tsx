import { Skeleton } from "@/components/ui/skeleton";

/** Silueta del alta: ¿Qué es?, datos, ¿Es socio?, ¿Qué paga?, cuotas y botón. */
export default function NuevoClienteLoading() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-5 w-[32rem] max-w-full" />
        </div>
        <Skeleton className="h-12 w-28" />
      </div>

      <div className="max-w-2xl space-y-6">
        {/* ¿Qué es? */}
        <div className="space-y-2">
          <Skeleton className="h-5 w-24" />
          <div className="grid gap-2 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </div>
        {/* Nombre y apodo */}
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-12 w-full" />
          </div>
        ))}
        {/* ¿Es socio? */}
        <div className="space-y-2">
          <Skeleton className="h-5 w-56" />
          <div className="flex gap-2">
            <Skeleton className="h-12 w-32 rounded-lg" />
            <Skeleton className="h-12 w-28 rounded-lg" />
          </div>
        </div>
        {/* Persona, CUIT, teléfono */}
        <div className="grid gap-5 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-12 w-full" />
            </div>
          ))}
        </div>
        {/* ¿Qué paga? */}
        <div className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <div className="divide-y rounded-lg border">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex min-h-14 items-center gap-3 px-3 py-2">
                <Skeleton className="h-6 w-14" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56 max-w-full" />
                </div>
                <Skeleton className="h-11 w-40" />
              </div>
            ))}
          </div>
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
        {/* Cuotas */}
        <div className="space-y-2">
          <Skeleton className="h-5 w-36" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-[6.5rem] rounded-lg" />
            ))}
          </div>
        </div>
        <Skeleton className="h-13 w-full" />
      </div>
    </div>
  );
}
