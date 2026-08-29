import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BookOpen, ClipboardList, ExternalLink, Pencil, Users } from "lucide-react";
import { requireRole } from "@/lib/auth-guards";
import { getCourseForManagement, getCourseStudents } from "@/lib/api/teach";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CourseStatStrip, plural } from "@/components/course-stat-strip";
import type { LessonDetail } from "@/types";

export const metadata: Metadata = { title: "Course overview" };

/**
 * One course, whole.
 *
 * Lesson and quiz management used to live only on two separate screens, which meant
 * there was nowhere to see a course as a single thing — the object an instructor
 * actually thinks about. This page is that view: the curriculum in reading order, the
 * quizzes beside it, and the editing screens one click away.
 *
 * It is a preview rather than an editor. Mixing "see the shape of the course" with
 * "reorder and rewrite it" is what made the lesson screen busy in the first place.
 */
export default async function CourseOverviewPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  await requireRole("admin", "content-manager", "instructor");

  // Returns null both for a course that does not exist and for one the caller may not
  // manage — the ownership check lives in `getCourseForManagement`, not here.
  const course = await getCourseForManagement(courseId);
  if (!course) notFound();

  const students = await getCourseStudents(courseId);

  const lessons = ((course.lessons ?? []) as LessonDetail[])
    .slice()
    .sort((a, b) => a.order - b.order);
  const quizzes = course.quizzes ?? [];

  return (
    <div className="container flex flex-col gap-8 py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/teach/courses" className="hover:underline">
          Courses
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-foreground">{course.title}</span>
      </nav>

      <PageHeader title={course.title} description={course.description ?? undefined}>
        <Button variant="outline" render={<Link href={`/courses/${course.slug}`} />}>
          <ExternalLink className="size-4" aria-hidden="true" />
          View public page
        </Button>
        <Button render={<Link href={`/teach/courses/${courseId}/edit`} />}>
          <Pencil className="size-4" aria-hidden="true" />
          Edit details
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="size-4" aria-hidden="true" />
                Curriculum
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                render={<Link href={`/teach/courses/${courseId}/lessons`} />}
              >
                Edit curriculum
              </Button>
            </CardHeader>

            <CardContent>
              {lessons.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No lessons yet. Add the first one to give students something to work
                  through.
                </p>
              ) : (
                <ol className="flex flex-col divide-y">
                  {lessons.map((lesson, index) => (
                    <li
                      key={lesson.documentId}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="w-6 shrink-0 text-sm text-muted-foreground tabular-nums">
                          {index + 1}
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-medium">{lesson.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {lesson.videoUrl ? "Video & text" : "Text"}
                          </span>
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="size-4" aria-hidden="true" />
                Quizzes
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                render={<Link href={`/teach/courses/${courseId}/quizzes`} />}
              >
                Edit quizzes
              </Button>
            </CardHeader>

            <CardContent>
              {quizzes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No quizzes yet. Add one to assess what students have learned.
                </p>
              ) : (
                <ul className="flex flex-col divide-y">
                  {quizzes.map((quiz) => (
                    <li
                      key={quiz.documentId}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <span className="truncate text-sm font-medium">{quiz.title}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">At a glance</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <CourseStatStrip
                items={[
                  { label: "Lessons", value: lessons.length },
                  { label: "Quizzes", value: quizzes.length },
                  { label: "Students", value: students?.length ?? 0 },
                ]}
              />

              <Button
                variant="outline"
                render={<Link href={`/teach/courses/${courseId}/students`} />}
              >
                <Users className="size-4" aria-hidden="true" />
                {plural(students?.length ?? 0, "enrolled student")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cover image</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {course.coverImageUrl ? (
                <img
                  src={course.coverImageUrl}
                  alt=""
                  className="aspect-video w-full rounded-lg bg-muted object-cover"
                />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-muted">
                  <BookOpen className="size-6 text-muted-foreground" aria-hidden="true" />
                </div>
              )}

              {/*
                A URL field, not an upload widget. The deployment filesystem is
                ephemeral, so uploaded files would vanish on redeploy — the brief
                permits image URLs and that is the option taken.
              */}
              <p className="text-xs text-muted-foreground">
                Set the image URL on the edit screen.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Slug</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Badge variant="secondary" className="w-fit font-mono">
                /{course.slug}
              </Badge>
              <p className="text-xs text-muted-foreground">
                Changing this breaks existing links to the course.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
