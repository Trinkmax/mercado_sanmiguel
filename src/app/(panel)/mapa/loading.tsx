import { Skeleton } from "@/components/ui/skeleton";

/** Silueta del mapa mientras carga: la pantalla entera, como el mapa. */
export default function MapaLoading() {
  return (
    <div className="flex h-[calc(100dvh-var(--cabecera-movil)-var(--nav-inferior))] min-h-[26rem] flex-col bg-card">
      <div className="flex items-center gap-2 border-b px-3 py-2.5 sm:px-4">
        <Skeleton className="h-11 min-w-0 flex-1 sm:max-w-md" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="size-11 sm:w-40" />
          <Skeleton className="size-11" />
        </div>
      </div>
      <div className="flex items-center gap-3 overflow-hidden border-b px-3 py-2.5 sm:px-4 md:py-3">
        <div className="w-[8.5rem] shrink-0 space-y-2 md:w-56">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-2.5 w-full rounded-full" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-28 shrink-0 rounded-full" />
        ))}
      </div>
      <Skeleton className="min-h-[12rem] flex-1 rounded-none" />
    </div>
  );
}
