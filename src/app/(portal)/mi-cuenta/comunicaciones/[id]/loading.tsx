import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingRegistroSocio() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-11 w-48 rounded-md" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-60" />
        <Skeleton className="h-5 w-72 max-w-full" />
      </div>

      {/* Recorrido + detalle */}
      <div className="space-y-4 rounded-xl border bg-card p-6">
        <div className="flex justify-between gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-16 w-full" />
      </div>

      {/* Multa */}
      <Skeleton className="h-32 w-full rounded-xl" />

      {/* Hilo + caja */}
      <Skeleton className="h-6 w-28" />
      <Skeleton className="h-20 w-3/4 rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
