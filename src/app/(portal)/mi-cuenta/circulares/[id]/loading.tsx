import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingCircularSocio() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-11 w-44 rounded-md" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-5 w-72 max-w-full" />
      </div>
      <div className="space-y-4 rounded-xl border bg-card p-6">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-12 w-full rounded-md" />
      </div>
      <Skeleton className="h-14 w-full rounded-lg" />
    </div>
  );
}
