import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingMiCuenta() {
  return (
    <div className="space-y-8">
      {/* Hero: saludo + puesto */}
      <div className="space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-64 max-w-full" />
      </div>

      {/* Banda de estado (al día / debe) */}
      <Skeleton className="h-44 w-full rounded-lg" />

      {/* Conceptos del mes */}
      <div className="space-y-3 rounded-xl border bg-card p-6">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>

      {/* Meses anteriores */}
      <div className="space-y-3 rounded-xl border bg-card p-6">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>

      {/* Solicitudes */}
      <div className="space-y-3 rounded-xl border bg-card p-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-5 w-full max-w-md" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-12 w-full rounded-md" />
      </div>

      {/* Pagos */}
      <div className="space-y-3 rounded-xl border bg-card p-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>

      {/* Documentos */}
      <div className="space-y-3 rounded-xl border bg-card p-6">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-5 w-full max-w-md" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-12 w-full rounded-md" />
      </div>
    </div>
  );
}
