import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingRegistro() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-11 w-52 rounded-md" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-5 w-80 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-6 w-28 rounded" />
          <Skeleton className="h-6 w-24 rounded" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          {/* Recorrido */}
          <div className="space-y-4 rounded-xl border bg-card p-6">
            <div className="flex justify-between gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                  <Skeleton className="size-8 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
            <Skeleton className="h-4 w-56" />
          </div>
          {/* Qué pasó */}
          <div className="space-y-3 rounded-xl border bg-card p-6">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-16 w-full" />
          </div>
          {/* Hilo + respuesta */}
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-20 w-3/4 rounded-xl" />
          <Skeleton className="ml-auto h-16 w-2/3 rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
        {/* Para + multa: en celular y tablet, arriba (igual que la página) */}
        <div className="space-y-4 max-lg:order-first">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
