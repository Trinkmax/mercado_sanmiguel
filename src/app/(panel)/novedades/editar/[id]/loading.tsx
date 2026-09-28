import { Skeleton } from "@/components/ui/skeleton";

/** Silueta de "Corregir novedad": encabezado, la persona elegida, las fichas y el detalle. */
export default function EditarNovedadLoading() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5">
        <div className="space-y-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-5 w-80 max-w-full" />
        </div>
        <Skeleton className="h-11 w-48" />
      </div>
      <div className="max-w-4xl space-y-8">
        <div className="space-y-3">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-11 w-44 rounded-full" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-6 w-32" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}
