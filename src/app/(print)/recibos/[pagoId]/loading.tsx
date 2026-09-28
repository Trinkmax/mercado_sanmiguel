import { Skeleton } from "@/components/ui/skeleton";

export default function ReciboLoading() {
  return (
    <>
      {/* Barra Volver / Imprimir */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <Skeleton className="h-11 w-28 rounded-md" />
        <Skeleton className="h-12 w-52 rounded-md" />
      </div>

      <div className="space-y-6 rounded-md border p-6">
        {/* Cabecera */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
          <div className="space-y-2">
            <Skeleton className="h-6 w-72 max-w-full" />
            <Skeleton className="h-4 w-36" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="ml-auto h-4 w-24" />
          </div>
        </div>
        <Skeleton className="h-5 w-80 max-w-full" />
        {/* Cómo pagó */}
        <div className="space-y-2">
          <Skeleton className="h-5 w-24" />
          <div className="divide-y rounded-md border">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="size-5" />
                <Skeleton className="h-5 flex-1" />
                <Skeleton className="h-5 w-24" />
              </div>
            ))}
          </div>
        </div>
        {/* Detalle */}
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
        {/* Total */}
        <div className="flex items-baseline justify-between border-t-2 pt-3">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-9 w-40" />
        </div>
        <div className="flex items-end justify-between gap-6">
          <Skeleton className="h-12 w-44 rounded-md" />
          <Skeleton className="h-6 w-56" />
        </div>
      </div>
    </>
  );
}
