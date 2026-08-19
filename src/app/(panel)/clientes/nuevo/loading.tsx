import { Skeleton } from "@/components/ui/skeleton";

/** Silueta del alta de cliente mientras carga (header + formulario). */
export default function NuevoClienteLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2 pb-6">
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-5 w-full max-w-2xl" />
      </div>

      <div className="max-w-2xl space-y-5">
        {/* Nombre, apodo */}
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-12 w-full" />
          </div>
        ))}
        {/* Tipo + CUIT · Teléfono + Email */}
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-12 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        ))}
        {/* Dirección */}
        <div className="space-y-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-12 w-full" />
        </div>
        {/* N° de carpeta */}
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-12 w-40" />
        </div>
        {/* Paga el mes en: chips */}
        <div className="space-y-2">
          <Skeleton className="h-5 w-36" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-[6.5rem] rounded-lg" />
            ))}
          </div>
        </div>
        {/* ¿Qué paga? */}
        <div className="space-y-3">
          <Skeleton className="h-5 w-28" />
          <div className="divide-y rounded-lg border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex min-h-12 items-center gap-3 px-3 py-1.5">
                <Skeleton className="h-6 w-14" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-11 w-40" />
              </div>
            ))}
          </div>
        </div>
        {/* Notas + botón */}
        <div className="space-y-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-13 w-full" />
      </div>
    </div>
  );
}
