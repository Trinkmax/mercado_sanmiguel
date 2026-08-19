import { Skeleton } from "@/components/ui/skeleton";

export default function CobrarClienteLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      {/* Volver + cabecera */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-5 w-36" />
      </div>

      {/* Aviso de deuda activa */}
      <Skeleton className="h-14 w-full rounded-lg" />

      {/* Deuda + desglose */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between gap-3 border-b p-5">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-44" />
          </div>
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
        <div className="divide-y px-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <Skeleton className="h-6 w-14" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-5 w-40 max-w-full" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-5 w-24" />
            </div>
          ))}
        </div>
      </div>

      {/* Formulario de cobro */}
      <div className="space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-16 w-full rounded-md" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-5 w-36" />
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
        </div>
        <Skeleton className="h-16 w-full rounded-md" />
      </div>
    </div>
  );
}
