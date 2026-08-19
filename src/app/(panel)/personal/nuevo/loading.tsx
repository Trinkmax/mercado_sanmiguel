import { Skeleton } from "@/components/ui/skeleton";

/** Silueta del formulario de empleado (alta) mientras carga. */
export default function NuevoEmpleadoLoading() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="mb-3 h-5 w-24" />
        <div className="flex flex-wrap items-end justify-between gap-4 pb-2">
          <div className="space-y-2">
            <Skeleton className="h-8 w-52" />
            <Skeleton className="h-5 w-96 max-w-full" />
          </div>
        </div>
      </div>
      <div className="max-w-2xl space-y-6">
        {Array.from({ length: 2 }).map((_, b) => (
          <div key={b} className="space-y-5 rounded-lg border bg-card p-5 sm:p-6">
            <div className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-12 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </div>
            ))}
          </div>
        ))}
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <Skeleton className="h-13 w-full sm:w-32" />
          <Skeleton className="h-13 w-full sm:flex-1" />
        </div>
      </div>
    </div>
  );
}
