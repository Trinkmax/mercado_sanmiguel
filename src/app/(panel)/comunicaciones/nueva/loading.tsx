import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingNuevaCircular() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5">
        <div className="space-y-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-5 w-[30rem] max-w-full" />
        </div>
        <Skeleton className="h-11 w-44 rounded-md" />
      </div>

      <div className="max-w-2xl space-y-8">
        {/* Qué dice */}
        <div className="space-y-5">
          <div className="space-y-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-12 w-full rounded-md" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-36 w-full rounded-md" />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Skeleton className="h-12 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
          </div>
        </div>

        {/* ¿A quién le llega? chips + switch + resumen */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-44" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-32 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>

        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-14 w-56 rounded-md" />
      </div>
    </div>
  );
}
