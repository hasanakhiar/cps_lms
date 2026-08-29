import Link from "next/link";
import { BookOpen, User } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { CourseSummary } from "@/types";

/**
 * A course in a listing.
 *
 * Takes an optional `progress` so the same card serves both the public catalogue and
 * the student's "My Courses" — the only difference between the two is whether a
 * progress bar belongs on it, and that is a prop rather than a second component.
 */
export function CourseCard({
  course,
  progress,
  href,
}: {
  course: Pick<
    CourseSummary,
    "documentId" | "title" | "slug" | "description" | "coverImageUrl" | "instructorName"
  > & { lessons?: unknown[] };
  progress?: { completed: number; totalLessons: number; percentage: number };
  href?: string;
}) {
  const lessonCount = course.lessons?.length ?? progress?.totalLessons ?? 0;
  const target = href ?? `/courses/${course.slug}`;

  return (
    // `relative` is what the stretched link below anchors to.
    <Card className="relative flex h-full flex-col overflow-hidden pt-0 transition-shadow hover:shadow-md">
      {course.coverImageUrl ? (
        <img
          src={course.coverImageUrl}
          alt=""
          className="h-40 w-full bg-muted object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-40 w-full items-center justify-center bg-muted">
          <BookOpen className="size-8 text-muted-foreground" aria-hidden="true" />
        </div>
      )}

      <CardHeader>
        <CardTitle className="text-lg leading-snug">
          {/* The whole card is clickable via this stretched link, which keeps one
              focusable element per card for keyboard users rather than three. */}
          <Link href={target} className="after:absolute after:inset-0 hover:underline">
            {course.title}
          </Link>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1">
        {course.description ? (
          <p className="line-clamp-3 text-sm text-muted-foreground text-pretty">
            {course.description}
          </p>
        ) : null}
      </CardContent>

      <CardFooter className="flex flex-col items-stretch gap-3">
        {progress ? (
          <div className="flex flex-col gap-1.5">
            <Progress
              value={progress.percentage}
              aria-label={`${progress.percentage}% complete`}
            />
            <p className="text-xs text-muted-foreground">
              {progress.completed} of {progress.totalLessons} lessons · {progress.percentage}%
            </p>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <BookOpen className="size-3.5" aria-hidden="true" />
            {lessonCount} {lessonCount === 1 ? "lesson" : "lessons"}
          </span>

          {course.instructorName ? (
            <span className="inline-flex items-center gap-1.5 truncate">
              <User className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{course.instructorName}</span>
            </span>
          ) : null}
        </div>
      </CardFooter>
    </Card>
  );
}
