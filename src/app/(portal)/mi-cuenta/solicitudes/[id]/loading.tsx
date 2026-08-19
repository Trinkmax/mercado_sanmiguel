import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingSolicitudSocio() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-11 w-44 rounded-md" />
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-72 max-w-full" />
        </div>
        <Skeleton className="h-7 w-24 rounded" />
      </div>
      {/* Estado + recorrido */}
      <div className="space-y-4 rounded-xl border bg-card p-4">
        <Skeleton className="h-5 w-3/4" />
        <div className="flex justify-between gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-2">
              <Skeleton className="size-7 rounded-full" />
              <Skeleton className="h-3 w-14" />
            </div>
          ))}
        </div>
      </div>
      {/* Lo que enviaste */}
      <div className="space-y-3 rounded-xl border bg-card p-4">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-20 w-full" />
      </div>
      {/* Mensajes */}
      <Skeleton className="h-7 w-28" />
      <div className="space-y-3">
        <Skeleton className="h-20 w-3/4 rounded-xl" />
        <Skeleton className="ml-auto h-16 w-2/3 rounded-xl" />
      </div>
      <Skeleton className="h-44 w-full rounded-xl" />
    </div>
  );
}
