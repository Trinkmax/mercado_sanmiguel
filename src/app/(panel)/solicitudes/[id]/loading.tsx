import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingSolicitud() {
  return (
    <div className="space-y-8">
      {/* PageHeader: N° + asunto + sello + botones */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5">
        <div className="space-y-2">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-5 w-96 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-7 w-24 rounded" />
          <Skeleton className="h-11 w-28 rounded-md" />
          <Skeleton className="h-11 w-24 rounded-md" />
        </div>
      </div>

      {/* Recorrido (stepper) */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-start justify-between gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-2">
              <Skeleton className="size-7 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          {/* Detalle */}
          <div className="space-y-4 rounded-xl border bg-card p-4">
            <Skeleton className="h-6 w-40" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-20 w-full" />
          </div>
          {/* Hilo */}
          <Skeleton className="h-7 w-32" />
          <div className="space-y-3">
            <Skeleton className="h-20 w-3/4 rounded-xl" />
            <Skeleton className="ml-auto h-16 w-2/3 rounded-xl" />
            <Skeleton className="h-20 w-3/4 rounded-xl" />
          </div>
          <Skeleton className="h-44 w-full rounded-xl" />
        </div>
        <div className="space-y-6">
          <div className="space-y-2 rounded-xl border bg-card p-4">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-12 w-full rounded-md" />
            <Skeleton className="h-11 w-full rounded-md" />
            <Skeleton className="h-11 w-full rounded-md" />
          </div>
          <div className="space-y-2 rounded-xl border bg-card p-3">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </div>
    </div>
  );
}
