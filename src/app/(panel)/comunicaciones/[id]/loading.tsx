import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingCircular() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-96 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-7 w-20 rounded" />
          <Skeleton className="h-11 w-28 rounded-md" />
          <Skeleton className="h-11 w-24 rounded-md" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4 rounded-xl border bg-card p-4">
          <Skeleton className="h-6 w-32" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-2.5 w-full rounded-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>

      <Skeleton className="h-7 w-64" />
      <div className="space-y-3 rounded-xl border bg-card p-4">
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
