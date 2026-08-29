import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { BookOpen, ClipboardList, Plus, Users } from "lucide-react";
import { requireRole } from "@/lib/auth-guards";
import { getTeachingCourses } from "@/lib/api/teach";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CourseStatStrip } from "@/components/course-stat-strip";

export const metadata: Metadata = {
  title: "Teaching dashboard",
};

/**
 * A `<Suspense>` boundary rather than a `loading.tsx`, because a loading file here would
 * apply to the whole `/teach` subtree — including `/teach/courses/[courseId]/edit`,
 * which calls `notFound()`. Streaming commits the HTTP status before the component body
 * runs, so those routes would answer 200 with 404 markup. See `app/courses/page.tsx`.
 */
export default async function TeachDashboardPage() {
  const session = await requireRole("admin", "content-manager", "instructor");

  return (
    <Suspense fallback={<TeachDashboardSkeleton />}>
      <TeachDashboard role={session.user.role} />
    </Suspense>
  );
}

function TeachDashboardSkeleton() {
  return (
    <div className="container flex flex-col gap-8 py-10">
      <Skeleton className="h-9 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}

async function TeachDashboard({ role }: { role: string }) {
  const isInstructor = role === "instructor";

  // Own courses for an instructor, all of them for staff — decided by the backend from
  // the session, not by a parameter this page could get wrong.
  const courses = await getTeachingCourses();

  const totals = courses.reduce(
    (acc, course) => ({
      lessons: acc.lessons + course.lessonCount,
      quizzes: acc.quizzes + course.quizCount,
      students: acc.students + course.studentCount,
    }),
    { lessons: 0, quizzes: 0, students: 0 }
  );

  const stats = [
    { label: "Courses", value: courses.length, icon: BookOpen },
    { label: "Lessons", value: totals.lessons, icon: BookOpen },
    { label: "Quizzes", value: totals.quizzes, icon: ClipboardList },
    { label: "Enrolments", value: totals.students, icon: Users },
  ];

  return (
    <div className="container flex flex-col gap-8 py-10">
      <PageHeader
        title="Teaching dashboard"
        description={
          isInstructor
            ? "Courses you own. You can only edit your own material."
            : "Every course on the platform."
        }
      >
        <Button render={<Link href="/teach/courses/new" />}>
          <Plus className="size-4" aria-hidden="true" />
          New course
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold tracking-tight">Your courses</h2>

        {courses.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No courses yet"
            description={
              isInstructor
                ? "Create your first course and add lessons to it."
                : "No courses exist on the platform yet."
            }
            action={{ href: "/teach/courses/new", label: "Create a course" }}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Card key={course.documentId}>
                <CardHeader>
                  <CardTitle className="text-base leading-snug">
                    <Link
                      href={`/teach/courses/${course.documentId}`}
                      className="hover:underline"
                    >
                      {course.title}
                    </Link>
                  </CardTitle>
                </CardHeader>

                <CardContent className="flex flex-col gap-3">
                  <CourseStatStrip
                    items={[
                      { label: "Lessons", value: course.lessonCount },
                      { label: "Quizzes", value: course.quizCount },
                      { label: "Students", value: course.studentCount },
                    ]}
                  />

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      render={<Link href={`/teach/courses/${course.documentId}/lessons`} />}
                    >
                      Lessons
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      render={<Link href={`/teach/courses/${course.documentId}/quizzes`} />}
                    >
                      Quizzes
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      render={<Link href={`/teach/courses/${course.documentId}/students`} />}
                    >
                      Students
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
