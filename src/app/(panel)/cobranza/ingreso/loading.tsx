import { Skeleton } from "@/components/ui/skeleton";

/** Silueta de "Cobrar sin cliente": formulario a la izquierda, lo cobrado hoy a la derecha. */
export default function CobroIngresoLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2 pb-5">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <div className="grid gap-8 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] xl:items-start">
        <div className="space-y-6 rounded-lg border bg-card p-5 sm:p-6">
          <Skeleton className="h-7 w-64 max-w-full" />
          <Skeleton className="h-14 w-full rounded-md" />
          <Skeleton className="h-12 w-full rounded-md" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-14 rounded-lg" />
            <Skeleton className="h-14 rounded-lg" />
          </div>
          <Skeleton className="h-14 w-full rounded-md" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
