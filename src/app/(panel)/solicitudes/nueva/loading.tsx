import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingNuevaSolicitud() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5">
        <div className="space-y-2">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-5 w-[26rem] max-w-full" />
        </div>
        <Skeleton className="h-11 w-44 rounded-md" />
      </div>

      <div className="max-w-2xl space-y-7">
        {/* Tipo: chips */}
        <div className="space-y-2">
          <Skeleton className="h-5 w-24" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-md" />
            ))}
          </div>
        </div>
        {/* Asunto */}
        <div className="space-y-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
        {/* Detalle */}
        <div className="space-y-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-32 w-full rounded-md" />
        </div>
        {/* ¿Sobre un puesto? */}
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-12 rounded-md" />
            <Skeleton className="h-12 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-12 w-48 rounded-md" />
      </div>
    </div>
  );
}
