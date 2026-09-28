import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingMiCuenta() {
  return (
    <div className="space-y-8">
      {/* Saludo + carpeta */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-64 max-w-full" />
      </div>

      {/* Semáforo: tres luces + monto */}
      <div className="flex items-stretch gap-4 rounded-xl border-2 p-4 sm:gap-6 sm:p-6">
        <Skeleton className="h-32 w-14 rounded-full" />
        <div className="flex-1 space-y-3 self-center">
          <Skeleton className="h-6 w-24 rounded" />
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-5 w-64 max-w-full" />
          <Skeleton className="h-4 w-52 max-w-full" />
        </div>
      </div>

      {/* Conceptos del mes */}
      <div className="space-y-3 rounded-xl border bg-card p-6">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>

      {/* Pagos con botón Recibo */}
      <div className="space-y-3 rounded-xl border bg-card p-6">
        <Skeleton className="h-6 w-32" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3.5 w-48" />
            </div>
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-11 w-24 rounded-md" />
          </div>
        ))}
      </div>

      {/* Solicitudes */}
      <div className="space-y-3 rounded-xl border bg-card p-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-12 w-full rounded-md" />
      </div>

      {/* Documentos */}
      <div className="space-y-3 rounded-xl border bg-card p-6">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-12 w-full rounded-md" />
      </div>
    </div>
  );
}
