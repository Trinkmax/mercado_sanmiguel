import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingNuevaCircular() {
  return (
    <div className="space-y-8">
      {/* PageHeader: título + descripción + volver */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5">
        <div className="space-y-2">
          <Skeleton className="h-9 w-52" />
          <Skeleton className="h-5 w-[30rem] max-w-full" />
        </div>
        <Skeleton className="h-11 w-44 rounded-md" />
      </div>

      <div className="max-w-2xl space-y-7">
        {/* Título */}
        <div className="space-y-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
        {/* Detalle */}
        <div className="space-y-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-36 w-full rounded-md" />
        </div>
        {/* Fecha + PDF */}
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-12 w-full rounded-md" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-12 w-full rounded-md" />
          </div>
        </div>
        {/* Recepción obligatoria */}
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-12 w-48 rounded-md" />
      </div>
    </div>
  );
}
