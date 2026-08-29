import { CourseGridSkeleton } from "@/components/course-grid-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function MyCoursesLoading() {
  return (
    <div className="container flex flex-col gap-8 py-10">
      <Skeleton className="h-9 w-48" />
      <CourseGridSkeleton count={3} />
    </div>
  );
}
