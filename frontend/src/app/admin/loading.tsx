import { TableSkeleton } from "@/components/table-skeleton";

/**
 * Safe to place here: no route under /admin calls `notFound()`, so making this subtree
 * stream cannot swallow a 404 status. See app/courses/page.tsx for the case where it
 * did.
 */
export default function AdminLoading() {
  return <TableSkeleton />;
}
