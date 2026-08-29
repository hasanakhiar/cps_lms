import { Skeleton } from "@/components/ui/skeleton";

/** A page header plus a table, matching the shape of the admin and teach lists. */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="container flex flex-col gap-8 py-10">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-10 max-w-md" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
