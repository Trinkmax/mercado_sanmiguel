import { Skeleton } from "@/components/ui/skeleton";

export default function CobranzaLoading() {
  return (
    <div className="space-y-8">
      {/* PageHeader */}
      <div className="space-y-2 pb-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-72 max-w-full" />
      </div>

      <div className="space-y-4">
        {/* Buscador grande */}
        <Skeleton className="h-14 w-full rounded-md" />

        {/* Lista de clientes */}
        <div className="divide-y overflow-hidden rounded-lg border bg-card">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex min-h-16 items-center gap-3 px-4 py-2">
              <Skeleton className="h-6 w-10 shrink-0" />
              <Skeleton className="h-5 flex-1" />
              <Skeleton className="h-5 w-24 shrink-0" />
              <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
