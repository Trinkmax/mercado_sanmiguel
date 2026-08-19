import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingNuevaSolicitudSocio() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-11 w-44 rounded-md" />
      <div className="space-y-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-5 w-full max-w-md" />
      </div>
      <div className="space-y-7">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-md" />
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-32 w-full rounded-md" />
        </div>
        <Skeleton className="h-14 w-full rounded-md" />
      </div>
    </div>
  );
}
